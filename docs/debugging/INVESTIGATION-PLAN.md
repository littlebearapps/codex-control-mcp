# MCP Delegator Investigation Plan

**Date**: 2025-11-17
**Priority**: P0 (Critical)
**Estimated Total Time**: 4-8 hours

---

## Investigation Strategy

We'll tackle issues in priority order, starting with the foundation (registry location) and then moving to critical execution failures.

**Phase 1**: Foundation (Registry & Logging) - 1-2 hours
**Phase 2**: Critical Fixes (Execution & Success Reporting) - 2-3 hours
**Phase 3**: High Priority (Output & Isolation) - 1-2 hours
**Phase 4**: Enhancements (Git Workflow) - 1-2 hours

---

## Phase 1: Foundation (1-2 hours)

### Task 1.1: Locate Registry Database (30 min)

**Issue**: 1.4 - Registry database location unknown

**Investigation Steps**:
```bash
# 1. Check common locations
ls -la ~/.codex/
ls -la ~/.config/codex-control/
ls -la ~/.config/mcp-delegator/
ls -la ~/Library/Application\ Support/codex/
ls -la ~/Library/Application\ Support/mcp-delegator/

# 2. Search for database files
find ~ -name "*codex*.db" -o -name "*codex*.sqlite" 2>/dev/null | head -20
find ~ -name "*delegator*.db" -o -name "*delegator*.sqlite" 2>/dev/null | head -20
find ~ -name "*task*.db" -o -name "*task*.sqlite" 2>/dev/null | head -20

# 3. Search for JSON registry
find ~/.config -name "*task*.json" 2>/dev/null
find ~/.codex -name "*.json" 2>/dev/null

# 4. Check source code for registry path
cd /Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/mcp-delegator
grep -r "task.*registry" src/
grep -r "registry.*path" src/
grep -r "\.db\|\.sqlite" src/
```

**Expected Outcomes**:
1. Find registry file location
2. Identify registry format (SQLite vs JSON)
3. Document schema/structure
4. Check file permissions

**Success Criteria**:
- [ ] Registry file located
- [ ] Format identified
- [ ] Schema documented
- [ ] Permissions verified

---

### Task 1.2: Document Registry Structure (30 min)

**Investigation Steps**:
```bash
# If SQLite:
sqlite3 <registry-path> ".schema"
sqlite3 <registry-path> "SELECT * FROM tasks ORDER BY created_at DESC LIMIT 5;"

# If JSON:
cat <registry-path> | jq .
cat <registry-path> | jq 'keys'
cat <registry-path> | jq '.tasks | length'
```

**Document**:
1. Table/object structure
2. Key fields (task_id, status, working_dir, etc.)
3. Indexes (if SQLite)
4. Constraints
5. Example records

**Success Criteria**:
- [ ] Schema fully documented
- [ ] Example records captured
- [ ] Field meanings understood

---

### Task 1.3: Add Execution Logging (1 hour)

**Issue**: 1.5 - No execution logs or diagnostics

**Investigation**:
```typescript
// Check current logging in src/
// Identify where to add logs:
// 1. Process spawning (executor/process_manager.ts)
// 2. Task lifecycle (tools/local_exec.ts)
// 3. Registry updates (state/task_registry.ts)
// 4. Error paths (executor/error_mapper.ts)
```

**Implementation Plan**:
1. Add debug logging to process_manager.ts
2. Log task state transitions in task_registry.ts
3. Log stdout/stderr from Codex processes
4. Add log file output (optional stderr for now)

**Log Format**:
```
[YYYY-MM-DD HH:MM:SS] [LEVEL] [COMPONENT] Message
[2025-11-17 14:30:00] [INFO] [ProcessManager] Starting task T-local-abc123
[2025-11-17 14:30:01] [DEBUG] [Registry] Task T-local-abc123 -> running
[2025-11-17 14:32:00] [ERROR] [ProcessManager] Task T-local-abc123 failed: ...
```

**Success Criteria**:
- [ ] Logging added to all critical paths
- [ ] Log level configurable (env var)
- [ ] Logs include task ID, timestamps, state
- [ ] Error scenarios logged with details

---

## Phase 2: Critical Fixes (2-3 hours)

### Task 2.1: Investigate Task Execution Failure (1 hour)

**Issue**: 1.1 - Tasks start but never execute

**Investigation Steps**:

