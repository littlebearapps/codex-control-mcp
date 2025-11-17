# Issue 3.3 Investigation: Silent Execution Failures

**Date**: 2025-11-17
**Investigator**: Claude (Sonnet 4.5)
**Status**: 🔍 Investigation Complete - ✅ ROOT CAUSE IDENTIFIED

---

## Issue Summary

**Reported Symptom**:
- Task execution fails silently
- No error messages visible to user
- No stderr output captured
- "Success" status despite no work done
- Unable to diagnose what went wrong

**Expected Behavior**:
```
Task fails → Clear error message → User can debug
```

**Actual Behavior**:
```
Task fails silently → "Success" reported → User confused
```

**Source**: `docs/debugging/AUDITOR-TOOLKIT-ISSUES.md` lines 351-382

---

## Relationship to Other Issues

**This Issue is Related To**:
- **Issue 1.2**: Tasks report success without creating files (root cause found)
  - Issue 1.2 focuses on: **False success determination**
  - Issue 3.3 focuses on: **Missing error reporting and diagnostics**
  - Both share the same underlying causes

**Shared Root Causes**:
1. Success determined by git verification only (not actual task completion)
2. Limited event type capture (missing error indicators)
3. No validation of expected outcomes
4. Codex SDK suppresses error output (Issue #1367 from Codex SDK)

**Key Difference**:
- Issue 1.2: "Why does it say success when files weren't created?"
- Issue 3.3: "Why can't I see what went wrong?"

---

## Code Analysis

### Error Capture in SDK Execution

**File**: `src/tools/local_exec.ts` lines 263-320

```typescript
// Background execution async IIFE
(async () => {
  try {
    const { events } = await thread.runStreamed(validated.task, runOptions);

    let finalOutput = '';
    let eventCount = 0;
    const eventLog: any[] = [];

    for await (const event of events) {
      eventLog.push(event);
      eventCount++;

      // ✅ Capture output events
      if (event.type === 'item.completed') {
        const item = (event as any).item;

        if (item?.type === 'command_execution' && item.aggregated_output) {
          finalOutput += item.aggregated_output + '\n';  // ✅ Captured
        }
        else if (item?.type === 'agent_message' && item.text) {
          finalOutput += item.text + '\n';  // ✅ Captured
        }

        // ❌ MISSING: No explicit error event handling
        // ❌ MISSING: No stderr capture
        // ❌ MISSING: No failure indicators
      }
    }

    // ✅ Success determined by git verification (Issue 1.2)
    const finalStatus = gitVerification.errors.length === 0 ? 'completed' : 'completed_with_errors';

    globalTaskRegistry.updateTask(taskId, {
      status: finalStatus,
      result: JSON.stringify({
        success: gitVerification.errors.length === 0,  // ⚠️ Only checks git errors
        finalOutput: finalOutput || `SDK execution complete (${eventCount} events)`,
      }),
    });

  } catch (error) {
    // ✅ Exception errors ARE captured
    console.error(`[LocalExec:${taskId}] ❌ Error:`, error);

    globalTaskRegistry.updateTask(taskId, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),  // ✅ Stored
    });
  }
})();
```

**What Gets Captured**:
- ✅ Exception errors (try-catch) → Stored in `task.error` field
- ✅ `command_execution` output → Added to `finalOutput`
- ✅ `agent_message` text → Added to `finalOutput`

**What DOESN'T Get Captured**:
- ❌ Codex SDK internal errors that don't throw exceptions
- ❌ stderr output from Codex CLI
- ❌ Error-related event types (if they exist)
- ❌ Permission denied errors
- ❌ File write failures
- ❌ Silent failures (Codex runs but does nothing)

---

### Error Display in Results

**File**: `src/tools/local_results.ts` lines 51-61

```typescript
// Check if failed
if (task.status === 'failed') {
  return {
    content: [
      {
        type: 'text',
        text: `❌ Task Failed\n\n**Task ID**: \`${input.task_id}\`\n\n**Error**: ${task.error || 'Unknown error'}\n\n**Task**: ${task.instruction}`,
      },
    ],
    isError: true,
  };
}
```

**Error Display**:
- ✅ Shows error message IF `task.status === 'failed'`
- ✅ Shows `task.error` field content
- ❌ But if task marked as "completed" with no evidence, error not shown!

**The Problem**:
```typescript
// Scenario: Silent failure
Task marked as: status = 'completed'
Success field: success = true (git verification passed)
Error field: error = null (no exception thrown)
finalOutput: "SDK execution complete (23 events)" (generic fallback)

