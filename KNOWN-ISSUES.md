# Known Issues - Codex Control MCP Server

**Last Updated**: 2025-11-12

---

## Issue #1: SDK Tasks May Use Wrong Python Version

**Status**: Known Issue
**Severity**: Medium
**Affects**: `codex_local_exec`, `codex_local_resume`
**Reported**: 2025-11-12 (auditor-toolkit Phase 4)

### Problem

When using SDK-based tools, Codex may use the system Python instead of a project's virtual environment Python. This causes test failures and dependency errors.

**Symptoms**:
```
ModuleNotFoundError: No module named 'boto3'
ModuleNotFoundError: No module named 'typer'
ModuleNotFoundError: No module named 'google.ads'
```

**Root Cause**:
- Codex SDK spawns processes that inherit the MCP server's environment
- MCP server may be running with system Python in PATH
- Project's `.venv` Python not activated for SDK processes

**Example from auditor-toolkit**:
```
# Project has .venv with Python 3.12 + all dependencies
# But Codex used system Python 3.13 (no dependencies)
/Library/Frameworks/Python.framework/Versions/3.13/lib/python3.13/importlib/__init__.py:88
E   ModuleNotFoundError: No module named 'boto3'
```

### Why This Happens

1. SDK tools (`codex_local_exec`) spawn Codex CLI processes via `@openai/codex-sdk`
2. These processes inherit environment from Node.js/MCP server
3. If `.venv/bin/python` is not in PATH, Codex uses system Python
4. System Python lacks project dependencies → test failures
5. Codex retries, gets stuck in error loop

### Why Phases 2 & 3 Worked But Phase 4 Failed

- **Phase 2 & 3**: Simpler tasks with less test validation
- **Phase 4**: More comprehensive validation, ran full test suite
- Result: Phase 4 hit the Python version issue, earlier phases didn't

### Workarounds

**Option 1: Kill Stuck Process and Finish Manually** (Fastest - 5-10 min)
```bash
# Find the stuck process
ps aux | grep "codex exec"

# Kill it
kill -9 <PID>

# Complete the task manually
```

**Option 2: Ensure Virtual Environment is Activated**
```bash
# Before starting Claude Code session
cd /path/to/project
source .venv/bin/activate

# Start Claude Code from this shell
# MCP server will inherit activated environment
```

**Option 3: Use CLI Tools Instead of SDK Tools**
```typescript
// Instead of:
codex_local_exec({ task: "Run tests" })

// Use:
codex_run({ task: "Run tests", mode: "read-only" })
```

**Limitation**: CLI tools don't have thread persistence or token tracking.

### Recommended Approach

For projects with virtual environments:

1. **Quick tasks**: Use `codex_run` (CLI-based, no Python version issues)
2. **Analysis only**: Use `codex_local_exec` with `mode='read-only'` (no test execution)
3. **Test execution**: Use `codex_cloud_submit` with proper environment setup

### Long-Term Fix (Future)

**Possible Solutions**:
1. Add `pythonPath` parameter to SDK tools
2. Detect and activate `.venv` automatically in SDK tools
3. Document environment requirements in tool schemas
4. Add Python version detection to `codex_status`

**Priority**: Medium (workarounds exist, affects specific use cases)

---

## Issue #2: Process Tracking Visibility (FIXED)

**Status**: ✅ Fixed in v2.1.1
**Severity**: Low
**Affects**: `codex_status`
**Fixed**: 2025-11-12

### Problem

`codex_status` only showed ProcessManager-tracked processes (CLI tools), not SDK-spawned processes.

**Before Fix**:
```
ps aux | grep "codex exec"  # Shows PID 70565
codex_status                # Shows 0 active processes
```

### Fix

Added system-wide process detection to `codex_status`:

```typescript
**Total Codex Processes**: 1
  - CLI-tracked: 0
  - SDK-spawned: 1
```

Now shows:
- Total processes (system-wide)
- CLI-tracked vs SDK-spawned breakdown
- Process details (PID, CPU, memory, start time)

**See**: CHANGELOG.md v2.1.1

---

## Reporting Issues

If you encounter new issues:

1. Check `codex_status` for process details
2. Check system processes: `ps aux | grep "codex exec"`
3. Check SDK session logs: `~/.codex/sessions/`
4. Document symptoms, task description, and environment
5. Report in GitHub issues or update this file
