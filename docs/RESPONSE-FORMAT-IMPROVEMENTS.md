# Response Format Improvements for MCP Delegator

## Inspired by chrome-devtools MCP

**Date:** 2025-11-17
**Goal:** Make MCP responses cleaner, more parseable, and easier to consume

---

## Analysis: chrome-devtools MCP

### What They Do Right

**1. Clean Headers (No Emoji, Simple Text)**

```markdown
# evaluate_script response

Script ran on page and returned:
```

**2. Structured JSON Output**

```json
{
  "summary": {
    "batches": 5,
    "totalProcessed": 280
  },
  "batches": [...]
}
```

**3. Summary-First Approach**

- Top-level summary object
- Details nested below
- AI can parse easily

---

## Current MCP Delegator Issues

### Issue 1: Verbose Headers with Emoji

**Current:**

```markdown
## 📊 Codex Execution Status

### Active Processes (MCP Server)

**Process 1:**

- **Process ID (PID):** 12345
- **Task ID:** T-local-xyz
- **Started:** 97 seconds ago
- **Progress:** 50% (0/2 steps)
- **Status:** working
- **Current Activity:** Processing turn unknown
- **Metrics:** 0 file(s) changed, 0 command(s) executed
```

**Problems:**

- Emoji adds noise for AI parsing
- Headers take up visual space
- Buried information (takes 7 lines to show simple data)

---

### Issue 2: Unstructured Text Output

**Current:**

```markdown
**Process 1:**

- **Process ID (PID):** 12345
- **Task ID:** T-local-xyz
  ...
```

**Problems:**

- Not JSON parseable
- AI has to parse markdown
- Harder to extract specific fields

---

## Proposed Improvements

### Change 1: JSON-First Responses

**Before:**

```markdown
## 📊 Codex Execution Status

### Active Processes (MCP Server)

**Process 1:**

- **Process ID (PID):** 12345
- **Task ID:** T-local-xyz
- **Started:** 97 seconds ago
- **Progress:** 50% (0/2 steps)
```

**After:**

````markdown
# Status Check Result

Active processes: 1

```json
{
  "processes": [
    {
      "pid": 12345,
      "task_id": "T-local-xyz",
      "elapsed_seconds": 97,
      "progress": {
        "percent": 50,
        "completed_steps": 0,
        "total_steps": 2
      },
      "status": "working",
      "activity": "Processing turn unknown",
      "metrics": {
        "files_changed": 0,
        "commands_executed": 0
      }
    }
  ]
}
```
````

**Benefits:**

- AI can parse JSON directly
- Consistent structure
- Less visual noise
- Same information, more compact

---

### Change 2: Summary-First Structure

**Before (Data-First):**

```json
{
  "processes": [...],  // 50 lines
  "queue": [...],      // 20 lines
  "summary": {         // At the end
    "running": 1,
    "queued": 0
  }
}
```

**After (Summary-First):**

```json
{
  "summary": {
    "running": 1,
    "queued": 0,
    "total_elapsed_seconds": 97
  },
  "processes": [...],  // Details below
  "queue": [...]
}
```

**Benefits:**

- AI sees summary immediately
- Can skip details if not needed
- Matches chrome-devtools pattern

---

### Change 3: Conditional Detailed Output

**Before (Always Show Everything):**

````markdown
# Status Check Result

```json
{
  "summary": {...},
  "processes": [...],  // Always included
  "queue": [...],      // Always included
  "recently_completed": [...]  // Always included
}
```
````

**After (Conditional Details):**

````markdown
# Status Check Result

```json
{
  "summary": {
    "running": 1,
    "queued": 0
  }
  // Details only if non-empty:
  // "processes": [...],     // Only if running > 0
  // "queue": [...],         // Only if queued > 0
  // "recently_completed": [...] // Only if completed > 0
}
```
````

**Benefits:**

- Cleaner output when nothing to show
- Reduces noise
- AI can request details if needed

---

### Change 4: Plain Text Headers (No Emoji)

**Before:**

```markdown
## 📊 Codex Execution Status

### ✅ Recently Completed Tasks (Last 5 in this directory)

### 📋 Task Queue Status
```

**After:**

```markdown
# Status Check Result

## Recently Completed (5)

## Task Queue
```

**Benefits:**

- Cleaner parsing for AI
- Less visual noise
- More professional
- Faster to read

---

## Implementation Plan