User sees: "Status: ✅ Success"
Reality: Nothing was done, but no errors detected
```

---

### Error Reporting in Status

**File**: `src/tools/local_status.ts` lines 125-133

```typescript
// Failed tasks
if (failedTasks.length > 0) {
  message += `#### ❌ Recent Failures\n\n`;
  for (const task of failedTasks) {
    const ago = this.formatTimeAgo(new Date(task.createdAt));
    message += `- **${task.id}**: ${task.instruction.substring(0, 60)}...\n`;
    if (task.error) {
      message += `  Error: ${task.error.substring(0, 100)}\n`;  // ✅ Shows error
    }
  }
}
```

**Status Display**:
- ✅ Shows failed tasks separately
- ✅ Shows first 100 chars of error message
- ❌ Only works if `task.status === 'failed'`
- ❌ Silent failures marked as "completed" don't appear in this section

---

## Root Cause Analysis

### The Chain of Silent Failures

**Scenario**: User asks Codex to create files in workspace-write mode

**What Can Go Wrong (Without Throwing Exceptions)**:

1. **Codex SDK Internal Failure**:
   ```
   Codex CLI: "I'll create the files"
   Reality: Permission denied writing to directory
   SDK: No exception thrown, just silent failure
   Events: Normal completion events emitted
   Result: task.status = 'completed', success = true
   ```

2. **Mode Mismatch**:
   ```
   User expects: Files created (workspace-write mode)
   Codex runs in: Read-only mode (due to bug/misconfiguration)
   Events: "Analysis complete" messages
   Result: task.status = 'completed', success = true (no files, but no "error")
   ```

3. **Git Safety Refusal**:
   ```
   Codex: "Working tree is dirty, refusing to modify files"
   Events: Agent messages explaining refusal
   SDK: No exception, just explanatory text
   Result: task.status = 'completed', success = true (git verification has no errors)
   ```

4. **Suppressed Error Output (Issue #1367)**:
   ```
   Codex CLI: Runs command that fails (exit code 1)
   SDK: Suppresses stdout/stderr for non-zero exit codes
   Events: Completion events emitted without error details
   Result: task.status = 'completed', success = true (no evidence of failure)
   ```

---

### Why Current Error Detection Fails

**Current Detection Logic**:
```typescript
try {
  // Execute task
  const { events } = await thread.runStreamed(task, options);

  // Process events (no error checking)
  for await (const event of events) {
    // Just capture output, don't look for errors
  }

  // Determine success ONLY from git verification
  const success = gitVerification.errors.length === 0;

} catch (error) {
  // Only catches JavaScript exceptions
  // Misses: Silent failures, stderr, SDK internal errors
}
```

**The Gaps**:
1. **No Event-Level Error Detection**:
   - Doesn't check event types for error indicators
   - Doesn't parse event content for failure messages
   - Doesn't look for error-related metadata

2. **No stderr Capture**:
   - Codex CLI stderr → `console.error()` (not captured)
   - User never sees permission errors, command failures, warnings

3. **No Outcome Validation**:
   - Doesn't check: "Were files created as requested?"
   - Doesn't check: "Did tests pass?"
   - Doesn't check: "Is working tree changed?"

4. **Git Verification is Insufficient**:
   - Only checks: "Did git operations succeed?"
   - Doesn't check: "Did the task actually complete?"
   - False positive if no git operations expected

---

### Evidence from Codex SDK (Issue #1367)

**From git_verifier.ts:3-6** (original purpose):
```
Purpose: Verify git operations actually succeeded after Codex execution
Root Cause: Codex SDK suppresses stdout/stderr for non-zero exit codes (Issue #1367)
Solution: Run independent git commands to check branch, commits, staging
```

**Key Insight**: Git verifier was created BECAUSE Codex SDK hides errors!

**The Problem**:
- Git verifier checks git operations (branch, commit, staging)
- But doesn't check non-git operations (file creation, test results, etc.)
- And doesn't detect when Codex SDK silently fails

---

## Proposed Fixes

### Option A: Capture stderr from SDK

**Implementation**:
```typescript
// src/tools/local_exec.ts
import { spawn } from 'child_process';

// Instead of using SDK's runStreamed(), spawn codex CLI directly
const codexProcess = spawn('codex', ['exec', task], {
  cwd: workingDir,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],  // ✅ Capture stderr
});

