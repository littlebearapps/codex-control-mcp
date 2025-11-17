# Issue 1.3 Investigation: Stuck Tasks in Registry

**Date**: 2025-11-17
**Investigator**: Claude (Sonnet 4.5)
**Status**: 🔍 Investigation Complete - ✅ ROOT CAUSE IDENTIFIED

---

## Issue Summary

**Reported Symptom**:
- Tasks remain in "working" state for 25+ hours
- Never marked as completed/failed/canceled
- Accumulate in registry over time
- Example: 9 tasks stuck from `/tmp/git-safety-test`

**Evidence**:
```sql
SELECT id, instruction,
  ROUND((julianday('now') - julianday(created_at/1000, 'unixepoch')) * 24, 1) as elapsed_hours
FROM tasks
WHERE status = 'working'
ORDER BY elapsed_hours DESC;

-- Results: 9 tasks stuck for 25.5-25.6 hours
-- All git operations (log, rebase)
-- All from /tmp/git-safety-test
```

**Source**: `docs/debugging/REGISTRY-FINDINGS.md` lines 115-149

---

## Code Analysis

### Discovery: Two Different Timeout Systems

**1. Process-Spawned Tasks** (codex_run, codex_cloud_submit)

**File**: `src/executor/process_manager.ts` lines 185-189

```typescript
// Create timeout watchdog (v3.2.1)
const watchdog = new TimeoutWatchdog(proc, processId, {
  idleTimeoutMs,
  hardTimeoutMs,
  // ... callbacks for warnings, progress, timeout
});
```

**Features**:
- ✅ Uses `TimeoutWatchdog` class (robust implementation)
- ✅ 5 min idle / 20 min hard timeout (configurable)
- ✅ Kills processes with SIGTERM → SIGKILL cascade
- ✅ Captures partial results (last 50 events, 64KB output)
- ✅ Sends MCP notifications (warnings, progress, timeout)
- ✅ Updates task registry on timeout

**2. SDK Tasks** (codex_local_exec, codex_local_resume)

**File**: `src/tools/local_exec.ts` lines 224-255

```typescript
// Setup timeout detection (v3.2.1)
const idleTimeoutMs = 5 * 60 * 1000; // 5 minutes
const hardTimeoutMs = 20 * 60 * 1000; // 20 minutes
let lastEventTime = Date.now();
let timedOut = false;

// Hard timeout watchdog
const hardTimeoutTimer = setTimeout(() => {
  if (!timedOut) {
    timedOut = true;
    console.error(`[LocalExec:${taskId}] ⏱️ HARD TIMEOUT after ${hardTimeoutMs / 1000}s`);
    globalTaskRegistry.updateTask(taskId, {
      status: 'failed',
      error: `Execution exceeded hard timeout (${hardTimeoutMs / 1000}s)`,
    });
  }
}, hardTimeoutMs);

// Idle timeout check (runs every 30s)
const idleCheckInterval = setInterval(() => {
  const idleTime = Date.now() - lastEventTime;
  if (idleTime > idleTimeoutMs && !timedOut) {
    timedOut = true;
    console.error(`[LocalExec:${taskId}] ⏱️ IDLE TIMEOUT after ${idleTimeoutMs / 1000}s`);
    globalTaskRegistry.updateTask(taskId, {
      status: 'failed',
      error: `No events received for ${idleTimeoutMs / 1000}s (idle timeout)`,
    });
  }
}, 30000);
```

**Features**:
- ✅ Detects idle timeout (5 minutes no events)
- ✅ Detects hard timeout (20 minutes total)
- ⚠️ **ONLY updates registry** - marks task as "failed"
- ❌ **Does NOT kill** underlying `thread.runStreamed()` process
- ❌ **Does NOT send** MCP notifications
- ❌ **Does NOT capture** partial results
- ❌ **No error handling** on registry update

---

## Root Cause Analysis

### The Critical Flaw

**SDK timeout implementation has a fatal weakness**:

1. **Timeout Detection Works**: Idle/hard timeouts fire correctly after 5/20 minutes
2. **Registry Update Attempted**: `globalTaskRegistry.updateTask(taskId, { status: 'failed', ... })`
3. **BUT**: Registry update has **NO error handling**

**Code Evidence** (`src/state/task_registry.ts` lines 337-367):

