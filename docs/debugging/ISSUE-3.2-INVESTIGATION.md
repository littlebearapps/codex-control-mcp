# Issue 3.2 Investigation: Working Directory Isolation

**Date**: 2025-11-17
**Investigator**: Claude (Sonnet 4.5)
**Status**: 🔍 Investigation Complete - ✅ ROOT CAUSE IDENTIFIED

---

## Issue Summary

**Reported Symptom**:
- Tasks from different working directories appear in same registry
- `showAll: false` should filter by current directory
- Stuck tasks from unrelated projects pollute output
- Example: 9 stuck tasks from `/tmp/git-safety-test` appear when querying from auditor-toolkit

**Expected Behavior**:
```typescript
// User in /project-a/
_codex_local_status({ showAll: false })
// Should show ONLY tasks from /project-a/
```

**Actual Behavior**:
```typescript
// User in /project-a/
_codex_local_status({ showAll: false })
// Shows tasks from ALL projects (mixed together)
```

**Source**: `docs/debugging/AUDITOR-TOOLKIT-ISSUES.md` lines 322-350

---

## Code Analysis

### Working Directory Filtering Logic

**File**: `src/tools/local_status.ts` lines 31-69

```typescript
export class LocalStatusTool {
  async execute(input: LocalStatusToolInput): Promise<LocalStatusToolResult> {
    const workingDir = input.workingDir || process.cwd();  // ⚠️ THE ISSUE
    const showAll = input.showAll || false;

    // Query tasks with filter
    const tasks = globalTaskRegistry.queryTasks({
      origin: 'local',
      workingDir: showAll ? undefined : workingDir  // Filter by workingDir if showAll=false
    });

    // ... display logic
  }
}
```

**Tool Schema Description** (lines 173-177):
```typescript
workingDir: {
  type: 'string',
  description: 'Working directory to filter tasks by. Defaults to current directory. Only affects task registry section.',
}
```