```typescript
// 1. Check process spawning in src/executor/process_manager.ts
// - Is spawn() called?
// - Are args correct?
// - Does process start?

// 2. Check registry updates in src/state/task_registry.ts
// - Is task added to registry on creation?
// - Is working_dir set correctly?
// - Is status initialized?

// 3. Check SDK integration in src/tools/local_exec.ts
// - Is SDK.startThread() called?
// - Are errors caught and reported?
// - Is thread ID returned?

// 4. Test minimal execution
{
  task: "echo 'test' > /tmp/mcp-delegator-test.txt",
  mode: "workspace-write"
}
// Check: Does file get created?
```

**Diagnostic Commands**:
```bash
# 1. Check for running processes
ps aux | grep codex | grep -v grep

# 2. Check for zombie processes
ps aux | grep defunct

# 3. Monitor process creation
# (Run this in separate terminal while creating task)
while true; do ps aux | grep codex | grep -v grep; sleep 1; done

# 4. Check system logs
log show --predicate 'process == "codex"' --info --last 5m
```

**Root Cause Hypotheses**:
1. **Process not spawning**: spawn() fails silently
2. **Process exits immediately**: Codex CLI auth or config issue
3. **Registry not updating**: Task created but registry write fails
4. **Working directory mismatch**: Task runs but in wrong directory

**Success Criteria**:
- [ ] Root cause identified
- [ ] Reproduction case created
- [ ] Fix implemented
- [ ] Test case passing

---

### Task 2.2: Investigate False Success Reports (1 hour)

**Issue**: 1.2 - Tasks report success without creating files

**Investigation Steps**:

```typescript
// 1. Check result parsing in src/tools/local_results.ts
// - How is "success" determined?
// - Is stdout/stderr checked?
// - Are file changes verified?

// 2. Check metadata extraction in src/utils/metadata_extractor.ts
// - Is file_operations populated?
// - Are git changes detected?
// - Is output truncated?

// 3. Test with known-good task
{
  task: "Create file /tmp/test-success.txt with content 'success test'",
  mode: "workspace-write"
}
// Expected: File created, success reported
// Actual: ???
```

**Diagnostic Queries**:
```sql
-- If SQLite registry
SELECT task_id, status, output, error
FROM tasks
WHERE task_id = 'T-local-mi1gob5gxgdvar';

-- Check for truncation
SELECT task_id, length(output), length(error)
FROM tasks
ORDER BY created_at DESC
LIMIT 10;
```

**Root Cause Hypotheses**:
1. **Output truncation**: Large output truncated, missing file info
2. **Metadata extraction bug**: File operations not detected
3. **Dry-run mode**: Task runs in preview mode instead of write
4. **Sandbox blocking**: Files written but outside working directory

**Success Criteria**:
- [ ] Root cause identified
- [ ] File creation verified in tests
- [ ] Success reporting accurate
- [ ] Output includes file list

---

### Task 2.3: Fix Stuck Tasks Accumulation (1 hour)

**Issue**: 1.3 - Stuck tasks in registry for 8+ hours

**Investigation Steps**:

```typescript
// 1. Check cleanup logic in src/tools/cleanup_registry.ts
// - Is cleanup tool being called?
// - What are cleanup criteria?
// - Is it working correctly?

// 2. Check timeout handling in src/executor/timeout_watchdog.ts
// - Does watchdog update registry on timeout?
// - Are timed-out tasks marked as failed?
// - Is process cleanup working?

// 3. Check registry state transitions
// - Can tasks get stuck in "running"?
// - Are there edge cases where status isn't updated?
// - What happens if process crashes?
```

**Manual Cleanup Test**:
```typescript
// Use cleanup_registry tool
{
  workingDir: "/Users/nathanschram/claude-code-tools/lba/tools/auditor-toolkit/main",
  dryRun: true,
  olderThanHours: 1
}

// Check results:
// - How many tasks would be cleaned?
// - Are stuck tasks included?
// - Would it fix the registry?
```

**Automatic Cleanup Implementation**:
```typescript
// Option 1: Automatic cleanup on status check
// - When codex_local_status is called
// - Clean up tasks older than 24 hours
// - Clean up failed tasks older than 1 hour

// Option 2: Background cleanup thread
// - Run cleanup every 15 minutes
// - Clean up stuck tasks (running > 2 hours)
// - Clean up old completed tasks (> 7 days)

// Option 3: Cleanup on tool invocation
// - Before starting new task
// - Clean up orphaned tasks
// - Free up resources
```

**Success Criteria**:
- [ ] Stuck tasks identified in registry
- [ ] Cleanup logic fixed/implemented
- [ ] Manual cleanup works
- [ ] Automatic cleanup scheduled
- [ ] Registry shows 0 stuck tasks after fix

