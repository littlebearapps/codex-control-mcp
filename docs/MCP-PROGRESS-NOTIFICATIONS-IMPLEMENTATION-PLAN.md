# MCP Progress Notifications - Comprehensive Implementation Plan

**Version**: 3.5.0
**Feature**: Add MCP `notifications/progress` to all execution tools
**Impact**: Transform async UX - tasks visible in Claude Code status bar
**Created**: 2025-11-17

---

## Executive Summary

### What We're Building

Add real-time progress notifications to all 4 execution tools so that:
- Users see running Codex tasks in Claude Code's status bar (blue notification area)
- Claude Code can work on other tasks while Codex runs (non-blocking)
- Tasks disappear from status bar when complete (clear completion signal)
- No manual polling needed (server pushes updates)

### Affected Tools (4 of 13)

| Tool | Current State | After Implementation |
|------|--------------|---------------------|
| `_codex_local_run` | Silent execution, blocks until complete | Progress notifications every 30s |
| `_codex_local_exec` | Database updates every 10 events, silent | Progress notifications every 10 events |
| `_codex_local_resume` | Database updates every 10 events, silent | Progress notifications every 10 events |
| `_codex_cloud_submit` | Silent submission, returns immediately | Initial notification on submission |

### Tools NOT Changed (9 of 13)

These are query/retrieval tools that complete instantly:
- `_codex_local_status` (query)
- `_codex_local_results` (retrieval)
- `_codex_local_cancel` (instant)
- `_codex_cloud_status` (query)
- `_codex_cloud_results` (retrieval)
- `_codex_cloud_cancel` (instant)
- `_codex_cloud_list_environments` (instant)
- `_codex_cloud_github_setup` (instant)
- `_codex_cleanup_registry` (relatively quick)

---

## Technical Architecture

### MCP Progress Notification Format

```typescript
{
  "jsonrpc": "2.0",
  "method": "notifications/progress",
  "params": {
    "progressToken": string | number,  // Task ID (e.g., "T-local-abc123")
    "progress": number,                // Current progress (completed steps)
    "total": number | undefined,       // Total steps (optional)
    "message": string | undefined      // Human-readable status
  }
}
```

### How to Send Notifications

MCP request handlers receive an `extra` parameter with `sendNotification`:

```typescript
async execute(
  input: ToolInput,
  extra: RequestHandlerExtra<Request, Notification>
): Promise<ToolResult> {
  // Send notification
  await extra.sendNotification({
    method: 'notifications/progress' as const,
    params: {
      progressToken: taskId,
      progress: 50,
      total: 100,
      message: "Processing step 50/100"
    }
  });
}
```

### Notification Frequency Strategy

| Tool | Frequency | Rationale |
|------|-----------|-----------|
| `_codex_local_run` | Every 30 seconds | CLI execution, no JSONL events |
| `_codex_local_exec` | Every 10 events | SDK execution with real-time events |
| `_codex_local_resume` | Every 10 events | SDK execution with real-time events |
| `_codex_cloud_submit` | Once on submission | Background execution, no further updates |

### Error Handling Strategy

**Principle**: Notification failures should NEVER break tool execution

```typescript
try {
  await extra.sendNotification({...});
} catch (error) {
  // Log error but continue execution
  console.error(`[Tool] Failed to send progress notification:`, error);
  // Task continues normally
}
```

---

## File-by-File Implementation

### 1. Update Tool Signatures (All 4 Tools)

**Challenge**: Current tools don't receive `RequestHandlerExtra` parameter

**Current signature**:
```typescript
async execute(input: ToolInput): Promise<ToolResult>
```

**New signature**:
```typescript
async execute(
  input: ToolInput,
  extra?: RequestHandlerExtra<Request, Notification>
): Promise<ToolResult>
```

**Why optional?**: Backward compatibility for tests and internal calls

---

### 2. File: `src/tools/local_run.ts`

**Current**: Process manager spawns Codex CLI, no progress visibility

**Changes needed**:

#### A. Update execute signature

```typescript
// Line ~23
async execute(
  input: LocalRunToolInput,
  extra?: RequestHandlerExtra<Request, Notification>  // NEW
): Promise<LocalRunToolResult> {
```

#### B. Pass notification callback to ProcessManager

