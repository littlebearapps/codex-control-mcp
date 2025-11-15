# Production Test Plan - Codex Control MCP Issues #1 & #2

**Date**: 2025-11-15
**Version**: 3.1.0
**Tester**: (To be filled in)
**Test Environment**: Auditor Toolkit project

---

## Pre-Test Checklist

### ✅ Before Starting Tests

- [ ] Codex Control MCP built successfully (`npm run build`)
- [ ] MCP server configured in Claude Code (`.mcp.json`)
- [ ] Claude Code restarted to load latest MCP server
- [ ] Working in Auditor Toolkit project directory
- [ ] Git repository is clean (`git status`)
- [ ] On main branch (`git branch`)

### Verify MCP Server Loaded

```bash
# In Claude Code session
/mcp
```

**Expected**: Should show `codex-control` in list of MCP servers

---

## Issue #1: Git Operations Silent Failure

**Goal**: Verify that git verification layer detects and reports failed git operations.

### Test 1.1: Branch Creation Failure (Intentional)

**Scenario**: Ask Codex to create a branch, but don't actually create it.

**Steps**:

1. **Note current branch**:
   ```bash
   git branch
   # Expected: main (or current branch)
   ```

2. **Run Codex task** (in Claude Code):
   ```
   Use codex control to create a feature branch called "feature/test-git-verification" and commit a small documentation change
   ```

3. **Wait for task completion**

4. **Check results**:
   ```
   Use codex control to get results for [task-id]
   ```

5. **Verify git verification output**:
   - [ ] Shows "Git Verification Results" section
   - [ ] Reports branch creation status
   - [ ] If branch NOT created: shows ❌ error with recommendation
   - [ ] If branch WAS created: shows ✅ success

6. **Manually verify**:
   ```bash
   git branch
   # Check if feature/test-git-verification exists
   ```

**Expected Results**:
- If Codex failed to create branch: Git verification reports error + recommendation
- If Codex succeeded: Git verification shows ✅ for branch creation
- No silent failures (always get clear status)

**Actual Results**:
- [ ] PASS - Git verification accurately detected branch status
- [ ] FAIL - (describe what happened)

---

### Test 1.2: Commit Failure Detection

**Scenario**: Ask Codex to commit changes.

**Steps**:

1. **Make a small file change**:
   ```bash
   echo "# Test" >> TEST.md
   ```

2. **Run Codex task**:
   ```
   Use codex control to commit TEST.md with message "test: verify git commit detection"
   ```

3. **Check results**:
   ```
   Use codex control to get results for [task-id]
   ```

4. **Verify git verification output**:
   - [ ] Shows commit verification status
   - [ ] If commit failed: shows ❌ error with git command recommendation
   - [ ] If commit succeeded: shows ✅ with commit hash/message

5. **Manually verify**:
   ```bash
   git log -1 --oneline
   # Check if commit exists with expected message
   ```

**Expected Results**:
- Git verification accurately reports commit status
- If failed: provides actionable `git commit` command
- If succeeded: shows commit details

**Actual Results**:
- [ ] PASS - Commit verification accurate
- [ ] FAIL - (describe what happened)

---

### Test 1.3: File Staging Detection

**Scenario**: Verify detection of unstaged files.

**Steps**:

1. **Create multiple files**:
   ```bash
   echo "File 1" > test1.md
   echo "File 2" > test2.md
   ```

2. **Run Codex task**:
   ```
   Use codex control to stage test1.md and test2.md
   ```

3. **Check results**:
   ```
   Use codex control to get results for [task-id]
   ```

4. **Verify git verification output**:
   - [ ] Shows files staged count
   - [ ] Reports unstaged files if any remain
   - [ ] Provides `git add` recommendation if needed

5. **Manually verify**:
   ```bash
   git status --porcelain
   # Check staged vs unstaged
   ```

**Expected Results**:
- Git verification shows accurate staging status
- Reports both staged and unstaged files
- Provides recommendations for unstaged files

**Actual Results**:
- [ ] PASS - Staging verification accurate
- [ ] FAIL - (describe what happened)

---

### Test 1.4: Complete Git Workflow

**Scenario**: Full workflow with branch + commit + files.

**Steps**:

1. **Run complete task**:
   ```
   Use codex control to:
   1. Create feature branch "feature/complete-test"
   2. Add a new file docs/test-complete.md with some content
   3. Stage the file
   4. Commit with message "docs: add test completion doc"
   ```

2. **Check results**

3. **Verify all git operations**:
   - [ ] Branch creation status
   - [ ] File changes status
   - [ ] Staging status
   - [ ] Commit status

