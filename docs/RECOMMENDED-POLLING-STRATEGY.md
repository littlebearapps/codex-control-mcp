# Recommended Polling Strategy for AI Agents

## Problem
Manual polling with `sleep` + `_codex_local_status` is inefficient:
- Wastes tokens on repeated full status dumps
- Agent manages timing manually
- Same data returned multiple times
- User sees repetitive status checks

## Solutions

### Option 1: Use Wait Tools (BEST for most cases)

**For local tasks:**
```typescript
// ❌ Don't do this:
sleep 60 → _codex_local_status → sleep 60 → _codex_local_status

// ✅ Do this instead:
_codex_local_wait({ task_id: "T-local-xyz" })
// Returns automatically when complete (max 11 min timeout)
```

**For cloud tasks:**
```typescript
_codex_cloud_wait({ task_id: "T-cloud-xyz" })
// Returns automatically when complete (max 31 min timeout)
```

**Benefits:**
- Single tool call
- No manual sleep management
- Server polls internally
- Returns only when status changes
- Automatic timeout handling

---

### Option 2: Exponential Backoff (if intermediate checks needed)

**For tasks where you want periodic updates:**

```typescript
// ❌ Don't do this (linear polling):
sleep 45 → check → sleep 60 → check → sleep 60 → check

// ✅ Do this instead (exponential backoff):
sleep 30 → check → sleep 60 → check → sleep 120 → check → sleep 240 → wait

// Rationale:
// - First check quickly (30s) - catches fast failures
// - Then double wait time each check
// - Reduces token waste for long tasks
// - Final wait tool ensures completion
```

**Example Implementation:**
```typescript
// Step 1: Quick check (catch failures early)
await sleep(30);
const status1 = await _codex_local_status();

if (status1.error) {
  // Handle failure fast
  return;
}

// Step 2: Medium check (see if making progress)
await sleep(60);
const status2 = await _codex_local_status();

if (status2.completed) {
  // Task finished quickly
  return await _codex_local_results();
}

// Step 3: Stop polling, use wait tool
const result = await _codex_local_wait({ task_id });
```

**Token Comparison:**
- Linear (current): 4-6 status checks = 2000-3000 tokens
- Exponential + wait: 2 status checks + 1 wait = ~1000 tokens
- **Savings: 50-66%**

---

### Option 3: Conditional Polling (check only if concerned)

**Use case:** Very long tasks where you want to verify progress

```typescript
// Step 1: Start task
const task = await _codex_local_exec({ task });

// Step 2: Inform user and set expectations
console.log(`Task started (ID: ${task.task_id})`);
console.log(`Expected duration: 5-10 minutes`);
console.log(`I'll wait for completion automatically...`);

// Step 3: Single check after expected "halfway" point
await sleep(300); // 5 minutes
const status = await _codex_local_status({ task_id });

if (status.progress === "50%" && status.files_changed === 0) {
  console.log("Still in planning phase (normal for complex tasks)");
}

// Step 4: Use wait tool for remainder
const result = await _codex_local_wait({ task_id });
```

**Token Comparison:**
- Current (4-6 checks): 2000-3000 tokens
- Conditional (1 check + wait): ~600 tokens
- **Savings: 70-80%**

---

## Decision Matrix

| Scenario | Best Approach | Token Cost | User Experience |
|----------|---------------|------------|-----------------|
| **Quick task (<2 min)** | Direct wait | ~100 | Clean, no intermediate updates |
| **Medium task (2-5 min)** | 1 check + wait | ~600 | One progress update |
| **Long task (5-15 min)** | 2 checks + wait | ~1000 | Two progress updates |
| **Very long task (>15 min)** | Cloud submission | ~200 | Background execution |

---

## Key Principles

1. **Prefer wait tools over manual polling**
   - Server polls internally (more efficient)
   - Returns only when status changes
   - Automatic timeout handling

2. **When polling is necessary:**
   - Use exponential backoff (30s → 60s → 120s → 240s)
   - Check early to catch failures fast
   - Switch to wait tool for final completion

3. **Set user expectations:**
   - Tell user estimated duration upfront
   - Explain why no updates for long periods
   - Use wait tool to avoid appearing "stuck"

4. **Minimize token waste:**
   - Each status check ≈ 500 tokens
   - Only check when information will change
   - Use wait tool to offload polling to server

---

## Implementation Checklist

For AI agents using MCP Delegator:

- [ ] Use `_codex_local_wait` or `_codex_cloud_wait` as default
- [ ] Only use `_codex_local_status` for:
  - Quick failure checks (after 30-60s)
  - Midpoint verification for very long tasks
  - User explicitly asks for status
- [ ] Implement exponential backoff if multiple checks needed
- [ ] Set clear user expectations about duration
- [ ] Avoid repetitive status checks with identical results
- [ ] Use cloud submission for tasks >15 minutes

---

## Example Workflows

### Workflow 1: Simple Task (< 5 minutes)

```typescript
// 1. Start task
const task = await _codex_local_exec({
  task: "Implement user authentication"
});