---

## Phase 3: High Priority Fixes (1-2 hours)

### Task 3.1: Fix Truncated Output (30 min)

**Issue**: 3.1 - codex_local_results returns truncated output

**Investigation**:
```typescript
// Check output limits in src/tools/local_results.ts
// - Is there a max length?
// - Is output being truncated?
// - Where is truncation happening?

// Check metadata extraction
// - Is metadata_extractor.ts working?
// - Are file operations being extracted?
// - Is structured metadata returned?
```

**Fix Approaches**:
1. **Increase output limit**: Allow larger output (with configurable max)
2. **Prioritize metadata**: Show structured metadata first, full output later
3. **Streaming output**: Return output in chunks
4. **Summary + details**: Show summary first, full output on request

**Success Criteria**:
- [ ] Output not truncated for normal tasks
- [ ] Large outputs handled gracefully
- [ ] File operations clearly listed
- [ ] Implementation details visible

---

### Task 3.2: Fix Working Directory Isolation (30 min)

**Issue**: 3.2 - Tasks from different directories mixed in registry

**Investigation**:
```typescript
// Check filtering in src/tools/local_status.ts
// - How is workingDir filter applied?
// - Is path comparison working?
// - Are relative paths normalized?

// Check registry queries
// - SQL/JSON filter syntax
// - Path matching logic
// - Case sensitivity issues
```

**Test Cases**:
```typescript
// In /project-a/
codex_local_status({ showAll: false })
// Should show ONLY /project-a/ tasks

// In /project-b/
codex_local_status({ showAll: false })
// Should show ONLY /project-b/ tasks

// In /project-a/
codex_local_status({ showAll: true })
// Should show ALL tasks from ALL directories
```

**Success Criteria**:
- [ ] showAll: false filters correctly
- [ ] Path normalization works (absolute vs relative)
- [ ] No cross-contamination between projects
- [ ] showAll: true still shows everything

---

### Task 3.3: Add Error Reporting for Silent Failures (30 min)

**Issue**: 3.3 - Silent execution failures with no error messages

**Investigation**:
```typescript
// Check error handling in:
// 1. src/executor/process_manager.ts - process spawn errors
// 2. src/tools/local_exec.ts - SDK errors
// 3. src/executor/error_mapper.ts - error translation

// Identify silent failure scenarios:
// - Permission denied (no stderr)
// - Sandbox blocking (no error)
// - Codex CLI auth failure (silent)
// - File write failure (no exception)
```

**Fix Implementation**:
```typescript
// Add explicit checks:
// 1. After spawn(), check process.pid
// 2. After file write, verify file exists
// 3. After task completion, verify expected outputs
// 4. Capture and report ALL stderr

// Error reporting:
// - Return stderr in error field
// - Add error_type field (spawn, auth, permission, etc.)
// - Include actionable suggestions
// - Log all errors to diagnostic log
```

**Success Criteria**:
- [ ] All failure modes have error messages
- [ ] stderr captured and returned
- [ ] Error types categorized
- [ ] Suggestions provided for common errors

---

## Phase 4: Git Workflow Enhancements (1-2 hours)

### Task 4.1: Design Flexible Git Verification (30 min)

**Issues**: 2.1, 2.2, 2.4

**Design Goals**:
1. Allow dirty working directory with opt-in flag
2. Support auto-stash workflow
3. Distinguish implementation success from git workflow issues
4. Provide clear error messages and recommendations

**API Design**:
```typescript
// Option 1: Simple flag
{
  task: "Create branch and implement",
  mode: "workspace-write",
  allowDirtyWorkingDir: true  // NEW
}

// Option 2: Git options object
{
  task: "Create branch and implement",
  mode: "workspace-write",
  gitOptions: {
    allowDirty: true,
    autoStash: true,
    stashMessage: "Auto-stash before branch creation"
  }
}

// Option 3: Workflow modes
{
  task: "Create branch and implement",
  mode: "workspace-write",
  gitWorkflow: "flexible"  // strict | flexible | manual
}
```

**Implementation Approaches**:
1. **Add flag to codex_local_exec**: Pass to Codex SDK
2. **Wrap git commands**: Auto-stash in MCP server
3. **Document workaround**: User manual git workflow

**Success Criteria**:
- [ ] API designed and documented
- [ ] Implementation approach selected
- [ ] Backward compatibility maintained
- [ ] Clear migration path

---

### Task 4.2: Improve Task Status Granularity (30 min)

