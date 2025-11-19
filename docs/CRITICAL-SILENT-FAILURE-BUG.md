# CRITICAL: Silent Failure Bug & Logging Solutions

**Date**: 2025-11-15
**Severity**: CRITICAL
**Status**: ACTIVE BUG

---

## Bug Description

### Symptom

`mcp__mcp-delegator___codex_local_run` returns "Tool ran without output or errors" with NO:

- Task execution
- Error messages
- Output
- Task registry entry
- Git operations performed

### Impact

**Claude Code has ZERO visibility** into the failure. From Claude Code's perspective:

- Tool appears to succeed (no error)
- No output to display
- No way to detect the issue
- No way to retry or debug

### Reproduction

```typescript
// Call this:
mcp__mcp -
  delegator___codex_local_run({
    task: "Create a new branch called 'feature/test'",
    working_dir: "/tmp/mcp-delegator-test",
    mode: "workspace-write",
    confirm: true,
  });

// Result: "Tool ran without output or errors"
// Expected: Success message with git operations performed
// Actual: Complete silence, no branch created
```

### Root Cause (Hypothesis)

1. **MCP server exception** - Uncaught exception in tool execution
2. **Process hang** - process_manager.execute() hangs indefinitely
3. **Invalid working directory** - Tool fails silently on path validation
4. **Authentication failure** - Codex auth fails without error propagation

---

## Required Solutions

### Solution 1: Comprehensive Logging

#### A. Per-Directory Error Logs

**Proposed MCP Configuration**:

```json
{
  "mcp-delegator": {
    "command": "mcp-delegator",
    "env": {
      "CODEX_MAX_CONCURRENCY": "2",
      "CODEX_LOG_FILE": "${PWD}/.codex-errors.log",
      "CODEX_LOG_LEVEL": "debug"
    }
  }
}
```

**Benefits**:

- ✅ Claude Code can read `.codex-errors.log` directly
- ✅ Easy to find (in current working directory)
- ✅ Per-project isolation
- ✅ Can be gitignored

**Implementation** (`src/utils/logger.ts`):

```typescript
import fs from "fs";
import path from "path";

export class CodexLogger {
  private logFile: string | null;
  private logLevel: "debug" | "info" | "warn" | "error";

  constructor() {
    this.logFile = process.env.CODEX_LOG_FILE || null;
    this.logLevel = (process.env.CODEX_LOG_LEVEL as any) || "info";
  }

  private write(level: string, message: string, meta?: any) {
    if (!this.logFile) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      meta: meta || {},
      pid: process.pid,
    };

    const logLine = JSON.stringify(logEntry) + "\n";

    try {
      // Resolve ${PWD} in log file path
      const resolvedPath = this.logFile.replace("${PWD}", process.cwd());
      fs.appendFileSync(resolvedPath, logLine);
    } catch (err) {
      // Silent failure - can't log if logging fails
      console.error("Failed to write log:", err);
    }
  }

  error(message: string, meta?: any) {
    this.write("error", message, meta);
    console.error(`[ERROR] ${message}`, meta);
  }

  warn(message: string, meta?: any) {
    if (["debug", "info", "warn"].includes(this.logLevel)) {
      this.write("warn", message, meta);
    }
  }

  info(message: string, meta?: any) {
    if (["debug", "info"].includes(this.logLevel)) {
      this.write("info", message, meta);
    }
  }

  debug(message: string, meta?: any) {
    if (this.logLevel === "debug") {
      this.write("debug", message, meta);
    }
  }
}

export const globalLogger = new CodexLogger();
```

**Usage in Tools**:

```typescript
import { globalLogger } from "../utils/logger.js";

export class LocalRunTool {
  async execute(input: LocalRunToolInput): Promise<LocalRunToolResult> {
    globalLogger.info("LocalRun started", {
      task: input.task,
      mode: input.mode,
    });

    try {
      // ... execution ...
      globalLogger.info("LocalRun completed", { exitCode: result.exitCode });
      return result;
    } catch (error) {
      globalLogger.error("LocalRun failed", {
        error: error.message,
        stack: error.stack,
        input,
      });
      throw error;
    }
  }
}
```

#### B. Claude Code Troubleshooting Workflow

**When tool fails silently**:

