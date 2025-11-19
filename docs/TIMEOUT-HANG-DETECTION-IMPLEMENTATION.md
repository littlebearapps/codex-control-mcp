# Timeout/Hang Detection Implementation Guide

**Version**: 3.3.0 (Proposed)
**Date**: 2025-11-16
**Status**: 📋 DESIGN PROPOSAL

---

## Problem Statement

During UAT testing (Test 2.6), Codex CLI hung for 36 minutes with no output, causing Claude Code to wait indefinitely with no way to detect or recover from the hang.

**Impact**:

- ❌ Poor user experience (AI agent stuck waiting)
- ❌ Wasted time (36 minutes of no progress)
- ❌ No visibility into the hang until manual intervention
- ❌ No way for Claude Code to take alternative action

**Goal**: Implement MCP-compliant timeout detection that alerts Claude Code when tasks hang, allowing it to stop waiting and take action.

---

## MCP-Compliant Solution

Based on official MCP specifications and best practices, we'll implement a **two-tier timeout system** using:

1. **MCP Progress Tracking** (`notifications/progress`) - Official standard for long-running operations
2. **MCP Logging** (`notifications/message`) - Standard for warnings and errors
3. **Structured Error Response** - Final tool result with timeout details and partial results

### Why MCP-Compliant?

- ✅ **Standard Protocol**: Uses official MCP primitives (not custom hacks)
- ✅ **Claude Code Integration**: Claude Code already handles these notification types
- ✅ **Visibility**: Progress and warnings appear in Claude Code UI
- ✅ **Actionable**: Structured errors allow AI agents to make intelligent decisions

---

## Architecture Overview

### Two-Tier Timeout System

```
┌─────────────────────────────────────────────────────────────┐
│                    Codex CLI Execution                      │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Inactivity Timeout (default: 5 minutes)              │  │
│  │ • Resets on ANY stdout/stderr output                 │  │
│  │ • Fires if NO activity for 5 minutes                 │  │
│  │ • Sends warning at T-30s before timeout              │  │
│  │ • Catches silent hangs/deadlocks                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Hard Timeout (default: 20 minutes)                   │  │
│  │ • Wall-clock time from spawn                         │  │
│  │ • Fires regardless of activity                       │  │
│  │ • Prevents indefinite runaways                       │  │
│  │ • Absolute maximum execution time                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  On Timeout:                                                │
│  1. Send warning notification (30s before)                  │
│  2. Send timeout notification                               │
│  3. Kill process (SIGTERM → SIGKILL)                        │
│  4. Return structured error with partial results            │
└─────────────────────────────────────────────────────────────┘
```

---

## MCP Protocol Integration

### 1. Progress Tracking (Official MCP Standard)

**Specification**: https://spec.modelcontextprotocol.io/specification/2024-11-05/basic/utilities/progress/

**How It Works**:

- Client includes `progressToken` in tool call request metadata
- Server sends `notifications/progress` updates during execution
- Progress notifications continue until operation completes

**Message Format**:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/progress",
  "params": {
    "progressToken": "task-abc123",
    "progress": 50,
    "total": 100
  }
}
```

**Requirements**:

- ✅ `progress` MUST increase with each notification
- ✅ Progress notifications MUST stop after completion
- ✅ Receivers SHOULD implement rate limiting
- ✅ `total` is optional if unknown

**Usage in mcp-delegator**:

- Send progress updates every 10-30 seconds during Codex execution
- Show elapsed time and current activity (if available from JSONL events)
- Stop progress when operation completes or times out

---

### 2. Logging/Notifications (Official MCP Standard)

**Specification**: https://spec.modelcontextprotocol.io/specification/2024-11-05/server/utilities/logging/

**How It Works**:

- Server sends `notifications/message` for warnings/errors
- No client request needed (unsolicited notifications)
- Client controls filtering via `logging/setLevel`

**Message Format**:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/message",
  "params": {
    "level": "warning",
    "logger": "codex-timeout-watchdog",
    "data": {
      "message": "No output for 4m 30s. Will abort in 30s unless output resumes.",
      "idleMs": 270000,
      "willAbortInMs": 30000,
      "taskId": "task-abc123"
    }
  }
}
```

**Available Log Levels** (RFC 5424):

