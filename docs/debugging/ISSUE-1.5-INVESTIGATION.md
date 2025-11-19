# Issue 1.5 Investigation: Execution Logging and Diagnostics

**Date**: 2025-11-17
**Investigator**: Claude (Sonnet 4.5)
**Status**: 🔍 Investigation Complete - ✅ ROOT CAUSE IDENTIFIED

---

## Issue Summary

**Reported Symptom**:

- No stderr/stdout from Codex execution visible to users
- No MCP server logs available
- Can't diagnose execution failures
- Silent failures with no error messages

**Evidence**: `auditor-toolkit/main/docs/codex-control-mcp-debugging.md` lines 374-385

**Impact**: Impossible to debug execution failures when tasks fail silently

**Source**: Issue 1.5 in `docs/debugging/AUDITOR-TOOLKIT-ISSUES.md` lines 144-162

---

## Code Analysis

### Discovery: Logger Infrastructure Already Exists! ✅

**File**: `src/utils/logger.ts` (162 lines)

**Created**: 2025-11-15 (per `docs/SESSION-COMPLETION-2025-11-15.md`)

**Complete Feature Set**:

```typescript
export class CodexLogger {
  private logFile: string | null;
  private logLevel: "debug" | "info" | "warn" | "error";

  constructor() {
    // Support ${PWD} variable in log file path
    this.logFile = process.env.CODEX_LOG_FILE || null;
    this.logLevel = (process.env.CODEX_LOG_LEVEL as any) || "info";
  }

  // Core logging methods
  error(message: string, meta?: any, workingDir?: string);
  warn(message: string, meta?: any, workingDir?: string);
  info(message: string, meta?: any, workingDir?: string);
  debug(message: string, meta?: any, workingDir?: string);

  // Tool-specific helpers
  toolStart(toolName: string, input: any, workingDir?: string);
  toolSuccess(toolName: string, result: any, workingDir?: string);
  toolFailure(
    toolName: string,
    error: Error | string,
    input: any,
    workingDir?: string,
  );
  toolTimeout(toolName: string, timeoutMs: number, workingDir?: string);
}

// Global singleton instance
export const globalLogger = new CodexLogger();
```

**Features**:

- ✅ Structured JSON logging (easy parsing)
- ✅ Multiple log levels (debug/info/warn/error)
- ✅ Tool-specific helpers (start/success/failure/timeout)
- ✅ Per-working-directory logs (supports `${PWD}`)
- ✅ Configurable via environment variables
- ✅ Silent fallback if logging fails
- ✅ Automatic directory creation

**Configuration** (from `.mcp.full.json`):

```json
{
  "env": {
    "CODEX_LOG_FILE": "${PWD}/.codex-errors.log",
    "CODEX_LOG_LEVEL": "debug"
  }
}
```

**Log File Location**: `.codex-errors.log` in working directory (configurable)

---

### Logger Integration Status

#### ✅ MCP Layer Integration (COMPLETE)

**File**: `src/index.ts` lines 38, 159, 190, 273, 287, 305, 311

**Logs**:

1. **Tool invocations** - Every tool call wrapped with logging
2. **Parameter validation errors** - Invalid snake_case parameters
3. **MCP server errors** - Unknown tools, invalid results
4. **Tool completion** - Success/failure with context

**Example Integration**:

```typescript
// src/index.ts - Tool call wrapper
const workingDir = (args as any)?.workingDir || process.cwd();

// Log tool start
globalLogger.toolStart(name, args, workingDir);

try {
  // Execute tool...
  const result = await tool.execute(args);

  // Log success
  globalLogger.toolSuccess(name, result, workingDir);
  return result;
} catch (error) {
  // Log failure
  globalLogger.toolFailure(name, error, args, workingDir);

  return {
    content: [
      {
        type: "text",
        text: `❌ Tool execution failed: ${error.message}\n\nCheck .codex-errors.log for full stack trace.`,
      },
    ],
    isError: true,
  };
}
```

**User-Facing Error Messages**:

- "Check .codex-errors.log for details."
- "Check .codex-errors.log for full stack trace."

**What MCP Logger Captures**:

- ✅ Tool name and input parameters
- ✅ Tool execution start time
- ✅ Tool execution end time
- ✅ Success/failure status
- ✅ Error messages with stack traces
- ✅ Process ID for correlation

---

#### ❌ Tool-Level Logging (NOT INTEGRATED)

**Problem**: Individual tools still use `console.error()` for internal logging

**Evidence**:

- `src/tools/local_exec.ts` - **36 console.error() calls**
- All `src/tools/*.ts` files - **114 total console.error() calls**
- **NO** imports of `globalLogger` in any tool file