4. **Manual verification**:
   ```bash
   git branch | grep feature/complete-test
   git log -1 --pretty=format:"%s"
   git status
   ```

**Expected Results**:
- Git verification checks ALL operations
- Reports comprehensive status for each step
- Provides recommendations for any failures

**Actual Results**:
- [ ] PASS - Complete workflow verified accurately
- [ ] FAIL - (describe what happened)

---

### Test 1.5: No Git Operations (Control Test)

**Scenario**: Verify git verification doesn't run for non-git tasks.

**Steps**:

1. **Run non-git task**:
   ```
   Use codex control to analyze the README.md file for potential improvements (read-only mode)
   ```

2. **Check results**

3. **Verify git verification**:
   - [ ] No git verification section shown (skipped)
   - OR
   - [ ] Git verification section shows "No git operations expected"

**Expected Results**:
- Git verification gracefully skips for non-git tasks
- No false errors about missing git operations

**Actual Results**:
- [ ] PASS - Correctly skipped git verification
- [ ] FAIL - (describe what happened)

---

## Issue #2: Progress Visibility

**Goal**: Verify that progress tracking shows real-time updates during long-running tasks.

### Test 2.1: Progress Updates During Execution

**Scenario**: Start a long-running task and monitor progress.

**Steps**:

1. **Start long-running task** (5+ minutes):
   ```
   Use codex control to run the test suite and analyze all failures in detail (read-only mode)
   ```

   **Note the Task ID**: `T-local-___________`

2. **Wait 30 seconds**, then check status:
   ```
   Use codex control to check local status
   ```

3. **Verify progress display**:
   - [ ] Shows task in "Running Tasks" section
   - [ ] Shows elapsed time
   - [ ] Shows progress percentage (if available)
   - [ ] Shows current action (if available)
   - [ ] Shows activity metrics (files changed, commands executed)

4. **Wait another 60 seconds**, check status again:
   ```
   Use codex control to check local status
   ```

5. **Verify progress changed**:
   - [ ] Elapsed time increased
   - [ ] Progress percentage increased (if shown)
   - [ ] Current action changed (if shown)
   - [ ] Activity metrics updated

**Expected Results**:
- Progress updates appear in status output
- Progress percentage increases over time
- Current action shows what Codex is doing
- Activity metrics show work being done

**Actual Results**:
- [ ] PASS - Progress visible and updating
- [ ] FAIL - (describe what happened)

**Screenshots/Logs** (paste status output):
```
First check (30s):


Second check (90s):


```

---

### Test 2.2: Progress for Quick Tasks

**Scenario**: Verify progress works for short tasks (< 1 minute).

**Steps**:

1. **Start quick task**:
   ```
   Use codex control to list all Python files in the current directory (read-only mode)
   ```

2. **Immediately check status**:
   ```
   Use codex control to check local status
   ```

3. **Verify**:
   - [ ] Task shows as "working" or already "completed"
   - [ ] Progress information shown if task still running
   - [ ] No errors or crashes from rapid status check

**Expected Results**:
- Progress tracking works for quick tasks
- No performance issues
- Gracefully handles already-completed tasks

**Actual Results**:
- [ ] PASS - Works for quick tasks
- [ ] FAIL - (describe what happened)

---

### Test 2.3: Multiple Concurrent Tasks

**Scenario**: Verify progress tracking with multiple running tasks.

**Steps**:

1. **Start first task**:
   ```
   Use codex control to analyze all Python files for code quality issues (read-only mode)
   ```

   **Task ID 1**: `T-local-___________`

2. **Start second task** (different Claude Code session or wait a bit):
   ```
   Use codex control to analyze all TypeScript files for type errors (read-only mode)
   ```

   **Task ID 2**: `T-local-___________`

3. **Check status**:
   ```
   Use codex control to check local status
   ```

4. **Verify**:
   - [ ] Both tasks shown in "Running Tasks"
   - [ ] Each has independent progress tracking
   - [ ] No confusion between tasks
   - [ ] Progress updates correctly for each

**Expected Results**:
- Multiple tasks tracked independently
- Progress shown for each task separately
- No cross-contamination of progress data

**Actual Results**:
- [ ] PASS - Multiple tasks tracked correctly
- [ ] FAIL - (describe what happened)

---

### Test 2.4: Progress After Task Completion

**Scenario**: Verify progress info persists after completion.

**Steps**:

1. **Start and complete a task** (use a quick one)

2. **After completion, check status**:
   ```
   Use codex control to check local status
   ```

3. **Verify**:
   - [ ] Task shows in "Recently Completed" section
   - [ ] Progress information preserved (or not shown for completed tasks - either is OK)
   - [ ] Can get full results with task ID