- `debug` - Detailed debugging information
- `info` - General informational messages
- `notice` - Normal but significant events
- `warning` - **Warning conditions** ← Use for timeout warnings
- `error` - **Error conditions** ← Use for timeout errors
- `critical` - Critical conditions
- `alert` - Action must be taken immediately
- `emergency` - System is unusable

**Usage in mcp-delegator**:

- Send `warning` level at T-30s before inactivity timeout
- Send `error` level when timeout fires
- Include actionable data (elapsed time, next steps)

---

### 3. Structured Error Response

**Final Tool Result on Timeout**:

```typescript
{
  "content": [
    {
      "type": "text",
      "text": JSON.stringify({
        "success": false,
        "error": {
          "code": "ETIMEDOUT",
          "kind": "inactivity",  // or "deadline"
          "message": "Codex CLI produced no output within the allowed inactivity window (5 minutes).",
          "idleMs": 300000,
          "wallClockMs": 315000,
          "pid": 48534,
          "killed": true,
          "signal": "SIGTERM"
        },
        "partial": {
          "lastEvents": [/* last 50 JSONL events */],
          "stdoutTail": "...",
          "stderrTail": "...",
          "lastActivityAt": "2025-11-16T04:23:54Z",
          "eventsCount": 127
        },
        "recovery": {
          "suggestions": [
            "Increase timeout for this task type",
            "Check Codex CLI logs for errors",
            "Verify network connectivity",
            "Try with smaller scope or simpler task"
          ]
        }
      }, null, 2)
    }
  ],
  "isError": true
}
```

**Why This Works**:

- ✅ Claude Code sees `isError: true` and knows the tool failed
- ✅ AI agent gets structured error data to make decisions
- ✅ Partial results provide context for next steps
- ✅ Recovery suggestions guide AI agent's response

---

## Implementation Approach

### File: `src/executor/timeout_watchdog.ts` (NEW)