**What's Missing from Logs**:

- ❌ Codex CLI stdout/stderr output
- ❌ JSONL event stream details
- ❌ Timeout detection events
- ❌ Background task progress updates
- ❌ SDK thread lifecycle events
- ❌ Registry update operations
- ❌ Git verification results
- ❌ Process spawning details

**Current Logging Approach** (local_exec.ts lines 91-372):

```typescript
// All logging goes to stderr (not captured by logger)
console.error("[LocalExec] Starting execution with:", {
  task,
  mode,
  workingDir,
});
console.error("[LocalExec] Input validated:", validated);
console.error("[LocalExec] Starting thread with options:", runOptions);
console.error("[LocalExec] Registered task in SQLite registry:", taskId);
console.error(`[LocalExec:${taskId}] Background execution started`);
console.error(`[LocalExec:${taskId}] Event ${eventLog.length}: ${event.type}`);
console.error(
  `[LocalExec:${taskId}] ⏱️ IDLE TIMEOUT after ${idleTimeoutMs / 1000}s`,
);
console.error(
  `[LocalExec:${taskId}] ⏱️ HARD TIMEOUT after ${hardTimeoutMs / 1000}s`,
);
console.error(`[LocalExec:${taskId}] ✅ Execution complete`);
// ... 26 more console.error() calls
```

**Issue**: These logs go to stderr but are NOT written to `.codex-errors.log`

---

## Root Cause Analysis

### The Disconnect

**User's Experience**:

1. Task fails or behaves unexpectedly
2. Error message says: "Check .codex-errors.log for details"
3. User checks log file (if CODEX_LOG_FILE configured)
4. Log shows:
   ```json
   {"timestamp":"2025-11-17T...","level":"info","message":"Tool started: _codex_local_exec","meta":{...},"pid":12345}
   {"timestamp":"2025-11-17T...","level":"error","message":"Tool failed: _codex_local_exec","meta":{...},"pid":12345}
   ```
5. **BUT**: No details about WHAT went wrong inside the tool!
6. No Codex CLI output, no timeout events, no background task progress

**Why This Happened**:

1. **Logger created on 2025-11-15** for MCP-level error tracking
2. **Integrated at MCP layer** to log tool invocations
3. **Individual tools NOT updated** to use logger internally
4. **console.error() still used** for all internal logging (goes to stderr, not log file)

**Timeline**:

- **2025-11-15**: Logger created and integrated at MCP layer
- **2025-11-16**: Auditor-toolkit reports "no execution logs" issue
- **2025-11-17**: Investigation reveals partial integration

---

### Configuration Gap

**User's MCP Config** (auditor-toolkit):

```json
{
  "mcpServers": {
    "codex-control": {
      "command": "npx",
      "args": ["-y", "@openai/mcp-codex-control@latest"]
      // ❌ NO CODEX_LOG_FILE configured
      // ❌ NO CODEX_LOG_LEVEL configured
    }
  }
}
```

**Result**:

- `globalLogger.logFile === null` (logging disabled)
- All `globalLogger.*()` calls silently no-op
- Even MCP-level events not logged

**Reference Config** (`.mcp.full.json`):

```json
{
  "env": {
    "CODEX_LOG_FILE": "${PWD}/.codex-errors.log", // ✅ Enables logging
    "CODEX_LOG_LEVEL": "debug" // ✅ Verbose logs
  }
}
```

---

## Proposed Fixes

### Option A: Integrate Logger in All Tools (Recommended)

**Implementation**: Replace `console.error()` with `globalLogger.*()` in all tools

**Benefits**:

- ✅ Comprehensive execution logs
- ✅ Structured JSON format (easy parsing)
- ✅ Per-working-directory logs
- ✅ Configurable verbosity
- ✅ Tool-specific helpers available

**Changes Required**:

#### 1. Import Logger in Each Tool

```typescript
// src/tools/local_exec.ts (and all other tools)
import { globalLogger } from "../utils/logger.js";
```

#### 2. Replace console.error() Calls

```typescript
// ❌ Before
console.error("[LocalExec] Starting execution with:", { task, mode });

// ✅ After
globalLogger.info("[LocalExec] Starting execution", { task, mode }, workingDir);
```

#### 3. Use Tool-Specific Helpers

```typescript
// Timeout events
globalLogger.toolTimeout("_codex_local_exec", idleTimeoutMs, workingDir);

// Background execution
globalLogger.debug(
  `[LocalExec:${taskId}] Background execution started`,
  {},
  workingDir,
);

// Event processing
globalLogger.debug(
  `[LocalExec:${taskId}] Processing event`,
  { type: event.type },
  workingDir,
);
```