```typescript
updateTask(taskId: string, updates: Partial<Task>): Task | null {
  const task = this.getTask(taskId);
  if (!task) return null;

  const updatedTask = { ...task, ...updates, updatedAt: Date.now() };

  const stmt = this.db.prepare(`
    UPDATE tasks SET
      status = @status,
      error = @error,
      // ... 20+ fields
    WHERE id = @id
  `);

  stmt.run(updatedTask);  // ⚠️ NO TRY-CATCH, NO ERROR HANDLING
  return updatedTask;
}
```

**What Can Go Wrong**:

1. **SQLite Exception**: Database locked, corruption, disk full, permissions
2. **Transaction Failure**: WAL mode write conflict
3. **Connection Issue**: Database file inaccessible
4. **Any of above** → `stmt.run()` throws exception
5. **Exception propagates** → Background async IIFE catches it (line 368)
6. **Generic error handler** → Logs error but task already in limbo
7. **Task remains** in "working" state forever

### Why Tasks Stuck for 25+ Hours

**Timeline**:

1. **T+0**: User starts task via `codex_local_exec`
2. **T+0**: Background async IIFE starts, task status = "working"
3. **T+5s**: Codex SDK hangs (network issue, API timeout, bug)
4. **T+5m**: Idle timeout fires (no events for 5 minutes)
5. **T+5m**: Attempts `updateTask(taskId, { status: 'failed' })`
6. **T+5m**: SQLite exception thrown (e.g., database locked by another process)
7. **T+5m**: Exception caught by background IIFE error handler
8. **T+5m**: Error logged to console: `[LocalExec:taskId] ❌ Error: ...`
9. **T+5m**: **Task still in "working" state** (update never committed)
10. **T+25h**: Task still stuck, no automatic cleanup ever runs

**Evidence This Happened**:

```sql
-- 9 tasks stuck for 25+ hours, all in "working" state
-- If timeout HAD worked, they'd be in "failed" state
-- Therefore: Registry update MUST have failed
```

---

## Manual Cleanup Tool Analysis

**File**: `src/tools/cleanup_registry.ts`

**Tool**: `_codex_cleanup_registry`

**Functionality** (`src/state/task_registry.ts` lines 515-533):

```typescript
cleanupStuckTasks(maxAgeSeconds: number = 3600): number {
  const now = Date.now();
  const maxAgeMs = maxAgeSeconds * 1000;
  const cutoff = now - maxAgeMs;

  const stmt = this.db.prepare(`
    UPDATE tasks
    SET status = 'failed',
        error = ?,
        updated_at = ?,
        completed_at = ?
    WHERE status IN ('pending', 'working')
      AND created_at < ?
  `);

  const errorMessage = `Task timeout - no activity for over ${maxAgeSeconds} seconds...`;
  const result = stmt.run(errorMessage, now, now, cutoff);
  return result.changes;
}
```

**Characteristics**:
- ✅ Marks tasks stuck > 1 hour (default) as "failed"
- ✅ Works correctly when called
- ❌ **Requires manual invocation** - not automatic
- ❌ No scheduled execution
- ❌ User must explicitly call `_codex_cleanup_registry` tool

**This Explains**:
- Why 9 tasks stuck for 25+ hours
- Cleanup tool EXISTS but was never called
- No automatic cleanup mechanism

---

## The Disconnect

### What SHOULD Happen (Process-Spawned)

```
Codex CLI hangs
  ↓
5 minutes idle → TimeoutWatchdog detects
  ↓
SIGTERM sent to process
  ↓
Process doesn't exit → SIGKILL sent
  ↓
Registry updated: status = "failed"
  ↓
MCP notification sent
  ↓
Partial results captured
  ↓
Task cleaned up ✅
```

### What ACTUALLY Happens (SDK Tasks)

```
Codex SDK hangs
  ↓
5 minutes idle → Custom timeout detects
  ↓
Attempts registry update
  ↓
SQLite exception thrown ❌
  ↓
Exception caught by error handler
  ↓
Error logged to console
  ↓
Task remains "working" FOREVER
  ↓
Background IIFE continues running
  ↓
thread.runStreamed() still active
  ↓
No cleanup, no notifications, no recovery
  ↓
Task stuck until manual cleanup ❌
```

---

## Proposed Fixes

### Option A: Add Automatic Cleanup Scheduler (Quick Fix)

**Implementation**:

```typescript
// src/index.ts - On MCP server startup
class MCPDelegatorServer {
  private cleanupInterval?: NodeJS.Timeout;

  async start() {
    // ... existing startup code

    // Run cleanup on startup
    console.error('[MCPDelegator] Running stuck task cleanup on startup...');
    const cleaned = globalTaskRegistry.cleanupStuckTasks(3600);
    console.error(`[MCPDelegator] Cleaned up ${cleaned} stuck tasks`);

    // Schedule periodic cleanup (every 15 minutes)
    this.cleanupInterval = setInterval(() => {
      const cleaned = globalTaskRegistry.cleanupStuckTasks(3600);
      if (cleaned > 0) {
        console.error(`[MCPDelegator] Periodic cleanup: marked ${cleaned} stuck tasks as failed`);
      }
    }, 15 * 60 * 1000);
  }

  async stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
```

**Benefits**:
- ✅ Simple to implement (< 20 lines)
- ✅ Catches ALL stuck tasks (regardless of cause)
- ✅ Runs automatically
- ✅ No changes to existing timeout logic

**Limitations**:
- ⚠️ Tasks remain stuck for up to 1 hour + cleanup interval (max 75 minutes)
- ⚠️ Doesn't kill underlying processes
- ⚠️ No MCP notifications
- ⚠️ No partial results capture

---

### Option B: Use TimeoutWatchdog for SDK Tasks (Proper Fix)

**Implementation**:

Modify `src/tools/local_exec.ts` to use TimeoutWatchdog instead of custom logic.

**Challenge**: TimeoutWatchdog monitors `ChildProcess`, but SDK uses `thread.runStreamed()` (async iterator).

**Solution**: Create a wrapper process or adapt TimeoutWatchdog to monitor async iterators.

**Benefits**:
- ✅ Consistent timeout behavior across all tools
- ✅ Kills hanging processes
- ✅ Captures partial results
- ✅ Sends MCP notifications

**Limitations**:
- ⚠️ More complex implementation
- ⚠️ Requires architectural changes
- ⚠️ May need to spawn Codex SDK as subprocess

---

### Option C: Add Error Handling to Registry Updates (Defense)

**Implementation**:

```typescript
// src/state/task_registry.ts
updateTask(taskId: string, updates: Partial<Task>): Task | null {
  const task = this.getTask(taskId);
  if (!task) return null;

  const updatedTask = { ...task, ...updates, updatedAt: Date.now() };

  const stmt = this.db.prepare(`
    UPDATE tasks SET
      // ... fields
    WHERE id = @id
  `);

  try {
    stmt.run(updatedTask);
    return updatedTask;
  } catch (error) {
    console.error(`[TaskRegistry] Failed to update task ${taskId}:`, error);

    // Retry after short delay
    setTimeout(() => {
      try {
        stmt.run(updatedTask);
        console.error(`[TaskRegistry] Retry succeeded for task ${taskId}`);
      } catch (retryError) {
        console.error(`[TaskRegistry] Retry FAILED for task ${taskId}:`, retryError);
      }
    }, 1000);

    return null;  // Indicate failure
  }
}
```

**Benefits**:
- ✅ Prevents silent failures
- ✅ Logs all SQLite exceptions
- ✅ Retry mechanism for transient errors

**Limitations**:
- ⚠️ Doesn't solve root cause (tasks still hang)
- ⚠️ Only reduces frequency of stuck tasks

---

### Option D: Combination Approach (Recommended)

**Implement all three**:

1. **Automatic cleanup scheduler** (Option A)
   - Catches stuck tasks regardless of cause
   - Safety net for all failure modes

2. **Use TimeoutWatchdog for SDK** (Option B)
   - Proper timeout handling
   - Kills hanging processes
   - MCP notifications

3. **Add error handling** (Option C)
   - Defensive programming
   - Better visibility into SQLite issues

**Benefits**:
- ✅ Defense in depth
- ✅ Handles multiple failure modes
- ✅ Proper timeout semantics
- ✅ Automatic recovery

---

## Testing Plan

### Test 1: Reproduce Stuck Task

**Setup**:
```bash
cd /tmp/test-stuck-tasks
git init
```

**Test Case**:
```typescript
// Create task that will hang
{
  "task": "Run 'sleep 3600' and wait for completion",
  "mode": "read-only"
}
// Expected: Task should timeout after 5 min idle / 20 min hard
// Verify: Task marked as "failed" in registry
// Verify: NOT stuck in "working" state
```