```typescript
// Line ~75 (after spawning process)
const result = await this.processManager.runCodexTask(
  taskId,
  args,
  {
    onProgress: async (progress) => {  // NEW callback
      if (extra?.sendNotification) {
        try {
          await extra.sendNotification({
            method: 'notifications/progress' as const,
            params: {
              progressToken: taskId,
              progress: progress.elapsed,  // Elapsed seconds
              total: undefined,  // Unknown total time
              message: `Codex executing (${progress.elapsed}s elapsed)`
            }
          });
        } catch (error) {
          console.error(`[LocalRun:${taskId}] Progress notification failed:`, error);
        }
      }
    }
  }
);
```

#### C. Send final completion notification

```typescript
// Line ~120 (after task completes)
if (extra?.sendNotification) {
  try {
    await extra.sendNotification({
      method: 'notifications/progress' as const,
      params: {
        progressToken: taskId,
        progress: 100,
        total: 100,
        message: "Codex execution complete"
      }
    });
  } catch (error) {
    console.error(`[LocalRun:${taskId}] Final notification failed:`, error);
  }
}
```

**Estimated changes**: ~30 lines added

---

### 3. File: `src/executor/process_manager.ts`

**Current**: Manages process spawning and JSONL parsing, no progress callbacks

**Changes needed**:

#### A. Add progress callback option

```typescript
// Line ~30 (after ProcessStats interface)
export interface ProcessOptions {
  onProgress?: (progress: { elapsed: number }) => Promise<void>;
}
```

#### B. Update runCodexTask signature

```typescript
// Line ~120
async runCodexTask(
  taskId: string,
  args: string[],
  options?: ProcessOptions  // NEW
): Promise<CodexResult> {
```

#### C. Send progress notifications every 30 seconds

```typescript
// Line ~180 (inside runCodexTask, after process spawn)
const startTime = Date.now();
let progressInterval: NodeJS.Timeout | undefined;

if (options?.onProgress) {
  progressInterval = setInterval(async () => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    try {
      await options.onProgress!({ elapsed });
    } catch (error) {
      console.error('[ProcessManager] Progress callback error:', error);
    }
  }, 30000); // Every 30 seconds
}

// ... existing process execution code ...

// Line ~250 (cleanup)
if (progressInterval) {
  clearInterval(progressInterval);
}
```

**Estimated changes**: ~40 lines added

---

### 4. File: `src/tools/local_exec.ts`

**Current**: Updates database every 10 events, no MCP notifications

**Changes needed**:

#### A. Update execute signature

```typescript
// Line ~50
async execute(
  input: LocalExecInput,
  extra?: RequestHandlerExtra<Request, Notification>  // NEW
): Promise<LocalExecResult> {
```

#### B. Send progress notifications when updating database

```typescript
// Line ~314-326 (where progress is updated every 10 events)
if (eventCount % 10 === 0) {
  const progress = progressEngine.getProgress();
  globalTaskRegistry.updateProgress(taskId, progress);

  // NEW: Send MCP notification
  if (extra?.sendNotification) {
    try {
      await extra.sendNotification({
        method: 'notifications/progress' as const,
        params: {
          progressToken: taskId,
          progress: progress.completedSteps,
          total: progress.totalSteps,
          message: progress.currentAction || `${progress.progressPercentage}% complete`
        }
      });
    } catch (error) {
      console.error(`[LocalExec:${taskId}] Progress notification failed:`, error);
    }
  }
}
```

#### C. Send final completion notification

```typescript
// Line ~323 (after final progress update)
const finalProgress = progressEngine.getProgress();
globalTaskRegistry.updateProgress(taskId, finalProgress);

// NEW: Send final notification
if (extra?.sendNotification) {
  try {
    await extra.sendNotification({
      method: 'notifications/progress' as const,
      params: {
        progressToken: taskId,
        progress: finalProgress.totalSteps,
        total: finalProgress.totalSteps,
        message: "Codex SDK execution complete"
      }
    });
  } catch (error) {
    console.error(`[LocalExec:${taskId}] Final notification failed:`, error);
  }
}
```

**Estimated changes**: ~35 lines added

---

### 5. File: `src/tools/local_resume.ts`

**Current**: Similar to local_exec, updates database every 10 events

**Changes needed**: IDENTICAL to `local_exec.ts` changes

#### A. Update execute signature

```typescript
// Line ~45
async execute(
  input: LocalResumeInput,
  extra?: RequestHandlerExtra<Request, Notification>  // NEW
): Promise<LocalResumeResult> {
```

#### B. Send progress notifications every 10 events