#### 4. Log Levels Strategy

- **error**: Failures, exceptions, critical issues
- **warn**: Timeouts, deprecations, non-critical issues
- **info**: Tool start/end, major milestones
- **debug**: Detailed execution flow, events, intermediate steps

**Files to Modify** (12 tool files):

1. `src/tools/local_exec.ts` (36 calls)
2. `src/tools/local_resume.ts` (console.error calls)
3. `src/tools/local_run.ts` (console.error calls)
4. `src/tools/local_status.ts` (console.error calls)
5. `src/tools/local_results.ts` (console.error calls)
6. `src/tools/local_wait.ts` (console.error calls)
7. `src/tools/local_cancel.ts` (console.error calls)
8. `src/tools/cloud.ts` (console.error calls)
9. `src/tools/cloud_wait.ts` (console.error calls)
10. `src/tools/cloud_cancel.ts` (console.error calls)
11. `src/tools/cleanup_registry.ts` (console.error calls)
12. `src/executor/process_manager.ts` (console.error calls)

**Estimated Work**: ~2-3 hours for systematic replacement

---

### Option B: Keep MCP-Level Logging Only

**Keep**: Current MCP-layer integration (`src/index.ts`)

**Add**: Documentation explaining logging limitations

**Benefits**:

- ✅ No code changes needed
- ✅ Current MCP-level logs useful for tool invocation tracking

**Limitations**:

- ⚠️ Internal execution details still missing
- ⚠️ Can't diagnose complex failures
- ⚠️ User expectations not met ("Check .codex-errors.log for details" implies more detail than available)

**Documentation Updates**:

1. Clarify what's logged (tool invocations only, not internal details)
2. Document how to enable logging (CODEX_LOG_FILE env var)
3. Add troubleshooting section explaining stderr vs log file

---

### Option C: Hybrid Approach (Quick Win)

**Phase 1** (Quick - 30 minutes):

- ✅ Update documentation to explain logging configuration
- ✅ Add CODEX_LOG_FILE to all MCP config examples
- ✅ Clarify what's currently logged vs what's not

**Phase 2** (Medium - 2-3 hours):

- ✅ Integrate logger in highest-value tools first:
  - `local_exec.ts` - Most complex, most likely to fail
  - `cloud.ts` - Cloud submission failures hard to debug
  - `process_manager.ts` - Process spawning issues common

**Phase 3** (Later):

- ✅ Complete integration across all remaining tools

---

## Testing Plan

### Test 1: Verify Current MCP Logging

**Setup**:

```json
// .mcp.json
{
  "env": {
    "CODEX_LOG_FILE": "${PWD}/.codex-errors.log",
    "CODEX_LOG_LEVEL": "debug"
  }
}
```

**Test Case**:

```typescript
// Trigger parameter validation error
{
  "task": "Test logging",
  "working_dir": "/tmp/test"  // ❌ Wrong parameter (snake_case)
}
```

**Expected Log** (`.codex-errors.log`):

```json
{"timestamp":"2025-11-17T...","level":"info","message":"Tool started: _codex_local_run","meta":{...},"pid":12345}
{"timestamp":"2025-11-17T...","level":"error","message":"Invalid parameter used","meta":{"tool":"_codex_local_run","wrongParam":"working_dir","correctParam":"workingDir"},"pid":12345}
```

**Success Criteria**:

- ✅ Log file created at `.codex-errors.log`
- ✅ Contains tool start event
- ✅ Contains validation error with helpful context

---

### Test 2: Verify Enhanced Tool Logging (After Option A Implementation)

**Test Case**:

```typescript
{
  "task": "Run tests and fix failures",
  "mode": "workspace-write"
}
```

**Expected Log Entries** (`.codex-errors.log`):

```json
{"level":"info","message":"[LocalExec] Starting execution","meta":{"task":"Run tests...","mode":"workspace-write"},"pid":12345}
{"level":"debug","message":"[LocalExec] Input validated","meta":{"validated":{...}},"pid":12345}
{"level":"debug","message":"[LocalExec] Starting thread","meta":{"options":{...}},"pid":12345}
{"level":"info","message":"[LocalExec] Registered task","meta":{"taskId":"T-local-abc123"},"pid":12345}
{"level":"debug","message":"[LocalExec:T-local-abc123] Background execution started","pid":12345}
{"level":"debug","message":"[LocalExec:T-local-abc123] Processing event","meta":{"type":"turn.started"},"pid":12345}
{"level":"debug","message":"[LocalExec:T-local-abc123] Processing event","meta":{"type":"item.completed"},"pid":12345}
{"level":"info","message":"[LocalExec:T-local-abc123] Execution complete","meta":{"eventCount":47,"status":"completed"},"pid":12345}
```

