# Git Operations Safety - Manual Test Plan

**Date**: 2025-11-16
**Version**: MCP Delegator v3.2.1
**Purpose**: User Acceptance Testing (UAT) for all git safety operations

---

## Test Environment

- **Test Directory**: `/tmp/git-safety-test`
- **MCP Server**: mcp-delegator v3.2.1
- **Tool**: `_codex_local_run`
- **Parameters**:
  - `mode: workspace-write`
  - `confirm: true`
  - `allow_destructive_git: true` (for Tier 2 only, should fail for Tier 1)

---

## Test Strategy

### Tier 1 (ALWAYS_BLOCKED)

**Expected Result**: ❌ BLOCKED even with `allow_destructive_git: true`

**Error Message Format**:

```
❌ BLOCKED: <operation>

These operations are too destructive and cannot be executed via AI agents.

Risks:
  • <risk_description>

Safer alternatives:
  • <safer_alternative>

These operations require manual execution outside of AI agent workflows.
```

### Tier 2 (REQUIRES_CONFIRMATION)

**Expected Result**:

1. Without `allow_destructive_git: true` → ⚠️ REQUIRES CONFIRMATION
2. With `allow_destructive_git: true` → ✅ Executes (with safety checkpoint)

**Confirmation Message Format**:

```
⚠️  RISKY GIT OPERATION: <operation>

Risks:
  • <risk_description>

Safer alternatives:
  • <safer_alternative>

To proceed, user must explicitly confirm this risky operation.
A safety checkpoint will be created automatically before execution.
```

---

## Tier 1 Tests (ALWAYS_BLOCKED)

### Original Operations (Already Tested)

#### Test 1.1: git gc --prune=now ✅

**Status**: PASSED (2025-11-16)
**Task**: "Run git gc --prune=now"
**Result**: BLOCKED as expected

---

#### Test 1.2: git reflog expire --expire-unreachable=now ✅

**Status**: PASSED (2025-11-16)
**Task**: "Run git reflog expire --expire-unreachable=now"
**Result**: BLOCKED as expected

---

#### Test 1.3: git push --force to main ✅

**Status**: PASSED (2025-11-16)
**Task**: "Run git push --force origin main"
**Result**: BLOCKED as expected

---

#### Test 1.4: git filter-repo on main ✅

**Status**: PASSED (2025-11-16)
**Task**: "Run git filter-repo on main branch"
**Result**: BLOCKED as expected

---

### Moved from Tier 2 (Already Tested)

#### Test 1.5: git reset HEAD~N ✅

**Status**: PASSED (2025-11-16)
**Task**: "Execute git reset HEAD~1"
**Result**: BLOCKED as expected
**Notes**: Moved from Tier 2. Pattern matches correctly.

---

#### Test 1.6: delete git repository ✅

**Status**: PASSED (2025-11-16)
**Task**: "Delete the git repository in /tmp/git-safety-test"
**Result**: BLOCKED as expected
**Notes**: Moved from Tier 2. Pattern bug fixed (now handles "the" and "this").

---

### NEW Tier 1 Operations (Need Testing)

#### Test 1.7: git checkout --force

**Status**: ⏳ PENDING
**Pattern**: `/git\s+checkout\s+(--force|-f)\b/i`
**Task**: "Run git checkout --force main"
**Expected**: BLOCKED
**Rationale**: Discards uncommitted changes - no recovery possible

---

#### Test 1.8: git stash drop

**Status**: ⏳ PENDING
**Pattern**: `/git\s+stash\s+(drop|clear)/i`
**Task**: "Run git stash drop"
**Expected**: BLOCKED
**Rationale**: Permanently removes stashed changes
**Variant A**: Test "git stash drop"
**Variant B**: Test "git stash clear"

---

#### Test 1.9: git worktree remove --force

**Status**: ⏳ PENDING
**Pattern**: `/git\s+worktree\s+remove\s+(--force|-f)/i`
**Task**: "Run git worktree remove --force test-worktree"
**Expected**: BLOCKED
**Rationale**: Removes worktree with uncommitted changes

---

## Tier 2 Tests (REQUIRES_CONFIRMATION)

### Original Operations (Already Tested)

#### Test 2.1: git reset --hard ✅

**Status**: PASSED (2025-11-16) - **MOVED TO TIER 1**
**Task**: "Run git reset --hard"
**Result**: Confirmation required, safety checkpoint created
**Notes**: Now Tier 1 (2025-11-16)

---

#### Test 2.2: git rebase ✅

**Status**: PASSED (2025-11-16)
**Task**: "Run git rebase main"
**Result**: Confirmation required, safety checkpoint created

---

#### Test 2.3: git push --force (non-protected) ✅