```typescript
// Same pattern as local_exec.ts
```

#### C. Send final completion notification

```typescript
// Same pattern as local_exec.ts
```

**Estimated changes**: ~35 lines added

---

### 6. File: `src/tools/cloud.ts`

**Current**: CloudSubmitTool submits task silently, returns task ID

**Changes needed**:

#### A. Update CloudSubmitTool execute signature

```typescript
// Line ~25
async execute(
  input: CloudSubmitInput,
  extra?: RequestHandlerExtra<Request, Notification>  // NEW
): Promise<CloudSubmitResult> {
```

#### B. Send initial notification after submission

```typescript
// Line ~80 (after task submission succeeds)
const taskId = /* extract from Codex Cloud response */;

// NEW: Send notification that task is running in background
if (extra?.sendNotification) {
  try {
    await extra.sendNotification({
      method: 'notifications/progress' as const,
      params: {
        progressToken: taskId,
        progress: 0,
        total: 100,
        message: `Codex Cloud task submitted - running in background (${taskId})`
      }
    });
  } catch (error) {
    console.error(`[CloudSubmit:${taskId}] Progress notification failed:`, error);
  }
}
```

**Note**: Cloud tasks run independently, so we only send ONE notification on submission. Users check status via Web UI or `_codex_cloud_status`.

**Estimated changes**: ~20 lines added

---

### 7. File: `src/index.ts` (MCP Server)

**Current**: Tool handlers don't pass `extra` parameter to tool execute methods

**Changes needed**:

#### A. Update CallToolRequest handler to pass extra

```typescript
// Line ~145 (CallToolRequestSchema handler)
this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {  // Add extra param
  const { name, arguments: args } = request.params;

  // ... existing validation code ...

  try {
    let result;

    switch (name) {
      case '_codex_local_run':
        result = await this.localRunTool.execute(args as any, extra) as any;  // Pass extra
        break;

      case '_codex_local_exec':
        result = await this.localExecTool.execute(args as any, extra) as any;  // Pass extra
        break;

      case '_codex_local_resume':
        result = await this.localResumeTool.execute(args as any, extra) as any;  // Pass extra
        break;

      case '_codex_cloud_submit':
        result = await this.cloudSubmitTool.execute(args as any, extra) as any;  // Pass extra
        break;

      // Other tools don't need extra (instant operations)
      case '_codex_local_status':
        result = await this.localStatusTool.execute(args as any) as any;
        break;

      // ... rest of tools unchanged ...
    }

    // ... existing result handling ...
  }
});
```

**Estimated changes**: ~10 lines modified

---

### 8. File: `src/types.ts` (NEW - Type Definitions)

**Create new file** for shared type definitions:

```typescript
/**
 * Shared type definitions for MCP progress notifications
 */

import type { Request, Notification } from '@modelcontextprotocol/sdk/types.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

/**
 * Extended tool execute signature with MCP notification support
 */
export type ToolExecuteExtra = RequestHandlerExtra<Request, Notification>;

/**
 * Helper function to send progress notification with error handling
 */
export async function sendProgressNotification(
  extra: ToolExecuteExtra | undefined,
  params: {
    progressToken: string;
    progress: number;
    total?: number;
    message?: string;
  },
  context: string  // For logging (e.g., "LocalExec:T-local-abc123")
): Promise<void> {
  if (!extra?.sendNotification) {
    return; // No notification capability
  }

  try {
    await extra.sendNotification({
      method: 'notifications/progress' as const,
      params
    });
  } catch (error) {
    console.error(`[${context}] Progress notification failed:`, error);
    // Don't throw - notification failures should never break execution
  }
}
```

**Estimated changes**: ~40 lines added (new file)

---

### 9. Refactor: Use Helper Function (All 4 Tools)

**Instead of duplicating try/catch blocks**, import and use helper:

```typescript
import { sendProgressNotification } from '../types.js';

// In local_exec.ts (line ~320)
if (eventCount % 10 === 0) {
  const progress = progressEngine.getProgress();
  globalTaskRegistry.updateProgress(taskId, progress);

  // Send notification using helper
  await sendProgressNotification(
    extra,
    {
      progressToken: taskId,
      progress: progress.completedSteps,
      total: progress.totalSteps,
      message: progress.currentAction || `${progress.progressPercentage}% complete`
    },
    `LocalExec:${taskId}`
  );
}
```

