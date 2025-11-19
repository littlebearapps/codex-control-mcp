# MCP Delegator Issues from Auditor Toolkit Testing

**Date**: 2025-11-17
**Reporter**: Claude (Sonnet 4.5) via Nathan
**Environment**: Auditor Toolkit (instB), macOS Darwin 25.0.0
**MCP Delegator Version**: v3.4.0 (@littlebearapps/mcp-delegator)

---

## Executive Summary

Multiple critical and non-critical issues discovered during real-world usage of mcp-delegator in Auditor Toolkit project. Issues range from task execution failures to git workflow limitations.

**Overall Impact**: High - Blocking automated task execution in production environment
**Total Issues**: 12 distinct issues across 3 categories

---

## Category 1: Task Execution & Registry Issues (CRITICAL)

### Issue 1.1: Tasks Start But Never Execute

**Severity**: CRITICAL
**Status**: 🔴 Unresolved

**Symptom**:

- `codex_local_exec` returns task ID
- Task never appears in registry (showAll: true)
- `codex_local_wait` returns without output
- No evidence of execution (no logs, no files created)

**Evidence**:

```typescript
Task ID: T-local-mi1h3c6tric3yw
Expected: Task appears in registry as "running" or "completed"
Actual: Task not found in any section (running/completed/failed)
```

**Source**: `auditor-toolkit/main/docs/codex-control-mcp-debugging.md` lines 19-40

**Impact**: Complete task execution failure

---

### Issue 1.2: Tasks Report Success Without Creating Files

**Severity**: CRITICAL
**Status**: 🔴 Unresolved

**Symptom**:

- `codex_local_results` returns "Status: ✅ Success"
- Git status shows clean working tree (no changes)
- Expected files don't exist on disk
- Output shows truncated file listing instead of implementation results

**Evidence**:

```bash
Task: T-local-mi1gob5gxgdvar
Status: ✅ Success (claimed)
Expected Files:
  - auditor_toolkit/ads/oauth_manager.py (NOT FOUND)
  - auditor_toolkit/ads/mutate_writer.py (NOT FOUND)
  - tests/settings/ads/unit/test_oauth_manager.py (NOT FOUND)

$ git status
On branch feature/google-platforms-p0-p1-p2-foundation
nothing to commit, working tree clean
```

**Source**: `auditor-toolkit/main/docs/codex-control-mcp-debugging.md` lines 42-65

**Impact**: False positive success, no actual work performed

---

### Issue 1.3: Stuck Tasks Accumulate in Registry

**Severity**: HIGH
**Status**: 🔴 Unresolved

**Symptom**:

- 9 tasks stuck in "running" state for 8+ hours
- Tasks from different working directories
- All git-related operations (log, rebase)
- Registry cleanup not functioning

**Evidence**:

```
Running Tasks: 9

T-local-mi127ad04c1cnm:
- Task: Show git log --oneline
- Elapsed: 29466s (8.2 hours)
- Mode: read-only

T-local-mi126umnoks0g4:
- Task: Rebase current branch onto main
- Elapsed: 29486s (8.2 hours)
- Mode: workspace-write

[... 7 more stuck tasks with similar elapsed times ...]
```

**Source**: `auditor-toolkit/main/docs/codex-control-mcp-debugging.md` lines 68-93

**Impact**: Registry pollution, potential resource leaks, confusing status output

**Root Cause Hypotheses**:

1. Registry cleanup not running
2. Tasks timeout but registry not updated
3. Processes killed but registry state not updated
4. Working directory isolation failure

---

### Issue 1.4: Registry Database Location Unknown

**Severity**: MEDIUM
**Status**: 🔴 Unresolved

**Symptom**:

- Documentation doesn't specify registry location
- Can't manually inspect registry
- Can't verify integrity
- Can't clean up stuck tasks manually

**Source**: `auditor-toolkit/main/docs/codex-control-mcp-debugging.md` lines 128-137

**Impact**: Unable to diagnose or fix registry issues

**Investigation Needed**:

```bash
# Where is the registry?
~/.codex/?
~/.config/codex-control/?
~/.local/share/mcp-delegator/?
~/Library/Application Support/codex/?

# What format?
SQLite database?
JSON file?
Binary format?
```

---

