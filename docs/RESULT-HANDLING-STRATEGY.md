# Result Handling Strategy for AI Agents

## Problem

Large Codex results (12k+ tokens) can:

- Fill up context window quickly
- Bury important information
- Overwhelm users with output
- Waste tokens on repeated information

## Solutions

### Strategy 1: Incremental Result Verification

Instead of dumping full results, extract key information first:

**❌ Don't do this:**

```typescript
// Get full results immediately (12k tokens)
const results = await _codex_local_results({ task_id });

// Then dump everything to user
console.log(results); // User sees 1171 lines of output
```

**✅ Do this instead:**

```typescript
// Step 1: Get results (internal)
const results = await _codex_local_results({ task_id });

// Step 2: Extract key metadata from results.metadata
const summary = {
  duration: results.metadata.duration,
  files_changed: results.metadata.file_operations.modified_files.length,
  tests_added: results.metadata.test_results?.total || 0,
  errors: results.metadata.error_context?.error_message || null,
};

// Step 3: Show concise summary to user
console.log(`✅ Task complete in ${summary.duration}s`);
console.log(`📁 Modified ${summary.files_changed} files`);
console.log(`✅ Added ${summary.tests_added} tests`);

if (summary.errors) {
  console.log(`⚠️ Encountered errors: ${summary.errors}`);
}

// Step 4: ONLY show full output if user needs it or if errors occurred
if (summary.errors) {
  console.log("\nFull output for debugging:");
  console.log(results.output);
}
```

**Token savings:** 11,000+ tokens (show summary instead of full output)

---

### Strategy 2: File-by-File Verification

For tasks that modify multiple files:

**✅ Efficient approach:**

```typescript
// Step 1: Get results
const results = await _codex_local_results({ task_id });

// Step 2: Extract modified files from metadata
const modified = results.metadata.file_operations.modified_files;

// Step 3: Show user what changed
console.log(`✅ Stage complete! Modified ${modified.length} files:`);
modified.forEach((file) => {
  console.log(`  - ${file}`);
});

// Step 4: Verify files exist with targeted reads
for (const file of modified) {
  const exists = await fileExists(file);
  if (!exists) {
    console.log(`⚠️ Warning: ${file} not found - may have been an error`);
  }
}

// Step 5: ONLY read file contents if verification needed
// Don't automatically dump all file contents
```

---

### Strategy 3: Progressive Disclosure

Show information progressively based on user needs:

**Level 1: High-level summary (always show)**

```typescript
✅ Task complete in 8m 23s
📁 9 files created/modified
✅ All tests passing (47 tests)
```

**Level 2: File list (show on request or if errors)**

```typescript
Modified files:
  - src/crud/workspace.service.ts
  - src/crud/workspace.repository.ts
  - tests/crud/workspace.test.ts
  [... 6 more files]
```

**Level 3: Detailed output (show only on request or errors)**

```typescript
[Full Codex output - 1171 lines]
```

**Implementation:**

```typescript
// Always show Level 1
const summary = extractSummary(results);
showSummary(summary);

// Show Level 2 if errors or >5 files changed
if (summary.errors || summary.files_changed > 5) {
  showFileList(results.metadata.file_operations);
}

// Show Level 3 ONLY if:
// - Errors occurred
// - User explicitly asks ("show me the full output")
// - Verification needed
if (summary.errors || userRequested) {
  showFullOutput(results.output);
}
```

---

### Strategy 4: Metadata-Driven Display

Use the structured metadata instead of parsing text output:

**❌ Inefficient (parse text output):**

```typescript
const results = await _codex_local_results({ task_id });

// Parse text to extract info
const filesMatch = results.output.match(/Modified: (.*)/g);
const testsMatch = results.output.match(/Tests: (\d+) passed/);
```

**✅ Efficient (use metadata):**

```typescript
const results = await _codex_local_results({ task_id });

// Metadata already structured!
const summary = {
  files: results.metadata.file_operations,
  tests: results.metadata.test_results,
  duration: results.metadata.duration,
  tokens: results.metadata.thread_info?.token_usage,
};

// Use directly
console.log(`Modified: ${summary.files.modified_files.join(", ")}`);
console.log(
  `Tests: ${summary.tests.passed} passed, ${summary.tests.failed} failed`,
);
```

**Benefits:**

- No text parsing needed
- Consistent structure
- Already extracted by server
- Zero additional token cost

---

## Complete Example

### Before (Current Approach)

```typescript
// Start task
const task = await _codex_local_exec({ task });

// Poll manually 4 times (2000 tokens wasted)
sleep 45 → status → sleep 60 → status → sleep 60 → status → sleep 90 → status

// Get full results (12k tokens)
const results = await _codex_local_results({ task_id });

// Dump everything to user (overwhelming)
console.log(results); // 1171 lines

// Total tokens: ~14k
// User experience: Overwhelming, repetitive, unclear what's important
```

### After (Optimized Approach)

```typescript
// Start task with clear expectations
const task = await _codex_local_exec({ task });
console.log(`✅ Task started (ID: ${task.task_id})`);
console.log(`⏱️ Expected: 6-10 minutes`);
console.log(`📝 Waiting for completion...`);

// Use wait tool (no manual polling, ~200 tokens)
const results = await _codex_local_wait({ task_id: task.task_id });

// Extract metadata (zero additional tokens)
const summary = {
  duration: results.metadata.duration,
  files: results.metadata.file_operations.modified_files,
  tests: results.metadata.test_results,
  errors: results.metadata.error_context,
};

// Show concise summary (~100 tokens)
console.log(`✅ Complete in ${summary.duration}s`);
console.log(`📁 Modified ${summary.files.length} files:`);
summary.files.forEach((f) => console.log(`  - ${f}`));

if (summary.tests) {
  console.log(`✅ Tests: ${summary.tests.passed} passed`);
}

// Verify files exist (targeted reads, ~200 tokens)
for (const file of summary.files) {
  await verifyFileExists(file);
}

// ONLY show full output if errors
if (summary.errors) {
  console.log(`\n⚠️ Errors encountered - showing full output for debugging:`);
  console.log(results.output);
}

// Total tokens: ~500 (vs 14k before)
// Token savings: 96%!
// User experience: Clear, concise, action-oriented
```

---

## Decision Tree

```
Task Complete
    │
    ├─► Extract metadata
    │       │
    │       ├─► Show summary (ALWAYS)
    │       │   - Duration
    │       │   - Files changed count
    │       │   - Test results
    │       │
    │       ├─► Errors? ──► YES ──► Show full output
    │       │                  └─► Show actionable suggestions
    │       │
    │       ├─► No errors, many files (>5)? ──► Show file list
    │       │
    │       └─► No errors, few files (≤5) ──► Verify files exist
    │                                          └─► Done!
```

---

## Summary

**Key Principles:**

1. **Metadata over text parsing** - Use structured data
2. **Progressive disclosure** - Show summaries first, details on demand
3. **Targeted verification** - Read only what's needed
4. **Error-focused output** - Full details only when needed

**Token Impact:**

- Current approach: ~14k tokens per task
- Optimized approach: ~500 tokens per task
- **Savings: 96%**

**User Impact:**

- Current: Overwhelmed with 1171 lines of output
- Optimized: Clear 5-10 line summary with actionable info
- **Improvement: 99% reduction in noise**
