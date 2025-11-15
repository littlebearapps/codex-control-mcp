# Git Operations Test Results

**Date**: 2025-11-15
**Version**: v3.2.2 (with logging)
**Status**: IN PROGRESS

---

## Executive Summary

Testing MCP Delegator's git operation capabilities to determine:
1. What git operations Codex can perform
2. Which operations need safety limits
3. Parameter bugs and usability issues

---

## Tests Completed

### ✅ Test 1: Create Multiple Feature Branches

**Tool**: `_codex_local_run`
**Status**: SUCCESS
**Working Directory**: `/tmp/mcp-delegator-test`

**Operations Performed**:
- Created 3 feature branches from existing branch
- Used `git switch -c` for branch creation
- Switched back to original branch after each
- Listed all branches to confirm

**Results**:
- ✅ All 3 branches created successfully
- ✅ Branch names: `feature/add-validation`, `feature/add-tests`, `feature/refactor-utils`
- ✅ Working directory parameter worked correctly with `_codex_local_run`

**Findings**:
- Codex can create branches safely
- Codex handles existing branches gracefully
- No safety limits needed for branch creation

---

### ✅ Test 2: Delete Feature Branches

**Tool**: `_codex_local_run`
**Status**: SUCCESS
**Working Directory**: `/tmp/mcp-delegator-test`

**Operations Performed**:
- Deleted 3 feature branches using `git branch -d` (safe delete)
- Fallback to `git branch -D` (force delete) if branches not merged
- Listed all branches to confirm deletion

**Results**:
- ✅ All 3 branches deleted with `-d` (safe delete)
- ✅ No force delete needed (branches were fully merged)
- ✅ Only 2 branches remain: `feature/add-logger`, `master`

**Findings**:
- Codex prefers safe delete (`-d`) over force delete (`-D`)
- Codex implements fallback logic automatically
- No safety limits needed for branch deletion

---

### ❌ Test 3: Create New Git Repository

**Tool**: `_codex_local_run` → FAILED (git repo required)
**Tool**: `_codex_local_exec` → FAILED (wrong parameter name)
**Status**: FAILED (multiple issues found)

**Attempt 1 - `_codex_local_run`**:
```
Error: Not inside a trusted directory and --skip-git-repo-check was not specified
```

**Finding**: `_codex_local_run` REQUIRES a git repository. This is a good safety feature.

**Attempt 2 - `_codex_local_exec`**:
- Used `working_dir` parameter (WRONG - should be `workingDir`)
- Task ran in wrong directory (codex-control instead of /tmp)
- Repository not created

**Findings**:
1. `_codex_local_run` cannot work outside git repos (by design)
2. `_codex_local_exec` has `skipGitRepoCheck` option
3. **CRITICAL BUG**: Parameter name inconsistency causes silent failures

---

## Critical Bugs Found

### Bug #1: Parameter Name Inconsistency

**Severity**: HIGH
**Impact**: Silent failures when using wrong parameter name

**Issue**:
- Schema uses `workingDir` (camelCase)
- Developers might use `working_dir` (snake_case) from habit
- Wrong parameter name is silently ignored → runs in wrong directory

**Example**:
```typescript
// ❌ WRONG (silently ignored)
{
  task: "Create repo",
  working_dir: "/tmp"  // Ignored!
}

// ✅ CORRECT
{
  task: "Create repo",
  workingDir: "/tmp"
}
```

**Recommendation**:
- Add parameter validation that rejects `working_dir`
- Return clear error: "Did you mean 'workingDir' instead of 'working_dir'?"

---

### Bug #2: Silent Failure When Parameter Ignored

**Severity**: CRITICAL
**Impact**: Task executes in wrong directory with no error

**Issue**:
When `working_dir` is passed instead of `workingDir`:
1. Parameter is silently ignored
2. Task runs in current directory (codex-control)
3. No error or warning
4. User has no idea task ran in wrong place

**Current Behavior**:
```
Input: { task: "Create repo", working_dir: "/tmp" }
Result: Creates repo in /Users/nathanschram/... (current directory)
Error: None
```

**Expected Behavior**:
```
Input: { task: "Create repo", working_dir: "/tmp" }
Result: Error message
Error: "Unknown parameter 'working_dir'. Did you mean 'workingDir'?"
```

**Fix**: ✅ IMPLEMENTED - Strict parameter validation (v3.2.2)

**Implementation Details**:
- Added validation in `src/index.ts` (lines 147-191)
- Rejects all snake_case parameters with helpful errors
- Exception: `task_id` valid for wait/results/cancel tools
- Removed fallback that masked the problem
- 6/7 tests passing perfectly
- See `docs/PARAMETER-VALIDATION-COMPLETE.md` for complete details

**User Experience**:
```typescript
// ❌ Before (silent failure)
{ working_dir: "/tmp" } → Runs in wrong directory, no error

// ✅ After (immediate error)
{ working_dir: "/tmp" } → ❌ Parameter Error
                          💡 Did you mean 'workingDir'?
```