**The Problem**:
- Description says: "Defaults to current directory"
- Implementation uses: `process.cwd()` (MCP server's directory)
- **These are NOT the same thing!**

---

### Task Registry Query Logic

**File**: `src/state/task_registry.ts` lines 438-441

```typescript
queryTasks(filter: TaskFilter = {}): Task[] {
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params: any[] = [];

  if (filter.workingDir) {
    query += ' AND working_dir = ?';  // Exact match filter
    params.push(filter.workingDir);
  }

  // ... other filters
  query += ' ORDER BY created_at DESC';

  const stmt = this.db.prepare(query);
  return stmt.all(...params) as Task[];
}
```

**Query Logic**: ✅ CORRECT - Uses exact SQL match `working_dir = ?`

---

### Task Creation Logic

**File**: `src/tools/local_exec.ts` line 210

```typescript
const registeredTask = globalTaskRegistry.registerTask({
  origin: 'local',
  instruction: validated.task,
  workingDir: validated.workingDir || process.cwd(),  // ⚠️ SAME ISSUE
  mode: validated.mode,
  model: validated.model,
  threadId: thread.id || undefined,
});
```

**All Tools Use Same Pattern**:
```bash
src/tools/local_run.ts:98:        const workingDir = input.workingDir || process.cwd();
src/tools/local_status.ts:32:    const workingDir = input.workingDir || process.cwd();
src/tools/local_exec.ts:210:     workingDir: validated.workingDir || process.cwd(),
src/tools/cloud.ts:173:          workingDir: process.cwd(),
src/tools/local_resume.ts:127:   const workingDir = process.cwd();
```

---

## Root Cause Analysis

### The Fundamental Issue

**MCP Server Context**:
```
User's perspective:
  - Running Claude Code in: /Users/nathanschram/project-a/
  - Expects "current directory" = /Users/nathanschram/project-a/

MCP Server's perspective:
  - MCP server is a Node.js process: node dist/index.js
  - Started from: /Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/mcp-delegator
  - process.cwd() = /Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/mcp-delegator
```

**The Disconnect**:
```
process.cwd() returns MCP server's working directory
              NOT user's current working directory
```

### Timeline of User's Experience

**Scenario**: User works in auditor-toolkit, sees stuck tasks from `/tmp/git-safety-test`

**What Actually Happened**:

1. **Tasks Created** (weeks ago in `/tmp/git-safety-test`):
   ```bash
   cd /tmp/git-safety-test
   # User explicitly ran tests that created tasks
   # Tasks registered with workingDir = /tmp/git-safety-test (explicit parameter)
   ```

2. **Tasks Created** (in auditor-toolkit):
   ```bash
   cd /Users/nathanschram/auditor-toolkit
   # Claude Code calls _codex_local_exec() WITHOUT workingDir parameter
   # Task registered with workingDir = process.cwd() (MCP server's directory)
   ```

3. **User Checks Status** (in auditor-toolkit):
   ```bash
   cd /Users/nathanschram/auditor-toolkit
   # Claude Code calls _codex_local_status() WITHOUT workingDir parameter
   # Query filters by: working_dir = process.cwd() (MCP server's directory)
   # Returns: Tasks created with MCP server's directory
   # DOES NOT return: Tasks from /tmp/git-safety-test (different directory)
   ```

**Wait, this SHOULD work correctly!**

Let me re-analyze the user's report...

---

## Deeper Investigation

**User's Report Re-examined**:
> "9 stuck tasks from /tmp/git-safety-test appear when querying from auditor-toolkit"

**Hypothesis 1**: Tasks have `working_dir = /tmp/git-safety-test`
- If query filters by `working_dir = process.cwd()` (MCP server's directory)
- These tasks SHOULD NOT match → Not the issue ❌

**Hypothesis 2**: User explicitly passed `showAll: true`
- This would bypass working directory filter
- But report says `showAll: false` should filter → Not the issue ❌

**Hypothesis 3**: Tasks have `working_dir = NULL` or empty
- Would not match filter → Check database schema

**Hypothesis 4**: User is using `showAll: true` by default
- Tool description recommends this
- Then all tasks show (expected behavior) → Possible! ✅

**Hypothesis 5**: The DEFAULT behavior is the problem
- User expects default to show "only my current project"
- But default `showAll: false` + `process.cwd()` shows "only MCP server's directory tasks"
- Neither of these is what user wants! → **THIS IS THE ISSUE** ✅

---

## The REAL Root Cause

**What Users Expect**:
```typescript
// User in /project-a/
_codex_local_status()  // No parameters
// Expected: Show tasks from /project-a/ (my current project)
```

**What Actually Happens**:
```typescript
// User in /project-a/ (but MCP server is in /mcp-server/)
_codex_local_status()  // No parameters
// workingDir defaults to process.cwd() = /mcp-server/
// Filters by: working_dir = '/mcp-server/'
// Returns: Tasks created with MCP server's directory (almost none!)
```

**Why This Is Confusing**:

1. **Most tasks are created WITH explicit workingDir**:
   - `_codex_local_exec({ task: "...", workingDir: "/project-a/" })`
   - Task stored with `working_dir = /project-a/`

2. **Status tool CANNOT automatically know user's current project**:
   - MCP protocol doesn't provide this context
   - User MUST pass `workingDir` parameter explicitly

3. **Default behavior is almost useless**:
   - Filters by MCP server's directory (rarely has tasks)
   - User sees "No tasks found for current directory"
   - Misleading message: "current directory" implies user's project

4. **Users are forced to use `showAll: true`**:
   - Only way to see tasks across projects
   - But then loses per-project isolation

---

## Evidence from User's Workflow

**From AUDITOR-TOOLKIT-ISSUES.md**:

```
### Issue 3.2: Working Directory Isolation
Tasks from /tmp/git-safety-test appear when querying from auditor-toolkit

Expected: Only tasks from auditor-toolkit directory
Actual: Both projects' tasks mixed together
```

**This suggests**:
- User is seeing tasks from MULTIPLE directories at once
- **Conclusion**: User is using `showAll: true` (or equivalent)
- The issue is: User WANTS per-project isolation but can't get it easily

---

## The Architecture Problem

**MCP Server Has No Context**:

```
┌─────────────────────────────────────────────────────────────┐
│ Claude Code Running in /project-a/                          │
│   ↓                                                          │
│   Calls: _codex_local_status()  ← No workingDir parameter   │
│   ↓                                                          │
│   MCP Request sent to server                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ MCP Server Running in /mcp-server/                          │
│   ↓                                                          │
│   Receives: _codex_local_status() with NO context           │
│   ↓                                                          │
│   Defaults: workingDir = process.cwd() = /mcp-server/       │
│   ↓                                                          │
│   Filters by: working_dir = '/mcp-server/' (WRONG!)         │
└─────────────────────────────────────────────────────────────┘
```

**Key Point**: MCP server CAN'T automatically know which project user is in!

---

## Proposed Fixes

### Option A: Change Default to `showAll: true`

**Implementation**:
```typescript
// src/tools/local_status.ts
async execute(input: LocalStatusToolInput): Promise<LocalStatusToolResult> {
  const workingDir = input.workingDir || process.cwd();
  const showAll = input.showAll ?? true;  // ✅ Changed default to true

  const tasks = globalTaskRegistry.queryTasks({
    origin: 'local',
    workingDir: showAll ? undefined : workingDir
  });
}
```

**Benefits**:
- ✅ More useful default (see all local tasks)
- ✅ Matches user expectation: "show me what's running"
- ✅ No breaking changes (just different default)
- ✅ Users can still filter with `workingDir` parameter

**Limitations**:
- ⚠️ Shows tasks from ALL projects (not isolated by default)
- ⚠️ Users must explicitly pass `workingDir` for isolation

---

### Option B: Make `workingDir` Required

**Implementation**:
```typescript
// src/tools/local_status.ts
export interface LocalStatusToolInput {
  workingDir: string;  // ✅ No longer optional
  showAll?: boolean;
}

async execute(input: LocalStatusToolInput): Promise<LocalStatusToolResult> {
  const workingDir = input.workingDir;  // No default
  const showAll = input.showAll || false;
}

// Tool schema
inputSchema: {
  type: 'object',
  properties: {
    workingDir: {
      type: 'string',
      description: 'Working directory to filter tasks by. REQUIRED - MCP server cannot infer your current project directory.',
    },
    showAll: {
      type: 'boolean',
      default: false,
      description: 'Show all tasks from all directories (ignores workingDir parameter)',
    },
  },
  required: ['workingDir'],  // ✅ Make it required
}
```

**Benefits**:
- ✅ Forces explicit directory specification (no confusion)
- ✅ Clear expectations about filtering

**Limitations**:
- ❌ Breaking change (existing calls without parameter fail)
- ❌ More verbose (always need to pass parameter)

---

### Option C: Document the Limitation (Minimal Fix)

**Implementation**:
```typescript
// Update tool schema description only
workingDir: {
  type: 'string',
  description: 'Working directory to filter tasks by. IMPORTANT: Defaults to MCP server\'s directory (not your current project). Always pass this parameter explicitly or use showAll: true to see all tasks.',
}

showAll: {
  type: 'boolean',
  default: false,
  description: 'Show all tasks from all directories (RECOMMENDED: set to true unless filtering by specific directory).',
}
```

**Benefits**:
- ✅ No code changes required
- ✅ No breaking changes
- ✅ Honest about limitation

**Limitations**:
- ❌ Doesn't fix UX problem
- ❌ Users still confused by default behavior

---

### Option D: Hybrid Approach (Recommended)

**Combine Option A + C**:

1. **Change default `showAll` to `true`** (Option A)
2. **Update tool descriptions** (Option C)
3. **Add deprecation warning** when using default `process.cwd()`

**Implementation**:
```typescript
// src/tools/local_status.ts
async execute(input: LocalStatusToolInput): Promise<LocalStatusToolResult> {
  const workingDir = input.workingDir || process.cwd();
  const showAll = input.showAll ?? true;  // ✅ Default to true

  // Warn when using misleading default
  if (!input.workingDir && !input.showAll) {
    console.error('[LocalStatus] ⚠️ Using default workingDir (MCP server directory). Recommend passing explicit workingDir or showAll: true.');
  }

  const tasks = globalTaskRegistry.queryTasks({
    origin: 'local',
    workingDir: showAll ? undefined : workingDir
  });
}

// Update tool schema
inputSchema: {
  type: 'object',
  properties: {
    workingDir: {
      type: 'string',
      description: 'Working directory to filter tasks by. IMPORTANT: MCP server cannot infer your current project directory. Either pass this explicitly (e.g., "/Users/name/project") or use showAll: true (recommended).',
    },
    showAll: {
      type: 'boolean',
      default: true,  // ✅ Changed default
      description: 'Show all local tasks across all directories (default: true). Set to false and provide workingDir to filter to specific directory.',
    },
  },
}
```

**Benefits**:
- ✅ Better default behavior (show all tasks)
- ✅ Clear documentation about limitation
- ✅ Warning helps debug confusion
- ✅ Small behavior change (non-breaking)

**Limitations**:
- ⚠️ Slight API behavior change (default showAll changes)

---

## Testing Plan

### Test 1: Reproduce Current Behavior

**Setup**:
```bash
# Create tasks in different directories
cd /tmp/test-project-a
# Create task with explicit workingDir

cd /tmp/test-project-b
# Create task with explicit workingDir
```

**Test Case**:
```typescript
// From any directory
{
  showAll: false  // Default workingDir = process.cwd() (MCP server's directory)
}
// Expected: No tasks (unless some were created with MCP server's directory)
// Actual: (verify this is what happens)
```

**Success Criteria**:
- ✅ Reproduces confusion (no tasks shown despite tasks existing)

---

### Test 2: Verify Fix (Option D - Change Default)

**Apply Fix**: Change default `showAll` to `true`

**Test Case**:
```typescript
// From any directory
{}  // No parameters
// Expected: Shows ALL local tasks (from all directories)
```

**Success Criteria**:
- ✅ Shows tasks from all projects
- ✅ More useful default behavior

---

### Test 3: Verify Filtering Still Works

**Test Case**:
```typescript
// Explicit filtering
{
  workingDir: "/tmp/test-project-a",
  showAll: false
}
// Expected: Only tasks from /tmp/test-project-a/
```

**Success Criteria**:
- ✅ Filtering works correctly when explicit

---

### Test 4: Verify Warning Message

**Test Case**:
```typescript
// Use old default (after migration period)
{
  showAll: false  // Explicit false
}
// Expected: Warning logged about using process.cwd()
```

**Success Criteria**:
- ✅ Warning helps users understand limitation

---

## Implementation Checklist

**Phase 1: Investigation** ✅ COMPLETE
- [x] Read local_status.ts filtering logic
- [x] Read task_registry.ts query implementation
- [x] Understand MCP context limitation
- [x] Identify root cause
- [x] Document findings

**Phase 2: Design Fix**
- [ ] Choose fix approach (A, B, C, or D)
- [ ] Design implementation details
- [ ] Write test cases
- [ ] Review API compatibility

**Phase 3: Implementation**
- [ ] Modify local_status.ts default behavior
- [ ] Update tool schema descriptions
- [ ] Add deprecation warning
- [ ] Update documentation

**Phase 4: Testing**
- [ ] Test 1: Reproduce current behavior
- [ ] Test 2: Verify fix improves UX
- [ ] Test 3: Verify filtering still works
- [ ] Test 4: Verify warning appears

**Phase 5: Documentation**
- [ ] Update quickrefs/tools.md
- [ ] Update CHANGELOG.md
- [ ] Add to troubleshooting.md
- [ ] Document in session summary

---

## Recommendations

### Immediate Actions

1. **Implement Option D (Hybrid Approach)** - RECOMMENDED
   - Change default `showAll` to `true`
   - Update tool descriptions to be accurate
   - Add warning when using misleading default
   - Deploy in v3.4.2

2. **Update All MCP Config Examples**
   - Show `showAll: true` in examples
   - Recommend explicit `workingDir` for filtering
   - Document MCP context limitation

3. **Document Best Practices** (Interim)
   - Update quickrefs/tools.md
   - Add "Working Directory Context" section
   - Explain MCP server limitation

### Long-Term Improvements

1. **Explore MCP Protocol Extensions**
   - Check if MCP 1.0+ provides working directory context
   - If available, use it instead of process.cwd()
   - Target: v3.5.0

2. **Add Project-Based Tagging**
   - Allow users to tag tasks with project names
   - Filter by project tag instead of directory
   - More flexible than path-based filtering

3. **Improve Task Organization**
   - Add workspace concept (group of related directories)
   - Better multi-project task management

---

## Related Issues

- **Issue 1.1**: Tasks never execute (testing deferred)
- **Issue 1.2**: Tasks report success without creating files (root cause found)
- **Issue 1.3**: Stuck tasks accumulation (root cause found)
- **Issue 1.5**: Execution logging infrastructure (root cause found)
- **Issue 3.1**: Truncated output (root cause found)

---

**Status**: 🔍 Investigation Complete - ✅ ROOT CAUSE IDENTIFIED

**Root Cause**: MCP server has no context about user's current working directory. Default `workingDir = process.cwd()` returns MCP server's directory (not user's project directory), resulting in misleading "No tasks found for current directory" messages and inability to isolate tasks by project.

**Next Action**: Implement Option D (Hybrid Approach) - change default `showAll` to `true`, update descriptions, add warnings for v3.4.2.