**Estimated changes**: ~5 lines per notification call (cleaner code)

---

## Testing Plan

### Unit Tests (New File: `test-progress-notifications.ts`)

```typescript
import { sendProgressNotification } from './src/types.js';

describe('Progress Notifications', () => {
  it('should send notification with all params', async () => {
    let captured: any = null;

    const mockExtra = {
      sendNotification: async (notification: any) => {
        captured = notification;
      }
    };

    await sendProgressNotification(
      mockExtra as any,
      {
        progressToken: 'T-local-test123',
        progress: 50,
        total: 100,
        message: 'Test progress'
      },
      'TestContext'
    );

    expect(captured).toEqual({
      method: 'notifications/progress',
      params: {
        progressToken: 'T-local-test123',
        progress: 50,
        total: 100,
        message: 'Test progress'
      }
    });
  });

  it('should handle missing extra gracefully', async () => {
    await sendProgressNotification(
      undefined,
      {
        progressToken: 'T-local-test123',
        progress: 50
      },
      'TestContext'
    );
    // Should not throw
  });

  it('should handle notification errors gracefully', async () => {
    const mockExtra = {
      sendNotification: async () => {
        throw new Error('Network failure');
      }
    };

    await sendProgressNotification(
      mockExtra as any,
      {
        progressToken: 'T-local-test123',
        progress: 50
      },
      'TestContext'
    );
    // Should not throw - just log error
  });
});
```

### Integration Tests

**Test 1: local_run with progress notifications**

```bash
# Start MCP server
node dist/index.js

# In Claude Code, run:
Use mcp delegator to run a simple test that takes 2 minutes

# Verify:
# - Status bar shows "Codex executing (30s elapsed)"
# - Updates every 30 seconds
# - Disappears when complete
```

**Test 2: local_exec with progress notifications**

```bash
# In Claude Code:
Use mcp delegator to analyze the codebase with real-time progress

# Verify:
# - Status bar shows "67% complete (4/6 steps)"
# - Updates every 10 events
# - Shows current action
# - Disappears when complete
```

**Test 3: cloud_submit with initial notification**

```bash
# In Claude Code:
Use mcp delegator to run tests in the cloud

# Verify:
# - Status bar shows "Codex Cloud task submitted - running in background (task-2025-11-17-xyz)"
# - Notification appears once
# - Task runs independently in cloud
```

**Test 4: Multiple concurrent tasks**

```bash
# In Claude Code:
Start 3 Codex tasks simultaneously

# Verify:
# - All 3 tasks show in status bar
# - Each updates independently
# - Each disappears when its task completes
```

---

## Documentation Updates

### 1. Update `quickrefs/tools.md`

**Section to add** (after "Usage Examples"):

```markdown
## Progress Visibility

All execution tools send real-time progress notifications to Claude Code:

**Where you'll see it**: Blue status notification area at bottom of Claude Code window

**What you'll see**:
- `_codex_local_run`: "Codex executing (45s elapsed)" (updates every 30s)
- `_codex_local_exec`: "67% complete - Analyzing security module" (updates every 10 events)
- `_codex_local_resume`: "3/5 steps complete - Refactoring API" (updates every 10 events)
- `_codex_cloud_submit`: "Codex Cloud task submitted (T-cloud-abc123)" (one notification)

**When it disappears**: Task is complete! Use `_codex_local_results` to get output.

**Benefits**:
- ✅ Know what's running without asking
- ✅ See progress without polling
- ✅ Know when tasks complete (notification disappears)
- ✅ Claude Code can work on other things while Codex runs
```

### 2. Update `README.md`

**Add to "Key Features" section**:

```markdown
### Real-Time Progress Visibility 📊

See exactly what Codex is doing via Claude Code's status bar:

- **Local execution**: Live progress updates every 10-30 seconds
- **Cloud execution**: Submission confirmation with task ID
- **Non-blocking**: Claude Code can work on other tasks while Codex runs
- **Clear completion**: Status notification disappears when task completes

**Example**: Run tests via `_codex_local_exec` → See "Running tests (67% - 4/6 steps)" → Notification disappears → Results ready!
```

### 3. Update `CHANGELOG.md`

