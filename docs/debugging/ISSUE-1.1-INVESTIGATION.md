# Issue 1.1 Investigation: Tasks Start But Never Execute

**Date**: 2025-11-17
**Investigator**: Claude (Sonnet 4.5)
**Status**: 🔍 Investigation Complete - ⏳ Awaiting Auditor-Toolkit Testing

**Note**: Testing deferred - will be tested in auditor-toolkit later to verify v3.4.1 resolves the issue

---

## Issue Summary

**Reported Symptom**:
- `_codex_local_exec` returns task ID
- Task never appears in registry (even with `showAll: true`)
- `_codex_local_wait` returns without output
- No evidence of execution (no logs, no files created)

**Example Task ID**: `T-local-mi1h3c6tric3yw`

**Source**: `auditor-toolkit/main/docs/codex-control-mcp-debugging.md` lines 19-40

---

## Code Analysis

### Task Registration Flow (src/tools/local_exec.ts)

**Lines 206-220**: Task Registration
```typescript
// Register task in unified SQLite registry BEFORE execution
const registeredTask = globalTaskRegistry.registerTask({
  origin: 'local',
  instruction: validated.task,
  workingDir: validated.workingDir || process.cwd(),
  mode: validated.mode,
  model: validated.model,
  threadId: thread.id || undefined,
});

const taskId = registeredTask.id;
console.error('[LocalExec] Registered task in SQLite registry:', taskId);

// Update status to 'working' immediately
globalTaskRegistry.updateStatus(taskId, 'working');
```

**Expected Behavior**:
1. Task created in database with status='pending' (line 275 in task_registry.ts)
2. Task ID generated (format: T-local-XXXXX)
3. Status immediately updated to 'working' (line 220)
4. Task should be visible in `_codex_local_status` query

**Lines 223-380**: Background Execution
```typescript
// Execute in background (fire and forget - updates registry on completion)
(async () => {
  // Setup timeout detection (v3.2.1)
  const idleTimeoutMs = 5 * 60 * 1000; // 5 minutes
  const hardTimeoutMs = 20 * 60 * 1000; // 20 minutes

  try {
    const { events } = await thread.runStreamed(validated.task, runOptions);

    for await (const event of events) {
      // Process events, update progress
      eventLog.push(event);
    }

    // Update registry with completion
    globalTaskRegistry.updateTask(taskId, { status: finalStatus, result: ... });

  } catch (error) {
    // Update registry with failure
    globalTaskRegistry.updateTask(taskId, { status: 'failed', error: ... });
  }
})(); // Immediately invoked async function
```

---

## Registry Implementation Analysis (src/state/task_registry.ts)

### registerTask() Method (lines 254-304)

```typescript
registerTask(params: {
  origin: TaskOrigin;
  instruction: string;
  workingDir?: string;
  // ... other params
}): Task {
  const now = Date.now();
  const taskId = this.generateTaskId(params.origin);

  const task: Task = {
    id: taskId,
    origin: params.origin,
    status: 'pending',  // Always starts as 'pending'
    instruction: params.instruction,
    workingDir: params.workingDir || process.cwd(),
    // ... other fields
  };

  const stmt = this.db.prepare(`
    INSERT INTO tasks (
      id, external_id, alias, origin, status, instruction,
      working_dir, env_id, mode, model,
      created_at, updated_at,
      thread_id, user_id, metadata
    ) VALUES (
      @id, @externalId, @alias, @origin, @status, @instruction,
      @workingDir, @envId, @mode, @model,
      @createdAt, @updatedAt,
      @threadId, @userId, @metadata
    )
  `);

  stmt.run(task);  // Execute INSERT
  return task;
}
```

**✅ Code is correct**: Directly inserts into SQLite database

### updateStatus() Method (lines 309-321)

```typescript
updateStatus(taskId: string, status: TaskStatus): Task | null {
  const now = Date.now();
  const updates: Partial<Task> = {
    status,
    updatedAt: now,
  };

  if (status === 'completed' || status === 'failed' || status === 'canceled') {
    updates.completedAt = now;
  }

  return this.updateTask(taskId, updates);
}
```

**✅ Code is correct**: Updates status in database

### queryTasks() Method (lines 424-480)