1. Check `.codex-errors.log` in working directory
2. Read last 20 lines for recent errors
3. Identify root cause from stack trace
4. Fix and retry

**Example**:

```bash
# Claude Code can run this automatically on tool failure:
tail -20 .codex-errors.log
```

**Log Format**:

```json
{
  "timestamp": "2025-11-15T17:30:45.123Z",
  "level": "error",
  "message": "LocalRun failed",
  "meta": {
    "error": "spawn codex ENOENT",
    "stack": "...",
    "input": { "task": "..." }
  }
}
```

---

### Solution 2: Silent Failure Detection

#### A. Always Return Something

**Problem**: Tool returns undefined/null instead of proper result object

**Fix**: Wrap ALL tool execution in try-catch:

```typescript
// src/index.ts - Tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "_codex_local_run":
        result = await this.localRunTool.execute(args as any);
        break;
      // ...
    }

    // CRITICAL: Ensure result is never undefined
    if (!result || !result.content) {
      globalLogger.error("Tool returned invalid result", { name, args });
      return {
        content: [
          {
            type: "text",
            text: `❌ Internal Error: Tool "${name}" returned no result. Check .codex-errors.log for details.`,
          },
        ],
        isError: true,
      };
    }

    return result;
  } catch (error) {
    globalLogger.error("Uncaught tool exception", {
      tool: name,
      error: error.message,
      stack: error.stack,
    });

    return {
      content: [
        {
          type: "text",
          text: `❌ Unexpected Error in "${name}"\n\n${error.message}\n\nCheck .codex-errors.log for full stack trace.`,
        },
      ],
      isError: true,
    };
  }
});
```

#### B. Timeout Detection

**Problem**: Tool hangs indefinitely, no timeout

**Fix**: Add timeout wrapper:

```typescript
async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  taskName: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => {
        globalLogger.error("Tool timeout", { taskName, timeoutMs });
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      }, timeoutMs),
    ),
  ]);
}

// Usage:
result = await executeWithTimeout(
  this.localRunTool.execute(args),
  120000, // 2 minutes
  "_codex_local_run",
);
```

#### C. Progress Heartbeat

**Problem**: Long-running tasks look like hangs

**Fix**: Emit progress events:

```typescript
// During execution, emit heartbeat every 10 seconds
setInterval(() => {
  globalLogger.info("Task still running", {
    taskId,
    elapsed: Date.now() - startTime,
  });
}, 10000);
```

---

## Testing Plan

### Test 1: Verify Logging Works

```bash
# Set env vars
export CODEX_LOG_FILE="${PWD}/.codex-errors.log"
export CODEX_LOG_LEVEL="debug"

# Rebuild and restart MCP server
npm run build
# Restart Claude Code

# Trigger an error
# Check log file exists
cat .codex-errors.log
```

### Test 2: Verify Silent Failure Detection

```bash
# Trigger the silent failure bug
# Verify tool now returns error message instead of silence
# Verify .codex-errors.log contains details
```

### Test 3: Verify Timeout Detection

```bash
# Create a task that hangs (infinite loop)
# Verify timeout triggers after 2 minutes
# Verify error message explains timeout
```

---

## Rollout Plan

### Phase 1: Add Logging (Immediate)

1. Create `src/utils/logger.ts`
2. Integrate into all tools
3. Update `.mcp.json` with env vars
4. Test in codex-control directory

### Phase 2: Add Error Handling (Immediate)

1. Wrap tool handler in try-catch
2. Add invalid result check
3. Add timeout wrapper
4. Test all tools

### Phase 3: Add Progress Heartbeat (Future)

1. Add heartbeat to long-running tasks
2. Emit progress events
3. Update status tool to show heartbeat

---

## Success Criteria

- ✅ No tool ever returns "Tool ran without output or errors" as a silent failure
- ✅ All errors logged to `.codex-errors.log` with full context
- ✅ Claude Code can read logs and troubleshoot issues
- ✅ Timeouts prevent infinite hangs
- ✅ Error messages are actionable ("Check .codex-errors.log")

---

## Priority

**CRITICAL - MUST FIX BEFORE v3.3.0 RELEASE**

This bug breaks the entire user experience. Claude Code cannot debug issues without visibility into failures.