4. **Get results**:
   ```
   Use codex control to get results for [task-id]
   ```

5. **Verify**:
   - [ ] Results include final output
   - [ ] No errors retrieving results

**Expected Results**:
- Completed tasks retrievable
- Results accessible after completion
- No errors from progress tracking after completion

**Actual Results**:
- [ ] PASS - Completed tasks handled correctly
- [ ] FAIL - (describe what happened)

---

### Test 2.5: Progress Update Frequency

**Scenario**: Verify progress updates at reasonable frequency (not too fast, not too slow).

**Steps**:

1. **Start long task** (10+ minutes):
   ```
   Use codex control to run comprehensive code analysis on the entire codebase (read-only mode)
   ```

2. **Monitor progress every 30 seconds for 3 minutes**:
   - Check at 0:30
   - Check at 1:00
   - Check at 1:30
   - Check at 2:00
   - Check at 2:30
   - Check at 3:00

3. **Record observations**:
   - How often does progress percentage change?
   - How often does current action change?
   - Are updates too frequent (overwhelming)?
   - Are updates too infrequent (not helpful)?

**Expected Results**:
- Progress updates every 10 events (rate limited)
- Updates appear helpful, not overwhelming
- Clear visibility into current activity

**Actual Results**:
- [ ] PASS - Update frequency is appropriate
- [ ] FAIL - Too frequent / Too infrequent (describe)

**Observations**:
```
0:30 -
1:00 -
1:30 -
2:00 -
2:30 -
3:00 -
```

---

## Integration Tests

### Test 3.1: Both Issues Together

**Scenario**: Verify both git verification AND progress tracking work together.

**Steps**:

1. **Start git-heavy task**:
   ```
   Use codex control to:
   1. Create feature branch "feature/integration-test"
   2. Add comprehensive tests for the authentication module
   3. Stage all new files
   4. Commit with message "test: add auth module tests"
   ```

2. **Monitor progress while task runs**:
   - Check status 2-3 times during execution
   - Verify progress updates appear

3. **After completion, check results**:
   - Verify git verification section appears
   - Verify all git operations reported

4. **Verify**:
   - [ ] Progress tracking worked during execution
   - [ ] Git verification ran after completion
   - [ ] Both features work without conflicts
   - [ ] No performance degradation

**Expected Results**:
- Both features work harmoniously
- No conflicts or errors
- Complete visibility into task execution and git operations

**Actual Results**:
- [ ] PASS - Both features work together
- [ ] FAIL - (describe what happened)

---

## Edge Cases & Error Scenarios

### Test 4.1: Task Cancellation

**Steps**:

1. **Start long task**

2. **Cancel it**:
   ```
   Use codex control to cancel [task-id]
   ```

3. **Verify**:
   - [ ] Progress tracking stops cleanly
   - [ ] No errors from incomplete progress data
   - [ ] Task marked as canceled

**Actual Results**:
- [ ] PASS
- [ ] FAIL - (describe)

---

### Test 4.2: Non-Git Directory

**Steps**:

1. **Test in /tmp or non-git directory**

2. **Verify**:
   - [ ] Git verification gracefully skips or reports "not a git repo"
   - [ ] No crashes or errors

**Actual Results**:
- [ ] PASS
- [ ] FAIL - (describe)

---

## Post-Test Summary

### Overall Results

**Issue #1 (Git Operations)**:
- Tests Passed: ___ / 6
- Tests Failed: ___ / 6
- Critical Issues Found: (list)

**Issue #2 (Progress Visibility)**:
- Tests Passed: ___ / 5
- Tests Failed: ___ / 5
- Critical Issues Found: (list)

**Integration Tests**:
- Tests Passed: ___ / 2
- Tests Failed: ___ / 2

### Issues Discovered

1. **Issue Description**:
   - Severity: Critical / High / Medium / Low
   - Reproduction Steps:
   - Expected vs Actual:

2. **Issue Description**:
   - (add more as needed)

### Recommendations

- [ ] Ready for production use
- [ ] Needs minor fixes (list)
- [ ] Needs major fixes (list)
- [ ] Needs additional testing (specify)

### Sign-off

**Tester**: _______________
**Date**: _______________
**Version Tested**: 3.1.0
**Approved**: Yes / No / Conditional

---

## Cleanup After Testing

```bash
# Remove test files
rm -f test1.md test2.md TEST.md

# Remove test branches
git branch -D feature/test-git-verification 2>/dev/null
git branch -D feature/complete-test 2>/dev/null
git branch -D feature/integration-test 2>/dev/null

# Reset to clean state
git checkout main
git status
```

---

**Test Plan Version**: 1.0
**Last Updated**: 2025-11-15