### Phase 1: Add JSON Output Option (Backward Compatible)

Add `format` parameter to all tools:

```typescript
// Example: _codex_local_status
{
  "task_id": "T-local-xyz",
  "format": "json"  // Default: "markdown"
}
```

**Returns:**

```json
{
  "summary": {
    "running": 1,
    "queued": 0
  },
  "processes": [...]
}
```

**vs**

```typescript
{
  "task_id": "T-local-xyz",
  "format": "markdown"  // Current default
}
```

**Returns:**

```markdown
## 📊 Codex Execution Status

...
```

---

### Phase 2: Change Default to JSON (v4.0.0)

**Breaking change:**

- Default `format` becomes `"json"`
- Markdown available via `format: "markdown"`
- Update all tools to return JSON-first

---

### Phase 3: Simplify Markdown Format

**Even when using markdown:**

- Remove emoji from headers
- Use simpler structure
- Summary-first approach

---

## Example: Complete Before/After

### BEFORE (Current)

**Request:**

```typescript
_codex_local_status({ task_id: "T-local-xyz" });
```

**Response:**

```markdown
## 📊 Codex Execution Status

### Active Processes (MCP Server)

**Process 1:**

- **Process ID (PID):** 12345
- **Task ID:** T-local-xyz
- **Started:** 97 seconds ago
- **Progress:** 50% (0/2 steps)
- **Status:** working
- **Current Activity:** Processing turn unknown
- **Metrics:** 0 file(s) changed, 0 command(s) executed

---

### 📋 Task Queue Status

**Running:** 1
**Queued:** 0

---

### ✅ Recently Completed Tasks (Last 5 in this directory)

_No recently completed tasks in this directory_
```

**Token count:** ~500 tokens

---

### AFTER (Proposed)

**Request:**

```typescript
_codex_local_status({ task_id: "T-local-xyz", format: "json" });
```

**Response:**

````markdown
# Status Check Result

```json
{
  "summary": {
    "running": 1,
    "queued": 0,
    "recently_completed": 0
  },
  "processes": [
    {
      "pid": 12345,
      "task_id": "T-local-xyz",
      "elapsed_seconds": 97,
      "progress": {
        "percent": 50,
        "completed_steps": 0,
        "total_steps": 2
      },
      "status": "working",
      "activity": "Processing turn unknown",
      "metrics": {
        "files_changed": 0,
        "commands_executed": 0
      }
    }
  ]
}
```
````

**Token count:** ~200 tokens (60% reduction)

---

## Benefits Summary

| Aspect           | Before                | After            | Improvement      |
| ---------------- | --------------------- | ---------------- | ---------------- |
| **Parseability** | Markdown parsing      | JSON native      | Much easier      |
| **Token usage**  | 500                   | 200              | 60% reduction    |
| **Visual noise** | High (emoji, headers) | Low (plain text) | Cleaner          |
| **Structure**    | Flat                  | Summary-first    | Better hierarchy |
| **Conditional**  | Always show all       | Only non-empty   | Less clutter     |

---

## Decision: Implement or Not?

### Arguments FOR:

- ✅ 60% token reduction
- ✅ Easier AI parsing (JSON vs markdown)
- ✅ Matches industry patterns (chrome-devtools)
- ✅ Backward compatible (add format param first)
- ✅ Better structure (summary-first)

### Arguments AGAINST:

- ❌ Breaking change for v4.0.0 (when default changes)
- ❌ More complex implementation
- ❌ Current markdown format works

### Recommendation:

**Implement Phase 1 (JSON option) in v3.6.0**, then evaluate:

- If AI agents prefer JSON, make it default in v4.0.0
- If markdown still preferred, keep as option

---

## Implementation Checklist

### Phase 1: Add JSON Format Option (v3.6.0)

- [ ] Add `format` parameter to all 15 tools
- [ ] Implement JSON serialization
- [ ] Ensure summary-first structure
- [ ] Document JSON schema
- [ ] Test with AI agents
- [ ] Update quickrefs with examples

### Phase 2: Evaluate (v3.6.1)

- [ ] Collect feedback from AI usage
- [ ] Measure token savings
- [ ] Assess parsing ease
- [ ] Decide on v4.0.0 default

### Phase 3: Change Default (v4.0.0)

- [ ] Make JSON default format
- [ ] Keep markdown as `format: "markdown"`
- [ ] Update all documentation
- [ ] Migration guide for users
