# Background Execution Workaround for MCP Delegator

## Using Bash `run_in_background` Feature

**Date:** 2025-11-17
**Discovery:** Claude Code's status bar shows background Bash commands
**Goal:** Use this for Codex execution to eliminate polling and provide status visibility

---

## The Discovery

When using Bash tool with `run_in_background: true`, Claude Code shows a status message in the bottom bar:

```
sleep 120 && echo "Progress check at ~8… no output
```

This provides:

- ✅ Visual indication that something is running
- ✅ Non-blocking execution (Claude Code can continue working)
- ✅ Native Claude Code UI integration
- ✅ No manual polling needed

**Question:** Can we use this for MCP Delegator Codex execution?

---

## Option 1: Direct Bash Wrapper (Simple)

### Implementation

**Step 1: Start Codex via Bash Background**

```typescript
Bash({
  command: 'codex exec "Implement workspace CRUD methods with tests"',
  run_in_background: true,
  description: "Running Codex: Workspace CRUD implementation",
});
```

**Claude Code shows in status bar:**

```
codex exec "Implement workspace… no output
```

**Step 2: Wait for completion (no active polling)**

```typescript
// Claude Code continues with other work...
// When ready to check results (after ~5-10 minutes):

// Check if Codex finished
Bash({
  command: "ps aux | grep 'codex exec' | grep -v grep",
  description: "Check if Codex still running",
});
```

**Step 3: Get results when complete**

```typescript
// Read Codex session results
Bash({
  command: "codex status",
  description: "Get Codex execution results",
});
```

### Pros

- ✅ Uses existing Bash `run_in_background` feature
- ✅ Status bar visibility (native Claude Code UI)
- ✅ No MCP server changes needed
- ✅ Works TODAY

### Cons

- ❌ Lose structured MCP tool output
- ❌ No metadata extraction
- ❌ No secret redaction
- ❌ No task registry integration
- ❌ Results are plain text, not structured

---

## Option 2: Bash Wrapper + MCP Results (HYBRID - RECOMMENDED)

### Implementation

**Step 1: Generate task ID and start Codex**

```typescript
// Use MCP to start task and get task ID
const task = await _codex_local_exec({
  task: "Implement workspace CRUD methods with tests",
  mode: "workspace-write",
});

// Returns immediately with: { task_id: "T-local-abc123", thread_id: "thread_xyz" }
```

**Step 2: Monitor via Bash background wrapper**

```typescript
// Use Bash to show status in status bar
Bash({
  command: `while kill -0 $(pgrep -f "codex.*${task.task_id}") 2>/dev/null; do sleep 5; done`,
  run_in_background: true,
  description: `Codex running (${task.task_id})`,
});
```

**Claude Code shows:**

```
Codex running (T-local-abc123)… no output
```

**Step 3: Get structured results via MCP when complete**

```typescript
// When background Bash completes (Codex finished)
const results = await _codex_local_results({
  task_id: task.task_id,
});

// Use metadata extraction for summary
const summary = {
  duration: results.metadata.duration,
  files: results.metadata.file_operations.modified_files,
  tests: results.metadata.test_results,
};
```

### Pros

- ✅ Status bar visibility (Bash background)
- ✅ Structured results (MCP tools)
- ✅ Metadata extraction
- ✅ Secret redaction
- ✅ Task registry integration
- ✅ Works with existing code

### Cons

- ❌ Requires process monitoring (pgrep/kill)
- ❌ More complex workflow
- ❌ Platform-dependent (Linux/macOS, not Windows)

---

## Option 3: MCP Task ID + Manual Check (CURRENT IMPROVED)

### Implementation

**Step 1: Start task with clear expectations**

```typescript
console.log("Starting Stage 3: Two-step publish flow");
console.log("Expected: 8-12 minutes (complex task)");
console.log("");

const task = await _codex_local_exec({
  task: "Implement two-step publish flow with integration tests",
});

console.log(`✅ Task started (ID: ${task.task_id})`);
console.log(`Thread: ${task.thread_id}`);
console.log("");
console.log(
  "I'll check back in ~10 minutes. You can continue with other work.",
);
```

