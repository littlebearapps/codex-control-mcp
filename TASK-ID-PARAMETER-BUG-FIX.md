# Task ID Parameter Bug Fix - v3.0.1

**Date**: 2025-11-14
**Status**: ✅ Fixed and Deployed
**Version**: v3.0.1 (post unified tool removal)

---

## Summary

Fixed critical parameter naming inconsistency in `_codex_local_results` tool that caused task ID to be received as `undefined`, breaking result retrieval functionality.

---

## The Bug

### Symptoms

```
Error: ❌ Task Not Found
**Task ID**: `undefined`
Task not found in registry.
```

When calling `_codex_local_results` with `task_id: "T-local-abc123"`, the tool received the parameter as `undefined`.

### Root Cause

**Parameter naming inconsistency across tools**:

✅ **Correct** (12 tools using snake_case):

- `_codex_local_wait` → `task_id`
- `_codex_local_cancel` → `task_id`
- `_codex_cloud_wait` → `task_id`
- `_codex_cloud_cancel` → `task_id`
- `_codex_cloud_results` → `task_id`
- Plus 7 others

❌ **Incorrect** (1 tool using camelCase):

- `_codex_local_results` → `taskId` (inconsistent!)

### Discovery

Discovered during comprehensive production testing after unified tool removal. When attempting to retrieve results from completed tasks, the tool consistently failed with "Task ID: undefined" error.

---

## The Fix

### Files Changed

**`src/tools/local_results.ts`** - 4 changes:

#### Change 1: Interface (Line 11)

```typescript
// BEFORE
export interface LocalResultsInput {
  taskId: string;
}

// AFTER
export interface LocalResultsInput {
  task_id: string;
}
```

#### Change 2: Execute Method (7 occurrences)

```typescript
// BEFORE
const task = globalTaskRegistry.getTask(input.taskId);
text: `❌ Task Not Found\n\n**Task ID**: \`${input.taskId}\`...`;
// (and 5 more occurrences)

// AFTER
const task = globalTaskRegistry.getTask(input.task_id);
text: `❌ Task Not Found\n\n**Task ID**: \`${input.task_id}\`...`;
// (all references updated)
```

#### Change 3: Schema Property (Line 137)

```typescript
// BEFORE
inputSchema: {
  type: 'object',
  properties: {
    taskId: {
      type: 'string',
      description: 'Task ID from codex_run async execution',
    },
  },

// AFTER
inputSchema: {
  type: 'object',
  properties: {
    task_id: {
      type: 'string',
      description: 'Task ID from codex_run async execution',
    },
  },
```

#### Change 4: Schema Required Field (Line 142)

```typescript
// BEFORE
required: ['taskId'],

// AFTER
required: ['task_id'],
```

---

## Testing

### Before Fix

```bash
# Call with correct pattern (snake_case)
_codex_local_results(task_id: "T-local-mhyhbxhso4vh6v")

# Result
❌ Task Not Found
**Task ID**: `undefined`
Task not found in registry.
```

### After Fix

```bash
# Call with correct pattern (snake_case)
_codex_local_results(task_id: "T-local-mhyhbxhso4vh6v")

# Result
✅ Codex SDK Task Completed
**Task ID**: `T-local-mhyhbxhso4vh6v`
**Task**: List all markdown files in the current directory and count them
**Status**: ✅ Success
**Events Captured**: 0
```

### Test Results (Post-Fix)

**Test 1**: Retrieve results for `T-local-mhyh4cdwnnqez7` ✅

```
✅ Codex SDK Task Completed
**Task ID**: `T-local-mhyh4cdwnnqez7`
**Task**: List all markdown files in the current directory and count them
**Status**: ✅ Success
```

**Test 2**: Retrieve results for `T-local-mhygko41x53pzp` ✅

```
✅ Codex SDK Task Completed
**Task ID**: `T-local-mhygko41x53pzp`
**Task**: Count the number of lines in the README.md file
**Status**: ✅ Success
```

---

## Deployment

### Build

```bash
npm run build
# ✅ Successful compilation with no errors
```

### Production Deployment

```bash
cp -r dist/* ~/claude-code-tools/mcp/codex-control/dist/
# ✅ Deployed to production
```

### Verification

- ✅ Claude Code restarted
- ✅ MCP server reconnected
- ✅ Tool accessible with correct parameter name
- ✅ Results retrieval working perfectly

---

## Impact

### Before Fix

- ❌ `_codex_local_results` completely broken
- ❌ No way to retrieve async task results
- ❌ Forced users to check status only

### After Fix

- ✅ `_codex_local_results` working correctly
- ✅ Consistent parameter naming across all 14 tools
- ✅ Full async workflow functional

---

## Lessons Learned

### Why This Happened

1. **Inconsistent naming convention**: Mixed camelCase and snake_case
2. **No parameter validation tests**: Would have caught this immediately
3. **Copy-paste error**: Likely copied from early prototype with different naming

### Prevention

1. ✅ **Standardize on snake_case** for all MCP tool parameters (matches Python conventions, Codex CLI style)
2. ⚠️ **Add parameter validation tests** (future work)
3. ⚠️ **Linter rule for parameter consistency** (future work)

---

## Related Issues

- Unified tool removal: `UNIFIED-TOOL-REMOVAL-SUMMARY.md`
- Async testing: `ASYNC-COMPREHENSIVE-TEST-RESULTS.md`
- Production testing: `PRODUCTION-TEST-RESULTS.md`

---

## Status: ✅ RESOLVED

**All 14 primitives now working correctly with consistent parameter naming!**
