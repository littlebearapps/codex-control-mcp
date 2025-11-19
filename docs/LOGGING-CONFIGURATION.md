# Logging Configuration (Issue 1.5 Phase 1)

**Version**: 3.4.2
**Status**: Phase 1 - Documentation Only (Phase 2 structured logging planned for v3.5.0)

---

## Overview

MCP Delegator logs important events and diagnostics to **stderr**. This document explains how to access, capture, and interpret these logs.

---

## What Gets Logged

### Startup Events

```
[MCPDelegator] Server started successfully via npm link ✅
[MCPDelegator] Name: mcp-delegator
[MCPDelegator] Version: 3.4.2
[MCPDelegator] Max Concurrency: 2
[MCPDelegator] Tools: 14 Codex primitives (all with _ prefix)
[MCPDelegator] Resources: 5 environment templates
```

### Automatic Cleanup (Issue 1.3 fix)

```
[MCPDelegator] Running stuck task cleanup on startup...
[MCPDelegator] ✅ No stuck tasks found
[MCPDelegator] Scheduling periodic cleanup every 15 minutes...
```

Or if stuck tasks found:

```
[MCPDelegator] ⚠️  Cleaned up 3 stuck task(s) from previous session(s)
```

Periodic cleanup (every 15 min):

```
[MCPDelegator] ⚠️  Periodic cleanup: marked 2 stuck task(s) as failed
```

### Shutdown Events

```
[MCPDelegator] Shutting down...
[MCPDelegator] Stopped periodic cleanup scheduler
```

### Error Events

```
[TaskRegistry] Failed to update task T-local-abc123: SQLITE_BUSY
[TaskRegistry] ✅ Retry succeeded for task T-local-abc123
```

Or if retry fails:

```
[TaskRegistry] ❌ Retry FAILED for task T-local-abc123: SQLITE_LOCKED
```

---

## How to Access Logs

### Method 1: Claude Code Terminal Output

When Claude Code starts the MCP server, stderr is typically visible in the terminal where Claude Code is running.

**macOS/Linux**:

```bash
# Start Claude Code from terminal to see logs
claude

# Or check system console for Claude Code output
```

**Expected Output**:

```
[MCPDelegator] Server started successfully via npm link ✅
[MCPDelegator] Name: mcp-delegator
[MCPDelegator] Version: 3.4.2
...
```

### Method 2: Redirect MCP Server Logs to File

Update your MCP configuration to capture stderr:

**File**: `~/.claude/config/.mcp.json`

```json
{
  "mcpServers": {
    "mcp-delegator": {
      "command": "bash",
      "args": ["-c", "mcp-delegator 2>> ~/Library/Logs/mcp-delegator.log"],
      "env": {
        "CODEX_MAX_CONCURRENCY": "2"
      }
    }
  }
}
```

**Then view logs**:

```bash
# Watch logs in real-time
tail -f ~/Library/Logs/mcp-delegator.log

# View last 50 lines
tail -50 ~/Library/Logs/mcp-delegator.log

# Search for errors
grep -i "error" ~/Library/Logs/mcp-delegator.log
grep -i "failed" ~/Library/Logs/mcp-delegator.log
```

### Method 3: System Console (macOS)

1. Open **Console.app**
2. Search for "MCPDelegator" or "mcp-delegator"
3. Filter by process or subsystem
4. View logs in chronological order

### Method 4: Manual Server Test

Test logging by running the MCP server manually:

```bash
# Run server manually (stderr visible)
node /path/to/mcp-delegator/dist/index.js

# Or if installed via npm
mcp-delegator

# Press Ctrl+C to stop
```

---

## Log Levels

Currently, MCP Delegator uses **console.error()** for all logging (stderr). Future versions (v3.5.0+) will add structured logging with levels:

- **ERROR**: Critical failures, exceptions
- **WARN**: Warnings, stuck tasks, retry attempts
- **INFO**: Startup, shutdown, normal operations
- **DEBUG**: Detailed diagnostics (optional)

---

## What to Look For

### Successful Startup

```
[MCPDelegator] Server started successfully via npm link ✅
[MCPDelegator] Scheduling periodic cleanup every 15 minutes...
```

✅ **Good**: Server initialized and periodic cleanup scheduled