**Step 2: Schedule single check via Bash background**

```typescript
// Set a reminder to check results
Bash({
  command: "sleep 600 && echo 'Codex task likely complete - check results'",
  run_in_background: true,
  description: "Codex completion reminder (10 min)",
});
```

**Claude Code shows:**

```
Codex completion reminder (10 min)… no output
```

**Step 3: Check results when Bash completes**

```typescript
// When Bash sleep completes (10 minutes later)
const results = await _codex_local_results({
  task_id: task.task_id,
});
```

### Pros

- ✅ Simple implementation
- ✅ Status bar visibility (via Bash reminder)
- ✅ No active polling
- ✅ Structured results via MCP
- ✅ Works TODAY

### Cons

- ❌ Not real-time (just a reminder)
- ❌ Doesn't show actual Codex status

---

## Option 4: Feature Request - Background MCP Tools (FUTURE)

### Proposal

Request that Claude Code add `run_in_background` support for MCP tools:

```typescript
// Future API (if Claude Code adds support)
_codex_local_exec({
  task: "Implement workspace CRUD",
  mode: "workspace-write",
  run_in_background: true, // New parameter
});

// Claude Code would:
// 1. Call MCP tool
// 2. Show in status bar: "Codex: Workspace CRUD… running"
// 3. Continue allowing user to work
// 4. Notify when complete
```

### Pros

- ✅ Native MCP integration
- ✅ Status bar visibility
- ✅ Structured results
- ✅ Clean API

### Cons

- ❌ Requires Claude Code changes
- ❌ Unknown timeline
- ❌ May not be prioritized

---

## Recommendation: Use Option 2 (Hybrid) NOW

**Immediate implementation:**

```typescript
// 1. Start Codex via MCP (get task ID)
const task = await _codex_local_exec({
  task: "Implement workspace CRUD methods",
  mode: "workspace-write",
});

console.log(`✅ Task started (ID: ${task.task_id})`);
console.log(`Expected: 8-12 minutes`);

// 2. Show status in status bar via Bash
Bash({
  command: `echo "Codex ${task.task_id} running..." && sleep 600`,
  run_in_background: true,
  description: `Codex: ${task.task_id.slice(-8)}`,
});

console.log("Status bar will show progress. I'll check results in 10 minutes.");

// 3. Later, get structured results
const results = await _codex_local_results({ task_id: task.task_id });
```

**User sees in status bar:**

```
Codex: abc123… no output
```

**Benefits:**

- ✅ Immediate implementation (no code changes)
- ✅ Status bar visibility
- ✅ Structured results from MCP
- ✅ No manual polling
- ✅ User confidence (sees something running)

---

## Alternative: Simplified Reminder Pattern (Option 3)

**Even simpler implementation:**

```typescript
// 1. Start task
console.log("Starting Stage 3 (8-12 minutes expected)...");

const task = await _codex_local_exec({
  task: "Implement two-step publish flow",
});

console.log(`✅ Started (${task.task_id})`);

// 2. Set reminder via Bash background
Bash({
  command: "sleep 600 && echo 'Check Codex results now'",
  run_in_background: true,
  description: "Codex reminder (10 min)",
});

console.log("I've set a 10-minute reminder. You can continue working.");

// 3. When Bash completes, check results
// (triggered automatically by Bash completion)
```

**Status bar shows:**

```
Codex reminder (10 min)… no output
```

**Benefits:**

- ✅ Even simpler (just one Bash sleep)
- ✅ Status bar visibility
- ✅ Clear timing expectation
- ✅ Works TODAY

---

## Implementation Guide for Claude Code

### Pattern to Use

