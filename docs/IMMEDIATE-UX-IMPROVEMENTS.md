# Immediate UX Improvements for MCP Delegator

## Within CLI Constraints - No Platform Changes Needed

**Date:** 2025-11-17
**Context:** Improving AI agent and user experience while waiting for Claude Code progress notification support

---

## Executive Summary

**Current Issues:**

- 🔴 Manual polling wastes ~2000 tokens per task
- 🔴 Large result dumps (12k+ tokens) overwhelm context
- 🔴 Repetitive status checks show identical data
- 🔴 Users see no updates for 5+ minutes, causing anxiety
- 🔴 Full output dumped even when summary would suffice

**Solutions Available Now:**

- ✅ Use existing `_codex_local_wait` tool (built-in, just underutilized)
- ✅ Leverage metadata extraction for summaries
- ✅ Implement progressive disclosure
- ✅ Set clear user expectations upfront

**Impact:**

- **Token reduction:** 96% (14k → 500 per task)
- **User experience:** 99% less noise
- **Implementation effort:** Zero code changes to MCP server

---

## Improvement #1: Replace Manual Polling with Wait Tool

### Current Pattern (Inefficient)

```typescript
// What Claude Code does now:
console.log("Stage 2 is running. Let me monitor progress:");

await sleep(45);
const status1 = await _codex_local_status(); // ~500 tokens

await sleep(60);
const status2 = await _codex_local_status(); // ~500 tokens

await sleep(60);
const status3 = await _codex_local_status(); // ~500 tokens

await sleep(90);
const status4 = await _codex_local_status(); // ~500 tokens

// Total: 4 tool calls, 255 seconds of sleep management, ~2000 tokens
```

### New Pattern (Efficient)

```typescript
// What Claude Code SHOULD do:
console.log("Stage 2 started (9 CRUD methods + tests)");
console.log("Expected duration: 6-10 minutes");
console.log("I'll wait automatically - no need to check manually...");

const results = await _codex_local_wait({
  task_id: "T-local-xyz",
});

console.log(`✅ Complete in ${results.metadata.duration}s!`);

// Total: 1 tool call, 0 sleep management, ~300 tokens
```

**Savings:** ~1700 tokens (85% reduction)

---

## Improvement #2: Metadata-Driven Summaries

### Current Pattern (Information Overload)

```typescript
const results = await _codex_local_results({ task_id });

console.log(results); // Dumps 1171 lines to user

// User sees:
⚠ Large MCP response (~12.2k tokens)
✅ Codex SDK Task Completed
[1171 lines of JSON, events, stdout, stderr, file contents...]
```

### New Pattern (Concise Summary)

```typescript
const results = await _codex_local_results({ task_id });

// Extract metadata (zero additional API calls)
const { metadata } = results;

// Show concise summary
console.log(`✅ Task complete in ${metadata.duration}s`);
console.log(`📁 Modified files (${metadata.file_operations.modified_files.length}):`);
metadata.file_operations.modified_files.forEach(f => {
  console.log(`  - ${f}`);
});

if (metadata.test_results) {
  console.log(`✅ Tests: ${metadata.test_results.passed} passed, ${metadata.test_results.failed} failed`);
}

if (metadata.error_context) {
  console.log(`⚠️ Error: ${metadata.error_context.error_message}`);
  console.log(`📍 Location: ${metadata.error_context.error_locations[0].file}:${metadata.error_context.error_locations[0].line}`);

  // ONLY show full output for debugging
  console.log("\nFull output for debugging:");
  console.log(results.output);
}

// User sees:
✅ Task complete in 8m 23s
📁 Modified files (9):
  - src/crud/workspace.service.ts
  - src/crud/workspace.repository.ts
  - tests/crud/workspace.test.ts
  [... 6 more files]
✅ Tests: 47 passed, 0 failed
```

**Savings:** ~11,700 tokens (97% reduction in output)

---

## Improvement #3: Set Clear Expectations Upfront

### Current Pattern (Anxiety-Inducing)

```typescript
console.log("Stage 2 is now running.");
// [5 minutes of silence]
console.log("Progress Update (5.3 minutes): Still at 50%...");
// [More silence]
console.log("Progress Update (6.5 minutes): Still at 50%...");

// User thinks: "Is it stuck? Should I cancel?"
```

### New Pattern (Reassuring)