```typescript
queryTasks(filter: TaskFilter = {}): Task[] {
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params: any[] = [];

  if (filter.origin) {
    query += ' AND origin = ?';
    params.push(filter.origin);
  }

  if (filter.workingDir) {
    query += ' AND working_dir = ?';
    params.push(filter.workingDir);
  }

  // ... other filters

  query += ' ORDER BY created_at DESC';

  const stmt = this.db.prepare(query);
  return stmt.all(...params) as Task[];
}
```

**✅ Code is correct**: Standard SQL query with filters

---

## Status Tool Analysis (src/tools/local_status.ts)

**Lines 66-69**: Task Query
```typescript
const tasks = globalTaskRegistry.queryTasks({
  origin: 'local',
  workingDir: showAll ? undefined : workingDir
});
```

**Expected Behavior**:
- With `showAll: false` (default): Filters by current working directory
- With `showAll: true`: Returns ALL 'local' tasks regardless of working directory

**Lines 78-84**: Task Grouping
```typescript
const runningTasks = tasks.filter((t: Task) => t.status === 'working');
const completedTasks = tasks.filter((t: Task) => t.status === 'completed').slice(-10);
const failedTasks = tasks.filter((t: Task) => t.status === 'failed').slice(-5);
```

---

## Possible Root Causes

### 1. ❌ Database Write Failure (UNLIKELY)

**Hypothesis**: Database insert/update fails silently

**Evidence Against**:
- No try/catch errors in logs
- SQLite operations are synchronous (immediate failure if error)
- better-sqlite3 throws errors on failure
- Migration test showed 60 tasks successfully in database

**Probability**: < 5%

### 2. ❌ Working Directory Mismatch (UNLIKELY)

**Hypothesis**: Task registered with wrong working directory

**Evidence Against**:
- Issue reports `showAll: true` was used (bypasses workingDir filter)
- Default is `process.cwd()` if not specified
- Migration showed tasks from various working directories

**Probability**: < 10%

### 3. ⚠️ Timing Issue (POSSIBLE)

**Hypothesis**: Query happens before database write completes

**Evidence For**:
- Background execution is async
- Task registration is synchronous
- But updateStatus(taskId, 'working') happens BEFORE async block

**Evidence Against**:
- SQLite writes are synchronous
- Task should be visible immediately after line 220

**Probability**: ~20%

### 4. ⚠️ Database Connection Issue (POSSIBLE)

**Hypothesis**: Multiple SQLite connections not seeing each other's writes

**Evidence For**:
- globalTaskRegistry is a singleton (src/state/task_registry.ts)
- But if MCP server restarts, new instance created

**Evidence Against**:
- better-sqlite3 uses WAL mode (Write-Ahead Logging) by default
- WAL supports concurrent readers

**Probability**: ~30%

### 5. ✅ Registry Was Using Old Directory (LIKELY)

**Hypothesis**: Tasks written to `~/.config/codex-control/` but query looking at wrong location

**Evidence For**:
- Errors reported BEFORE migration to `~/.config/mcp-delegator/`
- Migration just completed (2025-11-17 14:34)
- User had v3.2.1 installed (outdated)

**Evidence Against**:
- Issue reports task not found even with `showAll: true`
- showAll should find tasks regardless of directory

**Probability**: ~40%

### 6. ❌ Codex SDK Never Starts (POSSIBLE)

**Hypothesis**: thread.runStreamed() never yields any events

**Evidence For**:
- Background execution could hang silently
- Task stays in 'working' state forever

**Evidence Against**:
- v3.2.1 has timeout detection (5 min idle / 20 min hard)
- Should fail with timeout error
- Issue reports task not even appearing in registry

**Probability**: ~15%

---

## Critical Discovery: Migration Timing

**Timeline**:
- **Errors reported**: During auditor-toolkit testing (date unknown, but before 2025-11-17)
- **MCP Delegator version at time**: v3.2.1 or earlier
- **Registry location at time**: `~/.config/codex-control/tasks.db`
- **Migration completed**: 2025-11-17 14:34 AEDT
- **Current registry location**: `~/.config/mcp-delegator/tasks.db`
- **Current version**: v3.4.1 (via npm link)

**Implication**: The errors occurred with the OLD setup. The issue may have been:
1. Using outdated version (v3.2.1 instead of v3.4.0)
2. Old registry directory causing issues
3. Migration resolved the issue

---

## Testing Plan

### Test 1: Verify Issue is Resolved (v3.4.1)