```typescript
import { ChildProcess } from "child_process";
import treeKill from "tree-kill";

export interface WatchdogConfig {
  // Timeouts
  idleTimeoutMs?: number; // Default: 5 minutes (300000)
  hardTimeoutMs?: number; // Default: 20 minutes (1200000)
  warnLeadMs?: number; // Default: 30 seconds (30000)
  killGraceMs?: number; // Default: 5 seconds (5000)

  // Callbacks
  onProgress?: (progress: ProgressUpdate) => void;
  onWarning?: (warning: TimeoutWarning) => void;
  onTimeout?: (timeout: TimeoutError) => void;
  onActivity?: () => void;
}

export interface ProgressUpdate {
  progressToken: string;
  progress: number;
  total?: number;
  elapsedMs: number;
  lastActivity: Date;
}

export interface TimeoutWarning {
  level: "warning";
  logger: string;
  data: {
    message: string;
    idleMs: number;
    willAbortInMs: number;
    taskId: string;
  };
}

export interface TimeoutError {
  code: "ETIMEDOUT" | "EIDLE";
  kind: "inactivity" | "deadline";
  message: string;
  idleMs?: number;
  wallClockMs?: number;
  pid: number;
  killed: boolean;
  signal?: string;
}

export interface PartialResults {
  lastEvents: any[];
  stdoutTail: string;
  stderrTail: string;
  lastActivityAt: Date;
  eventsCount: number;
}

export class TimeoutWatchdog {
  private startTime: number;
  private lastActivity: number;
  private warned: boolean = false;
  private aborted: boolean = false;

  private idleTimer?: NodeJS.Timeout;
  private hardTimer?: NodeJS.Timeout;
  private warnTimer?: NodeJS.Timeout;
  private progressTimer?: NodeJS.Timeout;

  private config: Required<WatchdogConfig>;
  private progressToken: string;

  // Partial result buffers
  private stdoutChunks: Buffer[] = [];
  private stderrChunks: Buffer[] = [];
  private lastEvents: any[] = [];

  private static readonly MAX_TAIL_BYTES = 64 * 1024;
  private static readonly MAX_EVENTS = 50;

  constructor(
    private child: ChildProcess,
    private taskId: string,
    config: WatchdogConfig = {},
  ) {
    this.startTime = Date.now();
    this.lastActivity = Date.now();
    this.progressToken = `progress-${taskId}`;

    // Default config
    this.config = {
      idleTimeoutMs: config.idleTimeoutMs ?? 5 * 60 * 1000, // 5 minutes
      hardTimeoutMs: config.hardTimeoutMs ?? 20 * 60 * 1000, // 20 minutes
      warnLeadMs: config.warnLeadMs ?? 30 * 1000, // 30 seconds
      killGraceMs: config.killGraceMs ?? 5 * 1000, // 5 seconds
      onProgress: config.onProgress ?? (() => {}),
      onWarning: config.onWarning ?? (() => {}),
      onTimeout: config.onTimeout ?? (() => {}),
      onActivity: config.onActivity ?? (() => {}),
    };

    this.startTimers();
  }

  /**
   * Call this whenever child process produces output
   */
  public recordActivity(): void {
    if (this.aborted) return;

    this.lastActivity = Date.now();
    this.warned = false; // Reset warning state
    this.config.onActivity();

    // Reset inactivity timer
    this.resetIdleTimer();
  }

  /**
   * Record stdout chunk for partial results
   */
  public recordStdout(chunk: Buffer): void {
    this.recordActivity();
    this.pushToBuffer(this.stdoutChunks, chunk);
  }

  /**
   * Record stderr chunk for partial results
   */
  public recordStderr(chunk: Buffer): void {
    this.recordActivity();
    this.pushToBuffer(this.stderrChunks, chunk);
  }

  /**
   * Record parsed JSONL event for partial results
   */
  public recordEvent(event: any): void {
    this.recordActivity();
    this.lastEvents.push(event);
    if (this.lastEvents.length > TimeoutWatchdog.MAX_EVENTS) {
      this.lastEvents.shift();
    }
  }

  /**
   * Get partial results collected so far
   */
  public getPartialResults(): PartialResults {
    return {
      lastEvents: [...this.lastEvents],
      stdoutTail: Buffer.concat(this.stdoutChunks).toString("utf8"),
      stderrTail: Buffer.concat(this.stderrChunks).toString("utf8"),
      lastActivityAt: new Date(this.lastActivity),
      eventsCount: this.lastEvents.length,
    };
  }

  /**
   * Stop all timers and cleanup
   */
  public stop(): void {
    this.clearAllTimers();
  }

  /**
   * Manually trigger timeout (for testing or external kill)
   */
  public abort(reason: "inactivity" | "deadline" | "manual"): TimeoutError {
    if (this.aborted) {
      throw new Error("Watchdog already aborted");
    }

    this.aborted = true;
    this.clearAllTimers();

    const error: TimeoutError = {
      code: reason === "inactivity" ? "EIDLE" : "ETIMEDOUT",
      kind: reason === "manual" ? "deadline" : reason,
      message: this.getTimeoutMessage(reason),
      idleMs:
        reason === "inactivity" ? Date.now() - this.lastActivity : undefined,
      wallClockMs:
        reason === "deadline" ? Date.now() - this.startTime : undefined,
      pid: this.child.pid!,
      killed: false,
    };

    // Kill process
    this.killProcess((signal) => {
      error.killed = true;
      error.signal = signal;
    });

    this.config.onTimeout(error);
    return error;
  }

  // ========== Private Methods ==========

  private startTimers(): void {
    // Hard timeout (wall-clock)
    this.hardTimer = setTimeout(() => {
      this.abort("deadline");
    }, this.config.hardTimeoutMs);

    // Inactivity timer (resets on activity)
    this.resetIdleTimer();

    // Warning timer (checks if we should warn)
    this.warnTimer = setInterval(() => {
      this.checkWarning();
    }, 1000);

    // Progress updates (every 30 seconds)
    this.progressTimer = setInterval(() => {
      this.sendProgress();
    }, 30000);
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      this.abort("inactivity");
    }, this.config.idleTimeoutMs);
  }

  private checkWarning(): void {
    if (this.warned || this.aborted) return;

    const idle = Date.now() - this.lastActivity;
    const warnAt = this.config.idleTimeoutMs - this.config.warnLeadMs;

    if (idle >= warnAt && idle < this.config.idleTimeoutMs) {
      this.warned = true;

      const warning: TimeoutWarning = {
        level: "warning",
        logger: "codex-timeout-watchdog",
        data: {
          message: `No output for ${Math.floor(idle / 1000)}s. Will abort in ${Math.floor((this.config.idleTimeoutMs - idle) / 1000)}s unless output resumes.`,
          idleMs: idle,
          willAbortInMs: this.config.idleTimeoutMs - idle,
          taskId: this.taskId,
        },
      };

      this.config.onWarning(warning);
    }
  }

  private sendProgress(): void {
    if (this.aborted) return;

    const elapsed = Date.now() - this.startTime;
    const total = this.config.hardTimeoutMs;

    const progress: ProgressUpdate = {
      progressToken: this.progressToken,
      progress: elapsed,
      total: total,
      elapsedMs: elapsed,
      lastActivity: new Date(this.lastActivity),
    };

    this.config.onProgress(progress);
  }

  private killProcess(onKilled: (signal: string) => void): void {
    const pid = this.child.pid;
    if (!pid) return;

    // Try SIGTERM first
    try {
      if (process.platform !== "win32") {
        process.kill(-pid, "SIGTERM"); // Kill process group
      } else {
        treeKill(pid, "SIGTERM");
      }
      onKilled("SIGTERM");
    } catch (err) {
      // Process might already be dead
    }

    // Force kill after grace period
    setTimeout(() => {
      try {
        if (process.platform !== "win32") {
          process.kill(-pid, "SIGKILL");
        } else {
          treeKill(pid, "SIGKILL");
        }
        onKilled("SIGKILL");
      } catch (err) {
        // Process definitely dead now
      }
    }, this.config.killGraceMs);
  }

  private pushToBuffer(buffer: Buffer[], chunk: Buffer): void {
    buffer.push(chunk);
    let size = buffer.reduce((s, b) => s + b.length, 0);

    while (size > TimeoutWatchdog.MAX_TAIL_BYTES && buffer.length > 1) {
      const removed = buffer.shift()!;
      size -= removed.length;
    }
  }

  private clearAllTimers(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.hardTimer) clearTimeout(this.hardTimer);
    if (this.warnTimer) clearInterval(this.warnTimer);
    if (this.progressTimer) clearInterval(this.progressTimer);
  }

  private getTimeoutMessage(reason: string): string {
    switch (reason) {
      case "inactivity":
        return `Codex CLI produced no output within the allowed inactivity window (${this.config.idleTimeoutMs / 1000}s).`;
      case "deadline":
        return `Codex CLI exceeded the maximum allowed wall-clock time (${this.config.hardTimeoutMs / 1000}s).`;
      case "manual":
        return "Codex CLI execution was manually aborted.";
      default:
        return "Codex CLI execution timed out.";
    }
  }
}
```