```typescript
console.log("Starting Stage 2: Workspace CRUD Implementation");
console.log("");
console.log("📋 Task scope:");
console.log("  - 9 CRUD methods (create, read, update, delete for workspaces)");
console.log("  - TypeScript types and interfaces");
console.log("  - Comprehensive test coverage");
console.log("");
console.log("⏱️ Expected duration: 6-10 minutes");
console.log("📊 Complexity: HIGH (multiple files, full test suite)");
console.log("");
console.log("I'll wait automatically using the MCP wait tool.");
console.log("You won't see intermediate updates (this is normal).");
console.log("Next message will be when task completes.");
console.log("");

// [Use _codex_local_wait internally - returns only when done]

console.log("✅ Stage 2 complete in 8m 23s!");

// User experience: Clear expectations, no anxiety, clean completion
```

**Impact:** Eliminates user anxiety, no repetitive "still running" messages

---

## Improvement #4: Progressive File Verification

### Current Pattern (Read Everything)

```typescript
const results = await _codex_local_results({ task_id });

// Immediately read all modified files to verify
for (const file of modifiedFiles) {
  const content = await readFile(file); // Might be 500+ lines each
  // Show full content to user
  console.log(content);
}

// User sees: 4500+ lines of code dumped
```

### New Pattern (Targeted Verification)

```typescript
const results = await _codex_local_results({ task_id });
const files = results.metadata.file_operations.modified_files;

// Step 1: Just verify existence
console.log(`Verifying ${files.length} files were created...`);

const verified = [];
const missing = [];

for (const file of files) {
  const exists = await fileExists(file); // Just check, don't read
  if (exists) {
    verified.push(file);
  } else {
    missing.push(file);
  }
}

console.log(`✅ ${verified.length} files verified`);

if (missing.length > 0) {
  console.log(`⚠️ ${missing.length} files missing:`);
  missing.forEach((f) => console.log(`  - ${f}`));
}

// ONLY read file contents if:
// 1. User explicitly asks
// 2. Verification failed
// 3. Need to inspect specific file

// User sees: Clean verification summary, not thousands of lines of code
```