**Success Criteria**:

- ✅ Full execution trace visible
- ✅ Events logged with timestamps
- ✅ Task ID in all log lines
- ✅ Sufficient detail for debugging

---

### Test 3: Timeout Logging

**Test Case**:

```typescript
// Task that times out
{
  "task": "sleep 600 && echo done",
  "mode": "read-only"
}
```

**Expected Log** (after 5 min idle timeout):

```json
{"level":"warn","message":"[LocalExec:T-local-xyz789] Idle timeout warning","meta":{"idleSeconds":270},"pid":12345}
{"level":"error","message":"Tool timeout: _codex_local_exec","meta":{"timeoutMs":300000},"pid":12345}
```

**Success Criteria**:

- ✅ Timeout event logged
- ✅ Warning before timeout (if implemented)
- ✅ Task ID and timing context

---

## Implementation Checklist

**Phase 1: Documentation** (Priority 1)

- [ ] Update CLAUDE.md with logging configuration
- [ ] Update quickrefs/troubleshooting.md with log file location
- [ ] Add logging section to README.md
- [ ] Update all .mcp.\*.json examples with CODEX_LOG_FILE
- [ ] Explain MCP-level vs tool-level logging

**Phase 2: High-Value Integration** (Priority 2)

- [ ] Import globalLogger in local_exec.ts
- [ ] Replace console.error() with globalLogger.\*() in local_exec.ts
- [ ] Import globalLogger in cloud.ts
- [ ] Replace console.error() with globalLogger.\*() in cloud.ts
- [ ] Import globalLogger in process_manager.ts
- [ ] Replace console.error() with globalLogger.\*() in process_manager.ts
- [ ] Test with real tasks
- [ ] Verify log output useful for debugging

**Phase 3: Complete Integration** (Future)

- [ ] Systematic replacement across all 12 tool files
- [ ] Add log level configuration to tool descriptions
- [ ] Consider log rotation for long-running servers
- [ ] Add log analysis helper tool (optional)

---

## Recommendations

### Immediate Actions (This Week)

1. **Update Documentation** (Option C Phase 1)
   - Add logging configuration to all MCP config examples
   - Explain what's logged vs what's not
   - Document CODEX_LOG_FILE and CODEX_LOG_LEVEL env vars
   - Add troubleshooting section for "no logs" issue

2. **Verify Current Logger Works** (Test 1)
   - Test with CODEX_LOG_FILE configured
   - Confirm MCP-level events are logged
   - Validate error messages reference correct log file

### Next Steps (Next Sprint)

1. **Integrate Logger in High-Value Tools** (Option C Phase 2)
   - Start with local_exec.ts (most complex)
   - Then cloud.ts and process_manager.ts
   - Test each integration thoroughly

2. **User Communication**
   - Update CHANGELOG.md with logging improvements
   - Document in quickrefs/architecture.md
   - Add to session completion notes

### Long-Term Improvements

1. **Complete Tool Integration** (Option A)
   - Systematic replacement across all tools
   - Consistent log levels and formatting
   - Comprehensive execution traces

2. **Advanced Logging Features**
   - Log rotation (prevent disk fill)
   - Log compression (save space)
   - Log analysis helper tool
   - Structured search/filter capabilities

3. **Monitoring Integration**
   - Error rate tracking
   - Performance metrics logging
   - Anomaly detection

---

## Related Issues

- **Issue 1.1**: Tasks never execute (logging would help diagnose)
- **Issue 1.2**: Tasks report success without creating files (git verification logging needed)
- **Issue 1.3**: Stuck tasks accumulation (timeout logging would show when tasks get stuck)
- **Issue 3.3**: Silent execution failures (comprehensive logging is the solution)

---

**Status**: 🔍 Investigation Complete - ✅ ROOT CAUSE IDENTIFIED

**Root Cause**: Logger infrastructure exists and is integrated at MCP layer, but individual tools still use console.error() for internal logging. User's MCP config lacked CODEX_LOG_FILE env var, so even MCP-level logging was disabled. Need to: 1) Document logging configuration, 2) Integrate logger in high-value tools.

**Next Action**:

- **Documentation**: Update all MCP configs with CODEX_LOG_FILE examples (Priority 1)
- **Code**: Integrate logger in local_exec.ts, cloud.ts, process_manager.ts (Priority 2)
- **Testing**: Verify logs useful for diagnosing real failures (Priority 2)
