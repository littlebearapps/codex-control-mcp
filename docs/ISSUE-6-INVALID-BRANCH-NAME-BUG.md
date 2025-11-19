# Issue #6: Invalid Branch Name in Safety Checkpoint Creation

**Date**: 2025-11-16
**Severity**: CRITICAL
**Status**: Under Investigation

**Discovery**: Test 2.6 (`git reset HEAD~1`)

---

## Summary

Safety checkpoint creation fails when the git operation contains characters that are invalid in git branch names. Specifically, `~` character in operation names like "git-reset-head~n" causes checkpoint creation to fail.

## Error

```
❌ Tool execution failed: Git command failed (exit 128): fatal: 'safety/git-reset-head~n-2025-11-16T03-23-54-e7d5cde' is not a valid branch name
hint: See `man git check-ref-format`
```

## Discovery

**Test**: Test 2.6 - `git reset HEAD~1`
**Operation detected**: "git reset HEAD~N"
**Branch name attempted**: `safety/git-reset-head~n-2025-11-16T03-23-54-e7d5cde`
**Problem**: `~` is not valid in git branch names

## Root Cause

In `src/security/safety_checkpointing.ts`, the operation name sanitization is insufficient:

```typescript
// Current code (BUGGY)
const operation = riskyOpsToCheckpoint[0].operation
  .replace(/\s+/g, "-")
  .toLowerCase();
const checkpoint = await checkpointing.createCheckpoint(operation, workingDir);
```

This only replaces whitespace with dashes, but doesn't handle special characters that are invalid in git branch names.

**Invalid characters in git branch names**:

- `~` (tilde) - used for revision shortcuts
- `^` (caret) - used for parent commits
- `:` (colon) - used in refspecs
- `?` `*` `[` - glob characters
- `\` - escape character
- `..` - range operator
- `@{` - reflog syntax
- And others per `git check-ref-format`

## Impact

**Severity**: CRITICAL - Blocks execution of certain Tier 2 operations

**Affected Operations**:

- ✅ `git reset HEAD~N` - FAILS (contains `~`)
- ✅ `git commit --amend` - Works (no special chars)
- ✅ `git clean -fdx` - Works (no special chars)
- ✅ `git push --force` - Works (no special chars)
- ✅ `git rebase` - Works (no special chars)
- ✅ `git reset --hard` - Works (no special chars)
- ⚠️ Any future operations with special chars - WILL FAIL

## Fix Required

**Sanitize operation names** to remove/replace ALL invalid branch name characters:

```typescript
// Proposed fix
function sanitizeOperationName(operation: string): string {
  return operation
    .toLowerCase()
    .replace(/[~^:?*[\\\s@{}]/g, "-") // Replace invalid chars with dash
    .replace(/\.{2,}/g, "-") // Replace .. with dash
    .replace(/-+/g, "-") // Collapse multiple dashes
    .replace(/^-|-$/g, ""); // Remove leading/trailing dashes
}
```

## Testing Plan

1. Fix sanitization in `SafetyCheckpointing.createCheckpoint()`
2. Re-test Test 2.6 (`git reset HEAD~1`)
3. Test with other special characters to verify robustness
4. Add unit tests for edge cases

## Related Issues

- **Issue #4**: Pattern detection bug (FIXED)
- **Issue #5**: Output capture failure (FIXED)
- **Issue #6**: This issue - Invalid branch name sanitization

---

**Next Steps**:

1. Locate and read `src/security/safety_checkpointing.ts`
2. Implement robust sanitization function
3. Apply fix to all 4 execution tools
4. Rebuild and test
5. Resume Test 2.6