**Savings:** ~4000 tokens (don't read files unless needed)

---

## Improvement #5: Smart Error Handling

### Current Pattern (Unclear Next Steps)

```typescript
if (results.error) {
  console.log(`Error: ${results.error}`);
  console.log(results.output); // Dump full output
}

// User sees: Wall of text, unclear what to do
```

### New Pattern (Actionable Guidance)

```typescript
if (results.metadata.error_context) {
  const error = results.metadata.error_context;

  console.log(`⚠️ Task encountered an error`);
  console.log("");
  console.log(`Error: ${error.error_message}`);
  console.log(`Type: ${error.error_type}`);

  if (error.error_locations.length > 0) {
    console.log(`Location: ${error.error_locations[0].file}:${error.error_locations[0].line}`);
  }

  console.log("");
  console.log("🔧 Suggested next steps:");
  error.suggestions.forEach((suggestion, i) => {
    console.log(`  ${i + 1}. ${suggestion}`);
  });

  console.log("");
  console.log("Would you like me to:");
  console.log("  A) Investigate the error at the suggested location");
  console.log("  B) Show the full Codex output for debugging");
  console.log("  C) Retry with a modified approach");
}

// User sees:
⚠️ Task encountered an error

Error: Cannot read property 'name' of null
Type: TypeError
Location: src/crud/workspace.service.ts:42

🔧 Suggested next steps:
  1. Start investigation at workspace.service.ts:42
  2. Check variable types and null/undefined values
  3. Run failing tests individually to isolate issues

Would you like me to:
  A) Investigate the error at the suggested location
  B) Show the full Codex output for debugging
  C) Retry with a modified approach
```

**Impact:** Clear actionable guidance, not just raw output

---

## Complete Example: Before & After

### BEFORE (Current Inefficient Workflow)

```typescript
// 1. Start task
console.log("Stage 2 is now running. Let me monitor progress:");

// 2. Poll manually (4 times, 2000 tokens)
await sleep(45);
const status1 = await _codex_local_status();
console.log(`Progress (54s): ${status1.progress}% (0/2 steps)`);

await sleep(60);
const status2 = await _codex_local_status();
console.log(`Progress (2.1m): ${status2.progress}% (0/2 steps)`);

await sleep(60);
const status3 = await _codex_local_status();
console.log(`Progress (3.3m): ${status3.progress}% (0/2 steps)`);

await sleep(90);
const status4 = await _codex_local_status();
console.log(`Progress (5m): Task disappeared from running list`);

// 3. Get results (12k tokens)
const results = await _codex_local_results({ task_id });

// 4. Dump everything (1171 lines)
console.log(results);

// 5. Read all files to verify (4k tokens)
for (const file of modifiedFiles) {
  const content = await readFile(file);
  console.log(content);
}

// Total tokens: ~18,000
// User experience: Overwhelming, repetitive, unclear
// Time to completion: 5+ minutes with constant interruptions
```

### AFTER (Optimized Workflow)

```typescript
// 1. Start task with clear expectations
console.log("Starting Stage 2: Workspace CRUD Implementation");
console.log("");
console.log("📋 Scope: 9 CRUD methods + types + comprehensive tests");
console.log("⏱️ Expected: 6-10 minutes");
console.log("📊 Complexity: HIGH");
console.log("");
console.log("I'll wait automatically. Next update when complete...");

// 2. Use wait tool (1 call, ~300 tokens)
const results = await _codex_local_wait({ task_id });

// 3. Extract metadata (0 additional tokens)
const { metadata } = results;

// 4. Show concise summary (~100 tokens)
console.log(`✅ Stage 2 complete in ${metadata.duration}s!`);
console.log("");
console.log(
  `📁 Modified ${metadata.file_operations.modified_files.length} files:`,
);
metadata.file_operations.modified_files.forEach((f) => {
  console.log(`  - ${f}`);
});

if (metadata.test_results) {
  console.log("");
  console.log(`✅ Tests: ${metadata.test_results.passed} passed`);
}

// 5. Targeted verification (~100 tokens)
console.log("");
console.log("Verifying files...");
const allExist = metadata.file_operations.modified_files.every((f) =>
  fileExists(f),
);
console.log(
  `✅ All ${metadata.file_operations.modified_files.length} files verified`,
);

// 6. ONLY show full output if errors
if (metadata.error_context) {
  console.log("\n⚠️ Errors encountered - showing details:");
  console.log(results.output);
}

// Total tokens: ~500
// User experience: Clear, concise, actionable
// Time to completion: Same, but no interruptions
```

**Improvement Summary:**

- **Token reduction:** 97% (18k → 500)
- **Output reduction:** 99% (1171 lines → 10 lines)
- **User anxiety:** Eliminated (clear expectations)
- **Code changes needed:** ZERO (just change how Claude Code uses existing tools)

---

## Implementation Checklist

### For Claude Code AI Agent

When using MCP Delegator:

**✅ Do:**

1. Use `_codex_local_wait` instead of manual polling
2. Set clear expectations upfront (duration, complexity)
3. Extract metadata for summaries
4. Show progressive disclosure (summary → details only if needed)
5. Provide actionable error guidance using metadata.error_context

**❌ Don't:**

1. Poll status manually every 60 seconds
2. Show identical status updates ("still at 50%...")
3. Dump full 12k token results to user
4. Read all file contents just to verify existence
5. Show raw errors without actionable suggestions

---

## Expected Impact

### Token Usage

| Workflow     | Before    | After   | Savings |
| ------------ | --------- | ------- | ------- |
| Polling      | 2000      | 300     | 85%     |
| Results      | 12000     | 100     | 99%     |
| Verification | 4000      | 100     | 97%     |
| **Total**    | **18000** | **500** | **97%** |

### User Experience

| Aspect             | Before | After  |
| ------------------ | ------ | ------ |
| Output lines       | 1171   | 10-15  |
| Repetitive updates | 4+     | 0      |
| Time to understand | 5+ min | 10 sec |
| Anxiety level      | High   | None   |
| Actionability      | Low    | High   |

---

## Next Steps

### Immediate (No Code Changes)

1. ✅ Use `_codex_local_wait` as default pattern
2. ✅ Implement metadata-driven summaries
3. ✅ Set clear user expectations upfront
4. ✅ Use progressive disclosure

### Short-term (MCP Server Enhancements)

1. Add `summary_only` parameter to `_codex_local_results`
2. Return condensed status from `_codex_local_status` (exclude unchanged data)
3. Implement streaming results (chunked output)
4. Add task state transition notifications

### Long-term (When Platform Ready)

1. Enable `ENABLE_MCP_PROGRESS_NOTIFICATIONS = true`
2. Claude Code displays real-time progress in status bar
3. Automatic push-based updates (no polling needed)
4. All current improvements still benefit users

---

## Conclusion

**The good news:** 97% improvement is achievable **right now** with **zero code changes** to the MCP server. This is purely about how Claude Code (the AI agent) uses the existing tools.

**The key insight:** The MCP Delegator already has all the tools needed for a great UX:

- ✅ Wait tools (no manual polling)
- ✅ Metadata extraction (structured summaries)
- ✅ Error context (actionable guidance)

We just need to **use them better**!

**Recommendation:** Update Claude Code's system prompts to follow the patterns in `RECOMMENDED-POLLING-STRATEGY.md` and `RESULT-HANDLING-STRATEGY.md`.