// 2. Inform user
console.log(`Task started: ${task.task_id}`);
console.log(`Estimated: 3-5 minutes. Waiting for completion...`);

// 3. Wait automatically (no manual polling!)
const result = await _codex_local_wait({ task_id: task.task_id });

// 4. Return results
console.log(`✅ Task complete in ${result.duration}s`);
```

**Token usage:** ~300 tokens (start + wait)

---

### Workflow 2: Long Task with Midpoint Check

```typescript
// 1. Start task
const task = await _codex_local_exec({
  task: "Refactor entire API layer with comprehensive tests"
});

// 2. Set expectations
console.log(`Large refactoring task started (ID: ${task.task_id})`);
console.log(`Expected duration: 8-12 minutes`);
console.log(`This is a complex task - I'll check progress at the midpoint...`);

// 3. Sleep to midpoint (5 minutes)
await sleep(300);

// 4. Single status check
const status = await _codex_local_status({ task_id: task.task_id });

if (status.files_changed > 0) {
  console.log(`Progress: ${status.files_changed} files modified so far`);
} else {
  console.log(`Still analyzing and planning (no code changes yet - this is normal)`);
}

// 5. Wait for completion
console.log(`Waiting for completion...`);
const result = await _codex_local_wait({ task_id: task.task_id });

// 6. Return results
console.log(`✅ Complete! Modified ${result.files_changed} files in ${result.duration}s`);
```

**Token usage:** ~800 tokens (start + 1 status + wait)

---

### Workflow 3: Very Long Task (Use Cloud)

```typescript
// For tasks >15 minutes, use cloud submission
const task = await _codex_cloud_submit({
  task: "Run comprehensive security audit and create PR with fixes",
  envId: "env_myproject"
});

console.log(`Task submitted to Codex Cloud (ID: ${task.task_id})`);
console.log(`This will run in the background for 20-40 minutes`);
console.log(`You can monitor at: ${task.web_ui_link}`);
console.log(`I'll check back later when it's likely complete`);

// Continue with other work...
```

**Token usage:** ~200 tokens (just submission)

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Linear Polling Forever
```typescript
// DON'T DO THIS:
while (!complete) {
  await sleep(60);
  const status = await _codex_local_status();
  // This could check 10+ times = 5000+ tokens!
}
```

### ❌ Anti-Pattern 2: Checking Too Frequently
```typescript
// DON'T DO THIS:
await sleep(30);
check(); // Too early - task just started

await sleep(30);
check(); // Still too early

await sleep(30);
check(); // Wasteful - nothing changed

// Use wait tool instead!
```

### ❌ Anti-Pattern 3: No User Communication
```typescript
// DON'T DO THIS:
const task = await start_task();
// [5 minutes of silence]
const result = await wait();

// DO THIS INSTEAD:
const task = await start_task();
console.log("Task started - this will take ~5 minutes...");
const result = await wait();
```

---

## Summary

**Default approach:** Use wait tools
**When to poll:** Only for very long tasks (>5 min) with midpoint check
**How to poll:** Exponential backoff + switch to wait
**Goal:** Minimize token waste while providing reasonable user updates