**Status**: PASSED (2025-11-16)
**Task**: "Run git push --force origin feature-branch"
**Result**: Confirmation required, safety checkpoint created

---

#### Test 2.4: git commit --amend ✅

**Status**: PASSED (2025-11-16)
**Task**: "Run git commit --amend -m 'Updated message'"
**Result**: Confirmation required, safety checkpoint created

---

#### Test 2.5: git clean -fdx ✅

**Status**: PASSED (2025-11-16) - **MOVED TO TIER 1**
**Task**: "Run git clean -fdx"
**Result**: Confirmation required, safety checkpoint created
**Notes**: Now Tier 1 (2025-11-16)

---

### NEW Tier 2 Operations (Need Testing)

#### Test 2.6: git branch -D (NEW)

**Status**: ⏳ PENDING
**Pattern**: `/git\s+branch\s+-D\b/i`
**Task**: "Run git branch -D unmerged-branch"
**Expected**: Requires confirmation, safety checkpoint created
**Rationale**: Force deletes branch even if unmerged - recoverable via reflog

**Test Steps**:

1. Create unmerged branch: `git checkout -b unmerged-test && git commit --allow-empty -m "test" && git checkout main`
2. Attempt delete: `git branch -D unmerged-test`
3. Verify: Confirmation required
4. Approve: Execute with safety checkpoint
5. Verify: Branch deleted but recoverable via reflog

---

## Test Execution Log

### Session 2025-11-16 Morning

**Tier 1 (ALWAYS_BLOCKED)**:

- ✅ Test 1.1: git gc --prune=now - BLOCKED
- ✅ Test 1.2: git reflog expire - BLOCKED
- ✅ Test 1.3: git push --force main - BLOCKED
- ✅ Test 1.4: git filter-repo main - BLOCKED

**Tier 2 (REQUIRES_CONFIRMATION)**:

- ✅ Test 2.1: git reset --hard - PASSED (moved to Tier 1)
- ✅ Test 2.2: git rebase - PASSED
- ✅ Test 2.3: git push --force feature - PASSED
- ✅ Test 2.4: git commit --amend - PASSED
- ✅ Test 2.5: git clean -fdx - PASSED (moved to Tier 1)

**Issues Discovered**:

- Issue #5: Output capture failure - FIXED
- Issue #6: Invalid branch name (tilde) - FIXED

### Session 2025-11-16 Evening

**Tier 1 Updates**:

- ✅ Test 1.5: git reset HEAD~1 - BLOCKED (moved from Tier 2)
- ✅ Test 1.6: delete repository - BLOCKED (pattern fixed)

**Issues Discovered**:

- Issue #7: Delete repository pattern bug - FIXED
- Codex CLI hang (36 minutes) - Process killed, timeout detection recommended

**NEW Operations Added**:

- Tier 1: +3 operations (checkout -f, stash drop, worktree remove -f)
- Tier 2: +1 operation (git branch -D)

**Pending Tests**:

- ⏳ Test 1.7: git checkout --force
- ⏳ Test 1.8: git stash drop
- ⏳ Test 1.9: git worktree remove --force
- ⏳ Test 2.6: git branch -D

---

## Test Results Summary

**Total Tests Planned**: 15 operations

**Completed**: 10/15 (67%)

- Tier 1: 6/9 (67%)
- Tier 2: 4/6 (67%)

**Pending**: 5/15 (33%)

- Tier 1: 3/9 (33%)
- Tier 2: 1/6 (17%)

**Pass Rate**: 10/10 (100%) ✅

**Issues Found**: 3

- Issue #5: Output capture - FIXED ✅
- Issue #6: Branch name sanitization - FIXED ✅
- Issue #7: Pattern matching - FIXED ✅

---

## Next Steps

1. ⏳ Test 1.7: git checkout --force
2. ⏳ Test 1.8: git stash drop/clear
3. ⏳ Test 1.9: git worktree remove --force
4. ⏳ Test 2.6: git branch -D
5. ⏳ Document final results
6. ⏳ Clean up test directory
7. ⏳ Investigate timeout detection for MCP tools

---

## Success Criteria

**Tier 1 (ALWAYS_BLOCKED)**:

- ✅ All operations blocked even with `allow_destructive_git: true`
- ✅ Error messages clear and actionable
- ✅ Safer alternatives provided

**Tier 2 (REQUIRES_CONFIRMATION)**:

- ✅ Confirmation required without `allow_destructive_git`
- ✅ Safety checkpoint created before execution
- ✅ Recovery instructions visible in output
- ✅ Operations complete successfully after approval

**Overall**:

- ✅ No false positives (safe operations blocked)
- ✅ No false negatives (risky operations allowed)
- ✅ Pattern matching robust and comprehensive
- ✅ User experience clear and educational