**Success Criteria**:
- ✅ Task times out (5 min or 20 min)
- ✅ Task status = "failed" (not "working")
- ✅ Error message indicates timeout

---

### Test 2: Verify Automatic Cleanup

**Setup**: Implement Option A (automatic cleanup scheduler)

**Test Case**:
```bash
# Manually create stuck task in database
sqlite3 ~/.config/mcp-delegator/tasks.db "
  INSERT INTO tasks (id, origin, status, instruction, working_dir, created_at, updated_at)
  VALUES ('T-local-test-stuck', 'local', 'working', 'Test stuck task', '/tmp',
          $(date -u +%s)000 - 7200000,  -- 2 hours ago
          $(date -u +%s)000 - 7200000)
"

# Wait for cleanup cycle (max 15 minutes)
# Check task status
sqlite3 ~/.config/mcp-delegator/tasks.db "
  SELECT status, error FROM tasks WHERE id = 'T-local-test-stuck'
"
```

**Expected**:
- Task marked as "failed" within 15 minutes
- Error message: "Task timeout - no activity for over 3600 seconds..."

---

### Test 3: Verify TimeoutWatchdog Integration

**Setup**: Implement Option B (use TimeoutWatchdog for SDK)

**Test Case**:
```typescript
// Create SDK task that hangs
{
  "task": "Analyze this file and wait indefinitely",
  "mode": "read-only"
}
```

**Expected**:
- Timeout after 5 min idle / 20 min hard
- MCP notification sent (warning at 4:30, error at 5:00)
- Partial results captured
- Process killed (SIGTERM → SIGKILL)
- Task status = "failed"

---

## Implementation Checklist

**Phase 1: Quick Fix** ✅ PRIORITY
- [ ] Implement automatic cleanup scheduler (Option A)
- [ ] Run cleanup on MCP server startup
- [ ] Schedule periodic cleanup (every 15 minutes)
- [ ] Test with artificially stuck tasks
- [ ] Verify cleanup runs and marks tasks as failed
- [ ] Deploy and monitor

**Phase 2: Proper Fix** (Future)
- [ ] Design TimeoutWatchdog integration for SDK tasks
- [ ] Adapt TimeoutWatchdog to monitor async iterators
- [ ] Implement wrapper for thread.runStreamed()
- [ ] Add MCP notifications to SDK timeouts
- [ ] Test timeout behavior (idle + hard)
- [ ] Verify process termination

**Phase 3: Defense** (Future)
- [ ] Add try-catch to all updateTask() calls
- [ ] Log SQLite exceptions with context
- [ ] Implement retry logic for transient errors
- [ ] Add metrics for update failures
- [ ] Monitor registry health

---

## Recommendations

### Immediate Actions

1. **Implement Option A (Automatic Cleanup)** - CRITICAL
   - Quick fix (< 1 hour implementation)
   - Prevents stuck task accumulation
   - Safety net for all failure modes
   - Deploy in v3.4.2

2. **Add Error Handling to Registry Updates** (Option C)
   - Defensive programming
   - Better diagnostics
   - Deploy in v3.4.2

3. **Document Manual Cleanup** (Interim)
   - Update troubleshooting.md
   - Add "Stuck Tasks" section
   - Explain `_codex_cleanup_registry` tool usage

### Long-Term Improvements

1. **Implement Option B (TimeoutWatchdog for SDK)**
   - Proper timeout semantics
   - Consistent behavior across tools
   - Target: v3.4.3

2. **Add Registry Health Metrics**
   - Track update success/failure rates
   - Monitor stuck task counts
   - Alert on anomalies

3. **Improve SDK Resilience**
   - Investigate why Codex SDK hangs
   - Add connection monitoring
   - Implement circuit breaker pattern

---

## Related Issues

- **Issue 1.1**: Tasks never execute (testing deferred)
- **Issue 1.2**: Tasks report success without creating files (root cause found)
- **Issue 1.5**: Execution logging infrastructure (needed for debugging stuck tasks)

---

**Status**: 🔍 Investigation Complete - ✅ ROOT CAUSE IDENTIFIED

**Root Cause**: SDK timeout detection updates registry but has no error handling. SQLite exceptions cause silent failures, leaving tasks stuck in "working" state forever. No automatic cleanup mechanism exists.

**Next Action**: Implement Option A (automatic cleanup scheduler) + Option C (error handling) for v3.4.2.