let stderr = '';
codexProcess.stderr.on('data', (chunk) => {
  stderr += chunk.toString();  // ✅ Accumulate stderr
});

// After completion, include stderr in result
globalTaskRegistry.updateTask(taskId, {
  result: JSON.stringify({
    finalOutput,
    stderr,  // ✅ Include stderr for debugging
    success: determineSuccess(finalOutput, stderr, gitVerification),
  }),
});
```

**Benefits**:
- ✅ Captures permission errors, command failures
- ✅ Users can see what went wrong

**Limitations**:
- ⚠️ Requires re-implementing SDK logic (event parsing, threading)
- ⚠️ More complex than using SDK

---

### Option B: Parse Event Content for Error Indicators

**Implementation**:
```typescript
// src/tools/local_exec.ts
let hasErrorIndicators = false;
const errorPatterns = [
  /permission denied/i,
  /error:/i,
  /failed to/i,
  /cannot/i,
  /refused/i,
  /not found/i,
];

for await (const event of events) {
  if (event.type === 'item.completed') {
    const item = (event as any).item;

    // Check command execution for errors
    if (item?.type === 'command_execution' && item.aggregated_output) {
      finalOutput += item.aggregated_output + '\n';

      // ✅ Scan for error patterns
      for (const pattern of errorPatterns) {
        if (pattern.test(item.aggregated_output)) {
          hasErrorIndicators = true;
          console.error(`[LocalExec:${taskId}] ⚠️ Error indicator detected: ${pattern}`);
        }
      }
    }

    // Check agent messages for refusals
    if (item?.type === 'agent_message' && item.text) {
      finalOutput += item.text + '\n';

      // ✅ Detect refusal patterns
      if (/I cannot|I will not|refusing to/i.test(item.text)) {
        hasErrorIndicators = true;
        console.error(`[LocalExec:${taskId}] ⚠️ Agent refusal detected`);
      }
    }
  }
}

// Include error indicators in success determination
const success = gitVerification.errors.length === 0 && !hasErrorIndicators;
```

**Benefits**:
- ✅ Detects errors even when SDK doesn't throw exceptions
- ✅ Uses existing SDK event stream
- ✅ Low implementation cost

**Limitations**:
- ⚠️ Pattern matching is heuristic (false positives/negatives)
- ⚠️ Misses errors not mentioned in event text

---

### Option C: Add Outcome Validation (Combined with Issue 1.2 Fix)

**Implementation**:
```typescript
// src/tools/local_exec.ts (after execution completes)

// 1. Git verification (existing)
const gitVerification = await verifyGitOperations(workingDir, task);

// 2. ✅ File creation validation (NEW - from Issue 1.2 Option A)
const statusCheck = await runGit('git status --porcelain', workingDir);
const hasChanges = statusCheck.success && statusCheck.stdout.trim().length > 0;