---

### Integration into Existing Tools

**Example: `src/tools/local_run.ts` (Modified)**

```typescript
import { TimeoutWatchdog } from '../executor/timeout_watchdog';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// In tool handler
async function handleCodexLocalRun(args: any, server: Server) {
  const taskId = `task-${Date.now()}`;

  // Spawn Codex CLI process
  const child = spawn('codex', ['exec', ...]);

  // Create timeout watchdog
  const watchdog = new TimeoutWatchdog(child, taskId, {
    idleTimeoutMs: args.idleTimeoutMs ?? 5 * 60 * 1000,
    hardTimeoutMs: args.hardTimeoutMs ?? 20 * 60 * 1000,

    // Send MCP progress notifications
    onProgress: (progress) => {
      server.notification({
        method: 'notifications/progress',
        params: {
          progressToken: progress.progressToken,
          progress: progress.progress,
          total: progress.total
        }
      });
    },

    // Send MCP warning notifications
    onWarning: (warning) => {
      server.notification({
        method: 'notifications/message',
        params: warning
      });
    },

    // Send MCP error notification
    onTimeout: (error) => {
      server.notification({
        method: 'notifications/message',
        params: {
          level: 'error',
          logger: 'codex-timeout-watchdog',
          data: {
            message: error.message,
            code: error.code,
            kind: error.kind,
            taskId: taskId
          }
        }
      });
    }
  });

  // Wire up stdout/stderr to watchdog
  child.stdout.on('data', (chunk) => {
    watchdog.recordStdout(chunk);

    // Parse JSONL events
    for (const event of parseJsonlChunk(chunk)) {
      watchdog.recordEvent(event);
    }
  });

  child.stderr.on('data', (chunk) => {
    watchdog.recordStderr(chunk);
  });

  // Handle process exit
  return new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      watchdog.stop();

      if (code === 0) {
        resolve({
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, ... })
          }]
        });
      } else {
        // Check if timeout occurred
        const partial = watchdog.getPartialResults();

        resolve({
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: { ... },
              partial: partial
            })
          }],
          isError: true
        });
      }
    });
  });
}
```

---

## Configuration

### Tool Parameters (NEW)

