# Parameter Naming Inconsistencies - Complete Analysis

**Date**: 2025-11-15
**Severity**: HIGH
**Impact**: Confusing API, silent failures when wrong names used

---

## Executive Summary

MCP Delegator has **systematic parameter naming inconsistencies** across three layers:

1. **Database** uses `snake_case`
2. **Tool APIs** use mixed `camelCase` and `snake_case`
3. **Codex SDK** uses `workingDirectory` (different from both!)

This causes confusion and silent failures when developers use the wrong naming convention.

---

## Inconsistencies Found

### 1. Working Directory Parameter

| Layer             | Parameter Name     | Type                  |
| ----------------- | ------------------ | --------------------- |
| Database Column   | `working_dir`      | snake_case            |
| Tool Schema       | `workingDir`       | camelCase             |
| Codex SDK         | `workingDirectory` | **Different!**        |
| Index.ts Fallback | Both accepted      | Handles inconsistency |

**Code Evidence**:

```typescript
// Database (snake_case)
// src/state/task_registry.ts:186
working_dir TEXT,

// Tool Schema (camelCase)
// src/tools/local_run.ts:20
workingDir?: string;

// Codex SDK (different name!)
// src/tools/local_exec.ts:103
threadOptions.workingDirectory = validated.workingDir;

// Fallback (handles both)
// src/index.ts:142
const workingDir = (args as any)?.workingDir || (args as any)?.working_dir || process.cwd();
```

**Impact**:

- ✅ Works due to fallback in index.ts
- ⚠️ Confusing - users don't know which to use
- ⚠️ Documentation shows `workingDir` but `working_dir` also works

---

### 2. Task ID Parameter

| Tool                   | Parameter Name | Type       |
| ---------------------- | -------------- | ---------- |
| `_codex_local_results` | `task_id`      | snake_case |
| `_codex_local_wait`    | `task_id`      | snake_case |
| `_codex_local_cancel`  | `task_id`      | snake_case |
| `_codex_cloud_results` | `task_id`      | snake_case |
| `_codex_cloud_wait`    | `task_id`      | snake_case |
| `_codex_cloud_cancel`  | `task_id`      | snake_case |
| Database Column        | `id`           | Different! |
| Internal Code          | `taskId`       | camelCase  |

**Code Evidence**:

```typescript
// Tool Schema (snake_case)
// src/tools/local_results.ts:11
task_id: string;

// Internal Usage (camelCase)
// src/state/task_registry.ts:247
const taskId = this.generateTaskId(params.origin);
```

**Impact**:

- ✅ Consistent across wait/results/cancel tools (all use `task_id`)
- ⚠️ Inconsistent with other parameters (which use camelCase)

---

### 3. Thread ID Parameter

| Layer           | Parameter Name | Type       |
| --------------- | -------------- | ---------- |
| Database Column | `thread_id`    | snake_case |
| Tool Schema     | `threadId`     | camelCase  |
| Internal Code   | `threadId`     | camelCase  |

**Code Evidence**:

```typescript
// Database (snake_case)
// src/state/task_registry.ts:200
thread_id TEXT,

// Tool Schema (camelCase)
// src/tools/local_resume.ts:3
threadId: z.ZodString;
```

**Impact**:

- ⚠️ Inconsistent between database and API

---

### 4. Environment Policy Parameters

| Parameter          | Naming    | Consistent? |
| ------------------ | --------- | ----------- |
| `outputSchema`     | camelCase | ✅ Yes      |
| `envPolicy`        | camelCase | ✅ Yes      |
| `envAllowList`     | camelCase | ✅ Yes      |
| `skipGitRepoCheck` | camelCase | ✅ Yes      |

**Impact**:

- ✅ These are consistent across all tools

---

## Root Cause

**Historical Evolution**:

1. Database designed with `snake_case` (SQL convention)
2. Tool schemas used `camelCase` (JavaScript convention)
3. Fallback added to handle both (bandaid fix)
4. New tools inherited inconsistencies

**Why It Persists**:

- Fallback in `index.ts` masks the problem
- Database schema can't easily change (backward compatibility)
- No strict parameter validation to catch mistakes

---

## Impact Analysis

### Low Impact (Works but Confusing)

- `workingDir` vs `working_dir` - fallback handles both
- Users can use either but don't know which is "correct"

### Medium Impact (Inconsistent API)

- Some tools use `task_id` (snake_case)
- Other tools use `taskId` (camelCase)
- Developers must remember which convention each tool uses

### High Impact (Silent Failures)

- If fallback didn't exist, `working_dir` would be silently ignored
- Parameters like `skip_git_repo_check` vs `skipGitRepoCheck` cause issues

---

## Recommendations

### Option A: Standardize on camelCase (Preferred)

**Changes Required**:

1. Keep database columns as-is (`snake_case`)
2. All tool schemas use `camelCase` only
3. Add strict validation to reject `snake_case` variants
4. Migration guide for users

**Pros**:

- ✅ JavaScript/TypeScript convention
- ✅ Consistent with most modern APIs
- ✅ Less migration pain (only reject wrong names)

**Cons**:

- ⚠️ Database mapping layer needed (already exists)

**Implementation**:

```typescript
// Add strict validation
function validateParameters(args: any, schema: any) {
  const snakeCaseParams = [
    "working_dir",
    "task_id",
    "thread_id",
    "skip_git_repo_check",
  ];

  for (const param of snakeCaseParams) {
    if (args[param] !== undefined) {
      const camelCase = toCamelCase(param); // e.g., working_dir → workingDir
      throw new Error(
        `Parameter '${param}' is not valid. Did you mean '${camelCase}'?`,
      );
    }
  }
}
```

### Option B: Standardize on snake_case

**Changes Required**:

1. Change ALL tool schemas to `snake_case`
2. Update database columns (already `snake_case`)
3. Breaking change for existing users

**Pros**:

- ✅ Matches database schema
- ✅ Consistent with Python conventions

**Cons**:

- ❌ Breaking change
- ❌ Conflicts with JavaScript/TypeScript conventions
- ❌ Requires updating all existing code

### Option C: Keep Fallback + Add Warnings

**Changes Required**:

1. Keep fallback in `index.ts`
2. Add deprecation warnings for `snake_case`
3. Gradually migrate users to `camelCase`

**Pros**:

- ✅ No breaking changes
- ✅ Users have time to migrate

**Cons**:

- ⚠️ Prolongs inconsistency
- ⚠️ More complex to maintain

---

## Recommended Solution

**Phase 1: Add Validation (Immediate)**

```typescript
// src/index.ts - Add before tool execution
const invalidParams = {
  working_dir: "workingDir",
  task_id: "taskId", // For non-wait/results tools
  thread_id: "threadId",
  skip_git_repo_check: "skipGitRepoCheck",
  env_policy: "envPolicy",
  env_allow_list: "envAllowList",
  output_schema: "outputSchema",
};

for (const [wrong, correct] of Object.entries(invalidParams)) {
  if (args[wrong] !== undefined) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Parameter Error\n\nUnknown parameter '${wrong}'.\n\n💡 Did you mean '${correct}'?\n\nCheck .codex-errors.log for details.`,
        },
      ],
      isError: true,
    };
  }
}
```

**Phase 2: Update Documentation**

- Clearly document `camelCase` as standard
- Add migration guide for users using `snake_case`
- Update all examples to use `camelCase`

**Phase 3: Consider Removing Fallback (v4.0.0)**

- Once users migrated, remove fallback
- Cleaner codebase, less confusion

---

## Special Case: task_id

**Current Status**: `task_id` (snake_case) is the **official** parameter name for:

- `_codex_local_results`
- `_codex_local_wait`
- `_codex_local_cancel`
- `_codex_cloud_results`
- `_codex_cloud_wait`
- `_codex_cloud_cancel`

**Recommendation**:

- **Keep** `task_id` for these tools (already established)
- Internal code can still use `taskId` (camelCase)
- This is the ONE exception to the camelCase rule

**Rationale**:

- Consistency within wait/results/cancel tool family
- Less breaking change risk
- Clear precedent already established

---

## Implementation Priority

### P0 - Critical (This Week)

1. ✅ Add strict parameter validation with helpful error messages
2. ✅ Update CLAUDE.md documentation with correct parameter names
3. ✅ Add to .codex-errors.log when wrong parameter used

### P1 - High (Next Week)

1. Document all parameter names in quickrefs/
2. Add migration guide for users
3. Update all test files to use correct names

### P2 - Medium (Future)

1. Consider removing fallback in v4.0.0
2. Add linting rules to catch wrong parameter names
3. Generate TypeScript types from schemas

---

## Testing Plan

### Test 1: Strict Validation

```typescript
// Should REJECT
{ task: "test", working_dir: "/tmp" }
→ Error: "Unknown parameter 'working_dir'. Did you mean 'workingDir'?"

// Should ACCEPT
{ task: "test", workingDir: "/tmp" }
→ Success
```

### Test 2: task_id Exception

```typescript
// Should ACCEPT (official parameter)
{ task_id: "T-local-abc123" }
→ Success

// Should REJECT
{ taskId: "T-local-abc123" }
→ Error: "Unknown parameter 'taskId'. Did you mean 'task_id'?"
```

### Test 3: Error Logging

```bash
# Should log to .codex-errors.log
cat .codex-errors.log
→ {"level":"error","message":"Unknown parameter used: working_dir"}
```

---

## Summary

**Current State**:

- ❌ Mixed snake_case and camelCase
- ⚠️ Fallback masks issues
- ⚠️ Confusing for users

**Desired State**:

- ✅ camelCase for all parameters (except `task_id`)
- ✅ Strict validation rejects wrong names
- ✅ Clear error messages guide users

**Action Required**:

1. Implement strict validation (P0)
2. Update documentation (P0)
3. Add migration guide (P1)