// 3. ✅ Parse output for completion signals (NEW)
const hasCompletionSignals = /created|modified|written|completed/i.test(finalOutput);

// 4. ✅ Check if output is suspiciously empty (NEW)
const outputTooShort = finalOutput.length < 50 && eventCount > 5;

// Determine success with multiple signals
const errors: string[] = [...gitVerification.errors];

if (mode === 'workspace-write' && !hasChanges && !hasCompletionSignals) {
  errors.push('No files created or modified despite workspace-write mode');
}

if (outputTooShort) {
  errors.push('Execution output suspiciously short - may indicate silent failure');
}

const success = errors.length === 0;
```

**Benefits**:
- ✅ Validates actual task completion
- ✅ Detects silent failures
- ✅ Combines multiple signals for robust detection

**Limitations**:
- ⚠️ Requires careful tuning of heuristics

---

### Option D: Enhanced Error Reporting in Results (Recommended)

**Implementation**:
```typescript
// src/tools/local_results.ts

// Enhanced error section for "successful" tasks with no evidence
if (task.status === 'completed' && resultData.success) {
  // ✅ Check for suspicious indicators
  const suspiciousIndicators = [];

  if (task.mode === 'workspace-write' && !hasChanges) {
    suspiciousIndicators.push('No files created/modified in workspace-write mode');
  }

  if (resultData.finalOutput.length < 100 && resultData.eventCount > 5) {
    suspiciousIndicators.push('Output suspiciously short for number of events');
  }

  if (/SDK execution complete.*events/i.test(resultData.finalOutput)) {
    suspiciousIndicators.push('Generic fallback message (no actual output captured)');
  }

  if (suspiciousIndicators.length > 0) {
    message += `\n⚠️ **Possible Silent Failure Detected**\n\n`;
    message += `The task completed without errors, but shows these suspicious indicators:\n`;
    suspiciousIndicators.forEach(indicator => {
      message += `- ${indicator}\n`;
    });
    message += `\n💡 **Recommendations**:\n`;
    message += `- Check if files were actually created\n`;
    message += `- Review git status for changes\n`;
    message += `- Try running with explicit error checking\n`;
    message += `- Check \`.codex-errors.log\` for stderr output\n\n`;
  }
}
```

**Benefits**:
- ✅ Helps users identify false positives
- ✅ Provides actionable debugging steps
- ✅ Doesn't change success/failure logic (non-breaking)

**Limitations**:
- ⚠️ Still reports success, just with warnings

---

### Option E: Combination Approach (Most Comprehensive)

**Combine Options B + C + D**:

1. **Phase 1** (v3.4.2): Option D - Enhanced error reporting
   - Add suspicious indicator detection to `local_results.ts`
   - Help users identify silent failures
   - Low risk, immediate value

2. **Phase 2** (v3.4.3): Option B + C - Better detection
   - Parse event content for error patterns
   - Add outcome validation (file creation, etc.)
   - Update success determination logic
   - Medium risk, high value

3. **Phase 3** (Future): Option A - Full stderr capture
   - Re-implement SDK interaction to capture stderr
   - Most comprehensive error visibility
   - High complexity, requires SDK refactor

---

## Testing Plan

### Test 1: Reproduce Silent Failure

**Setup**:
```bash
cd /tmp/test-silent-failure
git init
chmod 444 .  # Make directory read-only
```

**Test Case**:
```typescript
{
  task: "Create a file named test.txt with content 'Hello World'",
  mode: "workspace-write"
}
// Expected: Permission denied error
// Actual (current): "Success" with no files created
```

**Success Criteria**:
- ✅ Reproduces silent failure (success claimed, no work done)
- ✅ Identifies lack of error reporting

---

### Test 2: Verify Fix (Option D - Enhanced Reporting)

**Apply Fix**: Add suspicious indicator detection

**Test Case**: Same as Test 1

**Expected Result**:
```
Status: ✅ Success