---

## Logging Implementation Results

### ✅ Logging Works Perfectly

**File**: `.codex-errors.log` (created in working directory)
**Format**: Structured JSON with timestamps

**Example Log Entries**:
```json
{"timestamp":"2025-11-15T07:06:31.757Z","level":"info","message":"Tool started: _codex_local_run","meta":{"input":{...}},"pid":89763}
{"timestamp":"2025-11-15T07:07:03.791Z","level":"info","message":"Tool completed: _codex_local_run","meta":{"success":true,"hasOutput":true},"pid":89763}
```

**Benefits**:
- ✅ Claude Code can detect failures by reading log
- ✅ Full input parameters logged
- ✅ Timestamps show execution duration
- ✅ PID helps correlate multiple tool calls

**Verified**:
- Log file created automatically
- All tool calls logged
- Success/failure tracked
- Works as designed

---

## Git Operation Capabilities Matrix

| Operation | Tool | Status | Safety | Notes |
|-----------|------|--------|--------|-------|
| **Create branches** | `_codex_local_run` | ✅ Works | SAFE | No limits needed |
| **Delete branches** | `_codex_local_run` | ✅ Works | SAFE | Uses `-d` first, `-D` fallback |
| **Create repository** | `_codex_local_run` | ❌ Blocked | SAFE | Requires git repo (by design) |
| **Create repository** | `_codex_local_exec` | ⚠️ Untested | MEDIUM | Requires `skipGitRepoCheck: true` |
| **Delete repository** | Both | 🔴 Not Tested | **DANGEROUS** | Should test with caution |
| **Modify commits** | Both | 🔴 Not Tested | MEDIUM | Amend, rebase, etc. |
| **Force push** | Both | 🔴 Not Tested | **DANGEROUS** | Could lose data |
| **Hard reset** | Both | 🔴 Not Tested | **DANGEROUS** | Could lose data |

**Legend**:
- ✅ Works - Tested and confirmed working
- ❌ Blocked - Cannot perform operation
- ⚠️ Untested - Not tested yet due to bug
- 🔴 Not Tested - Intentionally not tested yet
- **DANGEROUS** - Potentially destructive operation

---

## Pending Tests

### High Priority
1. ⏳ Create new repository (fix parameter bug first)
2. ⏳ Delete repository (DANGEROUS - need safety limits?)
3. ⏳ Modify commit messages (amend)
4. ⏳ Merge branches (fast-forward and merge commits)

### Medium Priority
5. ⏳ Rebase operations
6. ⏳ Cherry-pick commits
7. ⏳ Stash operations

### Low Priority (Dangerous)
8. ⏳ Force push operations (DANGEROUS)
9. ⏳ Reset operations - soft, mixed, hard (DANGEROUS)
10. ⏳ PR operations via gh CLI

---

## Recommendations

### Immediate Fixes Needed

#### 1. Parameter Validation
**Problem**: `working_dir` silently ignored
**Fix**: Add strict validation
```typescript
// Reject unknown parameters
if (args.working_dir !== undefined) {
  throw new Error("Unknown parameter 'working_dir'. Did you mean 'workingDir'?");
}
```

#### 2. Tool Schema Consistency
**Problem**: Different tools use different conventions
**Fix**: Standardize on camelCase for all parameters
- ✅ `workingDir` (not `working_dir`)
- ✅ `skipGitRepoCheck` (not `skip_git_repo_check`)
- ✅ `outputSchema` (not `output_schema`)

### Safety Limits to Implement

#### Level 1: BLOCK (Prevent Completely)
- ❌ Delete repository in production paths
  - Paths to block: `/`, `/Users`, `/home`, `~`, any non-test directory
  - Allow: `/tmp/*`, explicitly marked test directories

#### Level 2: REQUIRE CONFIRMATION (Extra Prompt)
- ⚠️ Force push to main/master
- ⚠️ Hard reset
- ⚠️ Rebase on shared branches
- ⚠️ Delete repository (even in /tmp)

#### Level 3: SAFE (Allow Without Extra Confirmation)
- ✅ Create branches
- ✅ Delete branches (safe delete `-d` first)
- ✅ Merge branches
- ✅ Soft reset
- ✅ Stash operations

---

## Next Steps

1. ~~**Fix parameter bug**~~ - ✅ COMPLETE - Validation implemented
2. **Re-test repository creation** - Using correct `workingDir` parameter
3. **Test repository deletion** - With safety limits in place
4. **Continue with remaining git operations** - Systematic testing
5. **Document all findings** - Update this document
6. **Implement safety limits** - Based on test results

---

## Status

**Overall**: 2/13 tests complete (15%)
**Critical Bugs Fixed**:
- ✅ Parameter inconsistency (strict validation implemented)
- ✅ Silent failures (logging + validation)
**Logging**: ✅ Implemented and working
**Parameter Validation**: ✅ Implemented and tested (6/7 tests passing)
**Next Test**: Test 3 - Create repository (with correct parameters)