Add timeout configuration to all execution tools:

```typescript
{
  "name": "_codex_local_run",
  "inputSchema": {
    "type": "object",
    "properties": {
      "task": { "type": "string" },
      "mode": { "type": "string" },
      // ... existing parameters ...

      // NEW: Timeout configuration
      "idleTimeoutMs": {
        "type": "number",
        "description": "Inactivity timeout in milliseconds (default: 300000 = 5 minutes). Server enforces min 60000 (1 min) and max 1800000 (30 min)."
      },
      "hardTimeoutMs": {
        "type": "number",
        "description": "Hard wall-clock timeout in milliseconds (default: 1200000 = 20 minutes). Server enforces min 300000 (5 min) and max 3600000 (60 min)."
      }
    }
  }
}
```

### Server-Side Limits

**File: `src/executor/timeout_watchdog.ts`**

```typescript
export const TIMEOUT_LIMITS = {
  IDLE_MIN: 60 * 1000, // 1 minute
  IDLE_MAX: 30 * 60 * 1000, // 30 minutes
  IDLE_DEFAULT: 5 * 60 * 1000, // 5 minutes

  HARD_MIN: 5 * 60 * 1000, // 5 minutes
  HARD_MAX: 60 * 60 * 1000, // 60 minutes
  HARD_DEFAULT: 20 * 60 * 1000, // 20 minutes
};

export function validateTimeouts(
  config: WatchdogConfig,
): Required<WatchdogConfig> {
  return {
    idleTimeoutMs: Math.max(
      TIMEOUT_LIMITS.IDLE_MIN,
      Math.min(
        TIMEOUT_LIMITS.IDLE_MAX,
        config.idleTimeoutMs ?? TIMEOUT_LIMITS.IDLE_DEFAULT,
      ),
    ),
    hardTimeoutMs: Math.max(
      TIMEOUT_LIMITS.HARD_MIN,
      Math.min(
        TIMEOUT_LIMITS.HARD_MAX,
        config.hardTimeoutMs ?? TIMEOUT_LIMITS.HARD_DEFAULT,
      ),
    ),
    // ... other config ...
  };
}
```

---

## User Experience

### Claude Code UI

When timeout warning fires:

```
⚠️  Warning: No output for 4m 30s. Will abort in 30s unless output resumes.
```

When timeout fires:

```
❌ Error: Codex CLI produced no output within the allowed inactivity window (5 minutes).

Task ID: task-1731801234567
Elapsed: 5m 15s
Last activity: 5m 0s ago

Partial results available (127 events captured).

Suggestions:
  • Increase timeout for this task type
  • Check Codex CLI logs for errors
  • Verify network connectivity
  • Try with smaller scope or simpler task
```

### AI Agent Decision Tree

```
Timeout Error Received
  ↓
Extract Error Details
  • code: ETIMEDOUT | EIDLE
  • kind: inactivity | deadline
  • idleMs: 300000
  • partial.lastEvents: [...]
  ↓
Analyze Partial Results
  • Were there any progress events?
  • What was the last known state?
  • Did it start but stall, or never start?
  ↓
Make Decision
  ┌─────────────────────────────────────┐
  │ Last Event: "tests started"         │ → Retry with longer timeout
  │ idleMs: 300000 (5 min)              │
  └─────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │ Last Event: "authentication failed" │ → Fix auth, don't retry
  │ kind: deadline                      │
  └─────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │ No events at all                    │ → Try different approach
  │ kind: inactivity                    │
  └─────────────────────────────────────┘
```

---

## Trade-Offs and Considerations

### ✅ Advantages

1. **MCP-Compliant**: Uses official protocol standards (not hacks)
2. **Simple**: Two timers + callbacks, no complex state machine
3. **Reliable**: Well-tested pattern from subprocess wrappers
4. **Visible**: Claude Code shows progress and warnings in UI
5. **Actionable**: Structured errors enable intelligent AI agent decisions
6. **Configurable**: Per-call timeout overrides with server-side caps
7. **Safe**: Bounded buffers prevent memory leaks
8. **Cross-Platform**: Handles Windows/POSIX process killing

### ⚠️ Trade-Offs

1. **False Positives**: Legitimately quiet tasks may timeout
   - **Mitigation**: Allow per-call timeout overrides, use generous defaults

2. **Partial Data Loss**: Timeout mid-operation may lose some work
   - **Mitigation**: Partial results provide context, safety checkpoints for git ops