**Issue**: 2.3 - Only "Success" or "Failed" status

**Design**:
```typescript
// Proposed status levels:
type TaskStatus =
  | "pending"      // Not started
  | "running"      // Executing
  | "completed"    // Full success
  | "partial"      // Implementation OK, workflow issues
  | "warning"      // Succeeded with warnings
  | "failed"       // Critical failure
  | "canceled"     // User canceled
  | "timeout"      // Exceeded time limit

// Status metadata:
interface TaskStatusDetail {
  status: TaskStatus;
  implementationSuccess: boolean;  // Code/files created
  gitWorkflowSuccess: boolean;     // Branch/commit succeeded
  testsSuccess: boolean;           // Tests passed
  warnings: string[];              // Non-critical issues
  errors: string[];                // Critical issues
}
```

**Implementation**:
```typescript
// In metadata_extractor.ts:
// - Parse git verification results
// - Parse test results
// - Determine overall status
// - Populate warnings/errors

// In local_results.ts:
// - Return TaskStatusDetail
// - Format for display
// - Include actionable next steps
```

**Success Criteria**:
- [ ] Status levels defined
- [ ] Metadata extraction updated
- [ ] Display logic implemented
- [ ] Documentation updated

---

## Testing Strategy

### Unit Tests
```typescript
// test/unit/registry.test.ts
describe('Task Registry', () => {
  test('tasks appear in registry after creation');
  test('working directory filter works correctly');
  test('stuck tasks are cleaned up');
  test('status transitions correctly');
});

// test/unit/execution.test.ts
describe('Task Execution', () => {
  test('simple file creation succeeds');
  test('stdout/stderr captured correctly');
  test('errors reported with details');
  test('silent failures detected');
});

// test/unit/git-workflow.test.ts
describe('Git Workflow', () => {
  test('clean working directory allows branch creation');
  test('dirty working directory with allow flag succeeds');
  test('auto-stash workflow works correctly');
  test('status granularity reflects git state');
});
```

### Integration Tests
```typescript
// test/integration/auditor-toolkit.test.ts
describe('Auditor Toolkit Scenarios', () => {
  test('Phase 0 implementation with dirty working dir');
  test('Large file creation (Mutate Writer)');
  test('Multiple files with tests');
  test('Git workflow with uncommitted changes');
});
```

### Regression Tests
```typescript
// Ensure fixes don't break existing functionality
describe('Regression Tests', () => {
  test('successful tasks from v3.4.0 still work');
  test('registry isolation still works');
  test('timeout detection still works');
  test('error redaction still works');
});
```

---

## Success Metrics

### Phase 1 (Foundation)
- [ ] Registry location documented
- [ ] Execution logging implemented
- [ ] Diagnostic commands available

### Phase 2 (Critical Fixes)
- [ ] Tasks execute and appear in registry (Issue 1.1 ✅)
- [ ] Success reports match actual file creation (Issue 1.2 ✅)
- [ ] No stuck tasks in registry (Issue 1.3 ✅)

### Phase 3 (High Priority)
- [ ] Full output returned, not truncated (Issue 3.1 ✅)
- [ ] Working directory isolation works (Issue 3.2 ✅)
- [ ] All failures have error messages (Issue 3.3 ✅)

### Phase 4 (Enhancements)
- [ ] Git workflow more flexible (Issues 2.1, 2.2, 2.4 ✅)
- [ ] Task status accurately reflects outcome (Issue 2.3 ✅)

### Overall
- [ ] All 12 issues resolved or enhancement path defined
- [ ] Auditor toolkit scenarios working
- [ ] Test coverage ≥ 80%
- [ ] Documentation updated

---

## Rollback Plan

If fixes cause regressions:

1. **Immediate**: Revert to v3.4.0
2. **Short-term**: Create hotfix branch
3. **Long-term**: Re-test fixes in isolation

**Rollback Command**:
```bash
npm uninstall -g @littlebearapps/mcp-delegator
npm install -g @littlebearapps/mcp-delegator@3.4.0
```

---

## Documentation Updates

After fixes:
1. Update `quickrefs/tools.md` with new parameters
2. Update `quickrefs/troubleshooting.md` with registry location
3. Update `CLAUDE.md` with version and changelog
4. Create `docs/debugging/RESOLUTION.md` with fix details
5. Update `README.md` if API changes

---

**Status**: 🟡 Investigation plan ready
**Next Step**: Start Task 1.1 (Locate Registry Database)
**Priority**: P0
**Blocking**: Auditor Toolkit Phase 3 implementation