⚠️ Possible Silent Failure Detected

The task completed without errors, but shows these suspicious indicators:
- No files created/modified in workspace-write mode
- Output suspiciously short for number of events

💡 Recommendations:
- Check if files were actually created
- Review git status for changes
```

**Success Criteria**:
- ✅ Warns user about suspicious success
- ✅ Provides debugging guidance

---

### Test 3: Verify Fix (Option B - Error Pattern Detection)

**Apply Fix**: Parse events for error patterns

**Test Case**: Same as Test 1

**Expected Result**:
```
Status: ❌ Failed

Error indicators detected in execution output:
- "permission denied" found in command_execution event
```

**Success Criteria**:
- ✅ Detects error pattern in events
- ✅ Marks task as failed appropriately

---

## Implementation Checklist

**Phase 1: Investigation** ✅ COMPLETE
- [x] Read local_exec.ts error handling
- [x] Read local_results.ts error display
- [x] Read local_status.ts failure reporting
- [x] Identify error capture gaps
- [x] Document findings

**Phase 2: Design Fix**
- [ ] Choose fix approach (A, B, C, D, or E)
- [ ] Design implementation details
- [ ] Write test cases
- [ ] Review compatibility with Issue 1.2 fix

**Phase 3: Implementation**
- [ ] Implement enhanced error detection
- [ ] Add suspicious indicator warnings
- [ ] Improve error messages
- [ ] Update documentation

**Phase 4: Testing**
- [ ] Test 1: Reproduce silent failure
- [ ] Test 2: Verify enhanced reporting
- [ ] Test 3: Verify error pattern detection

**Phase 5: Documentation**
- [ ] Update quickrefs/troubleshooting.md
- [ ] Update CHANGELOG.md
- [ ] Add error debugging guide
- [ ] Document in session summary

---

## Recommendations

### Immediate Actions

1. **Implement Option E (Combination Approach)** - RECOMMENDED
   - Phase 1 (v3.4.2): Enhanced error reporting (Option D)
   - Phase 2 (v3.4.3): Better detection (Options B + C)
   - Phase 3 (Future): Full stderr capture (Option A)

2. **Coordinate with Issue 1.2 Fix**
   - Both issues share outcome validation needs
   - Implement together for consistency
   - Deploy in same version (v3.4.2)

3. **Improve Error Messages**
   - Add context about common failure modes
   - Suggest debugging steps
   - Link to troubleshooting docs

### Long-Term Improvements

1. **Structured Error Reporting**
   - Use metadata extractor for error data
   - Categorize errors (permission, network, logic, etc.)
   - Provide targeted fixes for each category

2. **Logging Integration (Issue 1.5)**
   - Route stderr to log file
   - Make logs accessible via tool
   - Cross-reference with task IDs

3. **Better Codex SDK Integration**
   - Work with Codex team on Issue #1367
   - Request explicit error events
   - Improve stderr visibility

---

## Related Issues

- **Issue 1.2**: Tasks report success without creating files (root cause: insufficient validation)
- **Issue 1.3**: Stuck tasks accumulation (root cause: timeout failures not handled)
- **Issue 1.5**: Execution logging infrastructure (needed for stderr visibility)
- **Issue 3.1**: Truncated output (makes error messages hard to see)

---

**Status**: 🔍 Investigation Complete - ✅ ROOT CAUSE IDENTIFIED

**Root Cause**: Multiple gaps in error detection and reporting:
1. Codex SDK internal failures don't throw exceptions (silent failures)
2. stderr output not captured (permission errors, command failures invisible)
3. Event content not parsed for error indicators (refusals, failures go unnoticed)
4. Success determined only by git verification (misses non-git failures)
5. No validation of expected outcomes (can't detect when no work was done)

**Next Action**: Implement Option E (Combination Approach) - Phase 1 (enhanced reporting) for v3.4.2, coordinate with Issue 1.2 fix for outcome validation.