```markdown
## [3.5.0] - 2025-11-17

### Added

#### Real-Time Progress Notifications 📊

**What's New**:
- All 4 execution tools now send MCP `notifications/progress` to Claude Code
- Running Codex tasks appear in Claude Code's status bar (blue notification area)
- Progress updates sent automatically (every 10-30 seconds depending on tool)
- Notifications disappear when tasks complete (clear completion signal)

**Affected Tools**:
- `_codex_local_run`: Progress notifications every 30 seconds
- `_codex_local_exec`: Progress notifications every 10 events
- `_codex_local_resume`: Progress notifications every 10 events
- `_codex_cloud_submit`: Initial notification on submission

**User Benefits**:
- ✅ **Visibility**: See running tasks without asking
- ✅ **Non-blocking**: Claude Code can work on other things while Codex runs
- ✅ **Clear completion**: Task disappears from status bar when done
- ✅ **No polling**: Server pushes updates automatically

**Technical Details**:
- Implements MCP `notifications/progress` protocol
- Error handling: Notification failures never break tool execution
- Backward compatible: Tools work with or without notification support
- Helper function: `sendProgressNotification()` for consistent error handling

**Example UX**:
```
User: "use mcp delegator to run tests"
  ↓
Status bar shows: "🔄 Codex: Running tests (67% - 4/6 steps)"
  ↓
Claude Code continues working on other tasks
  ↓
Status bar notification disappears (tests complete)
  ↓
Claude Code: "Tests completed! 45 passed, 2 failed. Here are the failures..."
```

**Files Modified**:
- `src/tools/local_run.ts`: Added progress notifications
- `src/tools/local_exec.ts`: Added progress notifications
- `src/tools/local_resume.ts`: Added progress notifications
- `src/tools/cloud.ts`: Added initial notification
- `src/executor/process_manager.ts`: Added progress callback support
- `src/index.ts`: Pass `extra` parameter to tool handlers
- `src/types.ts`: NEW - Shared helper function for notifications
```

### 4. Update `quickrefs/architecture.md`

**Add new section** "Progress Notifications":

```markdown
## Progress Notifications

### MCP Protocol Integration

All execution tools send `notifications/progress` to Claude Code during long-running operations:

**Notification Format**:
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/progress",
  "params": {
    "progressToken": "T-local-abc123",
    "progress": 50,
    "total": 100,
    "message": "Processing step 50/100"
  }
}
```

**Notification Flow**:
```
1. User requests Codex task
   ↓
2. Tool starts execution
   ↓
3. Tool sends initial progress notification (0%)
   ↓
4. Claude Code displays in status bar
   ↓
5. Tool sends periodic updates (30s or 10 events)
   ↓
6. Status bar updates automatically
   ↓
7. Tool sends final notification (100%)
   ↓
8. Status bar notification disappears
```