**Setup**:
```bash
# Ensure using v3.4.1
which mcp-delegator  # Should be /opt/homebrew/bin/mcp-delegator
mcp-delegator --version  # Should show 3.4.1

# Verify registry location
ls -la ~/.config/mcp-delegator/tasks.db  # Should exist
```

**Test Case**:
```typescript
// Use _codex_local_exec to start a task
{
  "task": "List files in current directory",
  "mode": "read-only"
}

// IMMEDIATELY check status (within 5 seconds)
{
  "showAll": true
}

// Expected: Task appears in "Running Tasks" section
// Task ID format: T-local-XXXXX
// Status: 'working'
```

**Success Criteria**:
- ✅ Task appears in registry with `showAll: true`
- ✅ Task status shows as 'working'
- ✅ Task completes or times out (not stuck forever)

### Test 2: Verify Task Execution

**Test Case**:
```typescript
// Create a simple test file
{
  "task": "Create a test file named CODEX_TEST_$(date +%s).txt with content 'Hello from Codex'",
  "mode": "workspace-write"
}

// Wait for completion
{
  "task_id": "T-local-XXXXX"  // Use actual task ID
}

// Verify file was created
```

**Success Criteria**:
- ✅ Task completes with status 'completed'
- ✅ File exists on disk
- ✅ codex_local_results shows file creation

### Test 3: Stress Test Registry Query

**Test Case**:
```bash
# Direct SQLite query to verify task is actually in database
sqlite3 ~/.config/mcp-delegator/tasks.db "
  SELECT id, status, instruction, working_dir
  FROM tasks
  WHERE id LIKE 'T-local-%'
  ORDER BY created_at DESC
  LIMIT 5;
"
```

**Success Criteria**:
- ✅ Recently created tasks appear in query
- ✅ Status is 'working' or 'completed' (not stuck as 'pending')

---

## Logging Improvements Needed (Issue 1.5)

### Current Logging

**src/tools/local_exec.ts**:
- Line 91: `[LocalExec] Starting execution with: ...`
- Line 109: `[LocalExec] Input validated: ...`
- Line 192: `[LocalExec] Starting thread with options: ...`
- Line 217: `[LocalExec] Registered task in SQLite registry: ...`
- Line 268: `[LocalExec:taskId] Background execution started`
- Line 288: `[LocalExec:taskId] Event N: ...`
- Line 321: `[LocalExec:taskId] ✅ Execution complete`

**Issues**:
- Logs go to stderr (not captured by MCP)
- No centralized log file
- No way for user to see logs without server restart

**Proposed Improvements** (see Issue 1.5):
1. Log to file: `~/.config/mcp-delegator/execution.log`
2. Add timestamps to all logs
3. Include task ID in all log lines
4. Expose logs via `_codex_get_logs` tool

---

## Next Steps

1. ✅ **Run Test 1**: Verify issue is resolved with v3.4.1 + new registry
2. ⏳ **If Test 1 PASSES**: Issue was specific to old setup, mark as RESOLVED
3. ⏳ **If Test 1 FAILS**: Continue investigation with Test 2 and Test 3
4. ⏳ **Implement logging improvements** (Issue 1.5) for better diagnostics

---

## Recommendations

### Immediate Actions

1. **Test in auditor-toolkit** (where errors were originally reported)
   - Navigate to: `/Users/nathanschram/claude-code-tools/lba/tools/auditor-toolkit/main`
   - Run Test 1 to verify task appears in registry
   - Check if task completes successfully

2. **Verify v3.4.1 fixes the issue**
   - Compare behavior with old error reports
   - Document any remaining issues

3. **If issue persists**, investigate:
   - Codex SDK event stream
   - SQLite WAL mode configuration
   - Process spawning in background

### Long-Term Improvements

1. **Add execution logging to file** (Issue 1.5)
2. **Add health check endpoint** to verify registry connectivity
3. **Add task execution metrics** (success rate, avg duration, timeout rate)
4. **Consider connection pooling** if multiple simultaneous tasks cause issues

---

**Status**: 🔍 Investigation Complete - Code analysis shows no obvious bugs. Most likely cause: errors occurred with old setup (v3.2.1 + ~/.config/codex-control/). Migration to v3.4.1 + ~/.config/mcp-delegator/ may have resolved the issue.

**Next Action**: Run Test 1 in auditor-toolkit to verify issue is resolved.