3. **Additional Complexity**: New watchdog class + integration code
   - **Mitigation**: Single well-tested class, minimal integration points

4. **Token Cost**: Progress notifications increase token usage slightly
   - **Mitigation**: Send progress every 30s (not every second), configurable

### 🔍 Edge Cases

1. **Process Dies Immediately**: Watchdog stops on exit, no timeout
2. **Rapid Output Then Hang**: Inactivity timer catches it
3. **Slow But Progressing**: Activity resets timer, no timeout
4. **Already-Killed Process**: Kill operations are safe (catch errors)
5. **Orphaned Processes**: Process group kill prevents orphans

---

## Implementation Plan

### Phase 1: Core Watchdog (v3.3.0)

**Files to Create**:

1. ✅ `src/executor/timeout_watchdog.ts` - Core watchdog class
2. ✅ `src/executor/timeout_watchdog.test.ts` - Unit tests

**Files to Modify**: 3. ✅ `src/tools/local_run.ts` - Integrate watchdog 4. ✅ `src/tools/local_exec.ts` - Integrate watchdog 5. ✅ `src/tools/local_resume.ts` - Integrate watchdog 6. ✅ `src/tools/cloud.ts` - Integrate watchdog (or skip - cloud has own timeout)

**Testing**:

- ✅ Unit tests for watchdog class
- ✅ Integration test with mock child process
- ✅ Manual test with real Codex CLI (use sleep command to simulate hang)

**Documentation**:

- ✅ Update `README.md` with timeout parameters
- ✅ Update `quickrefs/tools.md` with timeout examples
- ✅ Create `docs/TIMEOUT-HANG-DETECTION.md` (this file)

---

### Phase 2: Advanced Features (v3.4.0+)

**Optional Enhancements**:

1. **CLI Heartbeats**: Configure Codex CLI to emit JSONL heartbeats every 30s
2. **Adaptive Timeouts**: Learn typical task durations and adjust defaults
3. **Timeout Metrics**: Track timeout frequency by reason for tuning
4. **Recovery Actions**: Automatic retry with longer timeout on first failure

---

## Recommendations

### Immediate Actions (v3.3.0)

1. ✅ **Implement Core Watchdog**: Create `timeout_watchdog.ts` class
2. ✅ **Integrate into Local Tools**: Add to all 3 local execution tools
3. ✅ **Test with Real Hang**: Use `sleep` command to simulate 36-minute hang
4. ✅ **Validate MCP Notifications**: Verify Claude Code shows warnings/errors

### Default Configuration

```typescript
// Recommended defaults based on UAT findings
const DEFAULTS = {
  idleTimeoutMs: 5 * 60 * 1000, // 5 minutes (caught Test 2.6 hang)
  hardTimeoutMs: 20 * 60 * 1000, // 20 minutes (reasonable for complex tasks)
  warnLeadMs: 30 * 1000, // 30 seconds (enough time to notice)
  killGraceMs: 5 * 1000, // 5 seconds (graceful shutdown)
  progressIntervalMs: 30 * 1000, // 30 seconds (not too spammy)
};
```

### Future Enhancements

1. **Per-Task Type Defaults**: Different timeouts for different task types
   - `mode: 'read-only'` → 2 min idle, 10 min hard
   - `mode: 'workspace-write'` → 5 min idle, 20 min hard
   - Cloud tasks → No local timeout (cloud has own limits)

2. **Intelligent Timeout Adjustment**: Learn from history
   - Track task duration by type
   - Adjust defaults based on P95 completion time
   - Warn if task exceeds historical average

3. **Codex CLI Heartbeat Support**: Request Codex team to add heartbeats
   - Emit JSONL heartbeat every 30 seconds
   - Indicates "still alive and thinking"
   - Allows distinguishing hang from slow progress

---

## Conclusion

The **two-tier timeout system with MCP-compliant notifications** provides a simple, reliable, and standard way to detect and recover from hung Codex tasks.

**Key Benefits**:

- ✅ Prevents 36-minute hangs like Test 2.6
- ✅ Alerts Claude Code via standard MCP notifications
- ✅ Provides partial results for intelligent recovery
- ✅ Simple implementation (single watchdog class)
- ✅ Configurable per-call with server-side safety limits

**Status**: Ready for implementation in v3.3.0

**Next Step**: Create `src/executor/timeout_watchdog.ts` and integrate into local execution tools.