**Error Handling**:
- Notification failures are caught and logged
- Tool execution continues normally (non-fatal)
- Uses helper function `sendProgressNotification()` for consistency
```

---

## Version Planning

### v3.5.0 Release Checklist

**Pre-Release**:
- [ ] Implement all 4 tool modifications
- [ ] Create `src/types.ts` with helper function
- [ ] Update `src/index.ts` to pass `extra` parameter
- [ ] Add unit tests for progress notifications
- [ ] Run integration tests with Claude Code
- [ ] Update all documentation files

**Documentation**:
- [ ] Update `README.md`
- [ ] Update `CHANGELOG.md`
- [ ] Update `quickrefs/tools.md`
- [ ] Update `quickrefs/architecture.md`
- [ ] Update `quickrefs/workflows.md` (async pattern section)

**Testing**:
- [ ] Test `_codex_local_run` notifications
- [ ] Test `_codex_local_exec` notifications
- [ ] Test `_codex_local_resume` notifications
- [ ] Test `_codex_cloud_submit` notification
- [ ] Test multiple concurrent tasks
- [ ] Test notification error handling
- [ ] Test backward compatibility (tools without `extra`)

**Version Updates**:
- [ ] Update `package.json`: `3.4.2` → `3.5.0`
- [ ] Update `src/index.ts` line 53: `SERVER_VERSION = '3.5.0'`
- [ ] Update `config.json` line 2: `"version": "3.5.0"`
- [ ] Update `CLAUDE.md` line 3: `**Version**: 3.5.0`

**Build & Publish**:
- [ ] Run `npm run build`
- [ ] Test locally with `npm link`
- [ ] Commit with message: `feat: add MCP progress notifications for real-time task visibility`
- [ ] Push to GitHub (triggers semantic-release)
- [ ] Verify npm publish succeeds
- [ ] Test published package in fresh environment

---

## Implementation Sequence

### Phase 1: Core Infrastructure (2 hours)

1. **Create helper function** (`src/types.ts`)
   - Implement `sendProgressNotification()`
   - Add type definitions
   - Add error handling
   - Write unit tests

2. **Update MCP server** (`src/index.ts`)
   - Modify `CallToolRequestSchema` handler
   - Pass `extra` parameter to 4 execution tools
   - Test handler receives `extra` correctly

3. **Update ProcessManager** (`src/executor/process_manager.ts`)
   - Add `ProcessOptions` interface
   - Add progress callback support
   - Implement 30-second interval for progress updates
   - Test callback invocation

### Phase 2: Tool Implementation (3 hours)

4. **Update `local_run.ts`**
   - Update execute signature
   - Pass callback to ProcessManager
   - Send final notification
   - Test notifications appear in logs

5. **Update `local_exec.ts`**
   - Update execute signature
   - Send notifications every 10 events
   - Send final notification
   - Test with real Codex SDK execution

6. **Update `local_resume.ts`**
   - Same changes as `local_exec.ts`
   - Test thread resumption with notifications

7. **Update `cloud.ts`**
   - Update CloudSubmitTool signature
   - Send initial notification on submission
   - Test cloud submission

### Phase 3: Testing & Documentation (2 hours)

8. **Unit tests**
   - Test helper function
   - Test error handling
   - Test backward compatibility

9. **Integration tests**
   - Test with real Claude Code
   - Verify status bar visibility
   - Test multiple concurrent tasks

10. **Documentation updates**
    - Update all 4 documentation files
    - Update CHANGELOG
    - Update version numbers

### Phase 4: Release (1 hour)

11. **Build and test**
    - Build TypeScript
    - Test with npm link
    - Verify all notifications work

12. **Publish**
    - Commit with conventional commit message
    - Push to GitHub
    - Verify semantic-release publishes v3.5.0
    - Test published package

**Total estimated time**: 8 hours

---

## Code Size Estimate

| File | Lines Added | Lines Modified |
|------|-------------|----------------|
| `src/types.ts` (NEW) | ~40 | 0 |
| `src/index.ts` | ~5 | ~10 |
| `src/executor/process_manager.ts` | ~40 | ~5 |
| `src/tools/local_run.ts` | ~30 | ~5 |
| `src/tools/local_exec.ts` | ~35 | ~5 |
| `src/tools/local_resume.ts` | ~35 | ~5 |
| `src/tools/cloud.ts` | ~20 | ~5 |
| **TOTAL** | **~205 lines** | **~35 lines** |

**Net change**: +240 lines of production code (~2% codebase increase)

---

## Risk Assessment

### Low Risks ✅

- **Backward compatibility**: `extra` parameter is optional, existing tests continue to work
- **Error handling**: Notification failures don't break tool execution
- **Performance**: Notifications sent at reasonable intervals (10-30s)
- **Type safety**: TypeScript enforces correct notification format

### Medium Risks ⚠️

- **MCP SDK version**: Ensure SDK version supports `notifications/progress` (verified ✅)
- **Claude Code support**: Assume Claude Code displays notifications correctly (needs testing)
- **Concurrent tasks**: Multiple tasks sending notifications simultaneously (should be fine)

### Mitigation Strategies

1. **Test with Claude Code first**: Verify notifications appear in status bar
2. **Graceful degradation**: If `extra` is undefined, tools work normally (silent mode)
3. **Error logging**: All notification failures logged for debugging
4. **Integration tests**: Test with real Claude Code before release

---

## Success Metrics

**After v3.5.0 release, we should observe**:

1. ✅ **Users see running tasks** in Claude Code status bar
2. ✅ **No blocking behavior** - Claude Code can work during Codex execution
3. ✅ **Clear completion signal** - notifications disappear when tasks complete
4. ✅ **No errors** - notification failures don't break tools
5. ✅ **Positive feedback** - users report better async UX

---

## Next Steps

**Ready to implement**:
1. Start with Phase 1 (helper function + infrastructure)
2. Build incrementally with testing at each step
3. Verify with Claude Code integration tests
4. Document and release v3.5.0

**Questions to resolve**:
- Should we implement this for v3.5.0 or defer to later?
- Any changes to the notification frequency (30s / 10 events)?
- Should cloud tasks send periodic updates (if possible)?

---

**Status**: ✅ Plan Complete - Ready for Implementation