```typescript
/**
 * Recommended workflow for long-running Codex tasks
 */

// Step 1: Start task with clear expectations
console.log("Starting Stage X: [Description]");
console.log(`Expected duration: Y-Z minutes`);
console.log("");

// Step 2: Execute via MCP (returns immediately)
const task = await _codex_local_exec({
  task: "[task description]",
  mode: "workspace-write",
});

console.log(`✅ Task started`);
console.log(`ID: ${task.task_id}`);
console.log(`Thread: ${task.thread_id}`);
console.log("");

// Step 3: Set reminder via Bash background
const reminderMinutes = Math.ceil(Z); // Upper bound of estimate
Bash({
  command: `sleep ${reminderMinutes * 60} && echo 'Time to check Codex results'`,
  run_in_background: true,
  description: `Codex: ${task.task_id.slice(-8)} (${reminderMinutes}m)`,
});

console.log(`I've set a ${reminderMinutes}-minute reminder.`);
console.log("You'll see status in the bottom bar.");
console.log("I'll check results when the timer completes.");
console.log("");
console.log("You can continue with other work in the meantime.");

// Step 4: When Bash completes, fetch results
// (This happens automatically via Bash completion event)

// Step 5: Get structured results
const results = await _codex_local_results({
  task_id: task.task_id,
});

// Step 6: Show summary (metadata-driven)
const summary = {
  duration: results.metadata.duration,
  files: results.metadata.file_operations.modified_files,
  tests: results.metadata.test_results,
};

console.log(`✅ Stage X complete in ${summary.duration}s`);
console.log(`📁 Modified ${summary.files.length} files`);
if (summary.tests) {
  console.log(`✅ Tests: ${summary.tests.passed} passed`);
}
```

### User Experience

**Before (Manual Polling):**

```
[Start task]
[Sleep 60s]
"Still running... 50%"
[Sleep 60s]
"Still running... 50%"
[Sleep 60s]
"Still running... 50%"
[Repeat 5+ times]
```

**After (Background Reminder):**

```
[Start task]
"✅ Task started (ID: T-local-abc123)"
"I've set a 10-minute reminder."
"You can continue working."

[Status bar shows: "Codex: abc123 (10m)… no output"]

[10 minutes pass, user does other work]

[Bash completes]
"✅ Stage complete in 8m 23s!"
```

---

## Testing This Approach

### Test 1: Simple Reminder

```typescript
// Start a long task
const task = await _codex_local_exec({
  task: "Analyze entire codebase for security issues",
});

// Set 5-minute reminder
Bash({
  command: "sleep 300 && echo 'Check Codex now'",
  run_in_background: true,
  description: `Codex: ${task.task_id.slice(-8)} (5m)`,
});

// Verify status bar shows the message
// Wait 5 minutes
// Fetch results when Bash completes
```

### Test 2: Multiple Tasks

```typescript
// Start task 1
const task1 = await _codex_local_exec({ task: "..." });
Bash({
  command: "sleep 300 && echo 'Task 1 check'",
  run_in_background: true,
  description: `Codex 1: ${task1.task_id.slice(-8)}`,
});

// Start task 2
const task2 = await _codex_local_exec({ task: "..." });
Bash({
  command: "sleep 600 && echo 'Task 2 check'",
  run_in_background: true,
  description: `Codex 2: ${task2.task_id.slice(-8)}`,
});

// Status bar should show both:
// Codex 1: abc123… no output
// Codex 2: def456… no output
```

---

## Summary

**Best Immediate Solution:** Option 3 (Simplified Reminder)

**Why:**

- ✅ Works TODAY (no code changes)
- ✅ Uses Claude Code's native status bar feature
- ✅ Eliminates manual polling
- ✅ Provides visual feedback
- ✅ Simple to implement

**Implementation:**

1. Start Codex task via `_codex_local_exec`
2. Set Bash background reminder for expected duration
3. Status bar shows reminder countdown
4. Fetch structured results via `_codex_local_results` when timer completes

**Impact:**

- 🚫 No more manual polling loops
- ✅ Status bar visibility
- ✅ User can continue working
- ✅ Clean, predictable workflow

**Future Enhancement:**
When Claude Code adds `run_in_background` support for MCP tools, we can switch to that and get even better integration.