### Stuck Tasks Detected

```
[MCPDelegator] ⚠️  Cleaned up 5 stuck task(s) from previous session(s)
```

⚠️ **Warning**: Previous tasks were stuck (likely from crashed sessions)

### Database Errors

```
[TaskRegistry] Failed to update task T-local-abc123: SQLITE_BUSY
[TaskRegistry] ❌ Retry FAILED for task T-local-abc123: SQLITE_LOCKED
```

❌ **Error**: Database issues - check for:

- Concurrent access (multiple MCP servers?)
- Disk space issues
- File permissions

### Silent Shutdown

```
(no logs)
```

❌ **Problem**: MCP server crashed without logging shutdown

- Check system logs for crashes
- Look for out-of-memory errors
- Verify Node.js installation

---

## Troubleshooting with Logs

### Issue: No Logs Visible

**Cause**: Logs not captured or MCP server not starting

**Solutions**:

1. Run MCP server manually: `node dist/index.js`
2. Check Claude Code terminal output
3. Enable log file redirection (Method 2 above)
4. Check system console (Method 3 above)

### Issue: Stuck Tasks Keep Accumulating

**Symptoms in Logs**:

```
[MCPDelegator] ⚠️  Cleaned up 10 stuck task(s) from previous session(s)
[MCPDelegator] ⚠️  Periodic cleanup: marked 3 stuck task(s) as failed
[MCPDelegator] ⚠️  Periodic cleanup: marked 5 stuck task(s) as failed
```

**Cause**: Tasks timing out or crashing repeatedly

**Solutions**:

1. Check task complexity (are they too large?)
2. Review timeout settings (v3.2.1+ has 5 min idle / 20 min hard timeouts)
3. Consider using cloud execution for long tasks
4. Break tasks into smaller steps

### Issue: Database Lock Errors

**Symptoms in Logs**:

```
[TaskRegistry] Failed to update task T-local-abc123: SQLITE_BUSY
[TaskRegistry] ❌ Retry FAILED for task T-local-abc123: SQLITE_LOCKED
```

**Cause**: SQLite database locked by another process

**Solutions**:

1. Stop all Claude Code instances
2. Check for multiple MCP servers in config
3. Verify only one mcp-delegator process running:
   ```bash
   ps aux | grep mcp-delegator
   ```
4. Restart Claude Code

---

## Future Enhancements (v3.5.0+)

Phase 2 structured logging will add:

1. **Log Levels**: ERROR, WARN, INFO, DEBUG
2. **JSON Output**: Machine-readable structured logs
3. **Log Rotation**: Automatic cleanup of old logs
4. **Performance Metrics**: Task duration, queue depth, concurrency
5. **User-Configurable Verbosity**: Control log detail level

**Example Future Log (JSON)**:

```json
{
  "timestamp": "2025-11-17T10:30:00Z",
  "level": "INFO",
  "component": "TaskRegistry",
  "event": "cleanup_completed",
  "data": {
    "tasksMarkedFailed": 3,
    "totalTasks": 45,
    "cleanupDurationMs": 23
  }
}
```

---

## Quick Reference

| Need                            | Command                                            |
| ------------------------------- | -------------------------------------------------- |
| **View logs in real-time**      | `tail -f ~/Library/Logs/mcp-delegator.log`         |
| **View last 50 lines**          | `tail -50 ~/Library/Logs/mcp-delegator.log`        |
| **Search for errors**           | `grep -i "error" ~/Library/Logs/mcp-delegator.log` |
| **Test server manually**        | `mcp-delegator` or `node dist/index.js`            |
| **Check running processes**     | `ps aux \| grep mcp-delegator`                     |
| **View system console (macOS)** | Open Console.app, search "MCPDelegator"            |

---

## Summary

**Current State (v3.4.2)**:

- ✅ Logs output to stderr
- ✅ Startup, cleanup, and error events logged
- ✅ Manual capture via file redirection
- ✅ Accessible via system console

**Coming Soon (v3.5.0+)**:

- Structured logging with levels
- JSON output for machine parsing
- Log rotation
- Performance metrics
- User-configurable verbosity

**Impact**: Users can now diagnose issues by checking logs instead of guessing what went wrong.