### Issue 1.5: No Execution Logs or Diagnostics

**Severity**: MEDIUM
**Status**: 🔴 Unresolved

**Symptom**:

- No stderr/stdout from Codex execution
- No MCP server logs
- Can't diagnose execution failures
- Silent failures with no error messages

**Source**: `auditor-toolkit/main/docs/codex-control-mcp-debugging.md` lines 308-319

**Impact**: Impossible to debug execution failures

**Investigation Needed**:

```bash
# Where should logs be?
/tmp/mcp-delegator.log?
~/Library/Logs/mcp-delegator.log?
~/.codex/logs/?
Process-specific logs?
```

---

## Category 2: Git Workflow Issues (NON-CRITICAL)

### Issue 2.1: Git Verification Too Strict

**Severity**: LOW
**Status**: 🟡 Known Limitation

**Symptom**:

- Branch creation fails if working directory has uncommitted changes
- Task marked as "Failed" despite successful implementation
- No option to allow dirty working directory
- No auto-stash support

**Evidence**:

```
Git Verification Results:
❌ Branch not created: Expected `feature/google-platforms-phase0-foundation`,
   still on `fix/revert-gbp-phase1-implementation`
✅ Files staged: 1 file(s)
⚠️ Files unstaged: 32 file(s)

Errors:
- Branch not created due to uncommitted changes

Recommendation:
- Create branch manually: git checkout -b <branch-name>
```

**Source**: `auditor-toolkit/main/docs/codex-git-workflow-issue.md` lines 32-75

**Impact**: Task fails despite 100% successful implementation

**Actual Success Rate**:

- Implementation: 100% (9/9 files, 714 lines, 10/10 tests passing)
- Git workflow: 0% (branch creation failed)
- Overall status: "Failed" (misleading)

---

### Issue 2.2: No Auto-Stash Support

**Severity**: LOW
**Status**: 🟡 Enhancement Request

**Symptom**:

- Can't stash uncommitted changes before branch creation
- Must manually clean working directory
- No offer to stash/apply workflow

**Source**: `auditor-toolkit/main/docs/codex-git-workflow-issue.md` lines 88-93

**Suggested Workflow**:

```bash
# What Codex could do automatically:
git stash push -m "Auto-stash before branch creation"
git checkout -b <branch-name>
git stash pop
```

**Impact**: Extra manual steps required

---

### Issue 2.3: Task Status Granularity

**Severity**: LOW
**Status**: 🟡 Enhancement Request

**Symptom**:

- Only "Success" or "Failed" status
- No "Partial Success" or "Succeeded with Warnings"
- Implementation success + git failure = "Failed" (misleading)

**Source**: `auditor-toolkit/main/docs/codex-git-workflow-issue.md` lines 88-93

**Suggested Statuses**:

- ✅ Success (all aspects succeeded)
- ⚠️ Succeeded with Warnings (implementation OK, workflow needs attention)
- ⚠️ Partial Success (some parts failed)
- ❌ Failed (critical failure)

**Impact**: Confusing status reporting, false failures

---

### Issue 2.4: No --allow-dirty Flag

**Severity**: LOW
**Status**: 🟡 Enhancement Request

**Symptom**:

- Can't opt-in to branch creation with uncommitted changes
- No flexibility for advanced users
- Forces clean working directory even for unrelated changes

**Source**: `auditor-toolkit/main/docs/codex-git-workflow-issue.md` lines 117-123

**Suggested API**:

```typescript
{
  task: "Create branch and implement feature",
  mode: "workspace-write",
  allowDirtyWorkingDir: true  // NEW PARAMETER
}
```

**Impact**: Reduced flexibility for power users

---

## Category 3: Output & Communication Issues (MEDIUM)

### Issue 3.1: Truncated Output in codex_local_results

**Severity**: MEDIUM
**Status**: 🔴 Unresolved

**Symptom**:

- `codex_local_results` returns file listing instead of implementation output
- Output appears truncated
- Can't see actual work performed
- "Success" claimed but no evidence

**Source**: `auditor-toolkit/main/docs/codex-control-mcp-debugging.md` lines 42-65

**Expected Output**:

```
Status: ✅ Success
Files Created:
- auditor_toolkit/ads/oauth_manager.py (200 lines)
- tests/settings/ads/unit/test_oauth_manager.py (4 tests)

Implementation Summary:
- OAuth2 flow implemented
- Token refresh logic added
- Error handling for invalid credentials
- All tests passing (4/4)
```

**Actual Output**:

```
Status: ✅ Success
[Truncated file listing]
```

**Impact**: Can't verify work was actually done

---

### Issue 3.2: Working Directory Isolation

**Severity**: MEDIUM
**Status**: 🔴 Unresolved

**Symptom**:

- Tasks from different working directories appear in same registry
- `showAll: false` should filter by current directory
- Stuck tasks from unrelated projects pollute output

**Source**: `auditor-toolkit/main/docs/codex-control-mcp-debugging.md` lines 68-93

**Expected Behavior**:

```typescript
// In /project-a/
codex_local_status({ showAll: false });
// Should show only tasks from /project-a/

// In /project-b/
codex_local_status({ showAll: false });
// Should show only tasks from /project-b/
```

**Actual Behavior**:

- Both projects see each other's tasks
- Filtering by working directory doesn't work correctly

**Impact**: Confusing status output, registry pollution

---

### Issue 3.3: Silent Execution Failures

**Severity**: MEDIUM
**Status**: 🔴 Unresolved

**Symptom**:

- Task execution fails silently
- No error messages
- No stderr output
- "Success" status despite no work done

**Source**: `auditor-toolkit/main/docs/codex-control-mcp-debugging.md` lines 308-319

**Root Cause Hypotheses**:

1. Sandbox mode blocking file writes
2. Permission errors not reported
3. Codex CLI failing without stderr
4. MCP communication failure

**Impact**: Unable to diagnose failures

---

## Summary Statistics

### By Severity

- **CRITICAL**: 2 issues (1.1, 1.2)
- **HIGH**: 1 issue (1.3)
- **MEDIUM**: 4 issues (1.4, 1.5, 3.1, 3.2, 3.3)
- **LOW**: 4 issues (2.1, 2.2, 2.3, 2.4)

### By Status

- **🔴 Unresolved**: 8 issues
- **🟡 Known Limitation/Enhancement**: 4 issues

### By Category

- **Task Execution & Registry**: 5 issues
- **Git Workflow**: 4 issues
- **Output & Communication**: 3 issues

---

## Successful Previous Uses (Baseline)

**Evidence that mcp-delegator worked before**:

From task registry in auditor-toolkit:

- ✅ T-local-mi1g1ab0n43qet: Enhanced Measurement Settings (27m ago, COMPLETED, files created)
- ✅ T-local-mi1flcoqcp6zue: Phase 1 GA4 Gap Implementation (39m ago, COMPLETED, files created)
- ✅ T-local-mhyl9ch7r44jsw: GBP Registry Integration (2d ago, COMPLETED, files created)

**Conclusion**: Issues appear to be recent regression or environment-specific.

---

## Environment Details

```
Working Directory: /Users/nathanschram/claude-code-tools/lba/tools/auditor-toolkit/main
Git Branch: feature/google-platforms-p0-p1-p2-foundation
Git Status: Clean (at time of testing)

Platform: darwin (macOS)
OS Version: Darwin 25.0.0
Python: 3.12.11 (venv at .venv)
Node.js: (used by MCP servers)
Claude Code: Sonnet 4.5 (claude-sonnet-4-5-20250929)

MCP Delegator: v3.4.0 (@littlebearapps/mcp-delegator)
MCP Config: .mcp.json (lean profile)
```

---

## Related Documents

- **Source 1**: `/Users/nathanschram/claude-code-tools/lba/tools/auditor-toolkit/main/docs/codex-git-workflow-issue.md`
- **Source 2**: `/Users/nathanschram/claude-code-tools/lba/tools/auditor-toolkit/main/docs/codex-control-mcp-debugging.md`
- **Resolution**: (To be created after fixes)

---

## Next Steps

See `INVESTIGATION-PLAN.md` for detailed investigation tasks and fix plan.

---

**Status**: 🔴 Critical issues blocking production use
**Priority**: P0 (Critical) for issues 1.1, 1.2, 1.3
**Owner**: Nathan/Claude (mcp-delegator maintainer)
**Estimated Fix Time**: 4-8 hours total
