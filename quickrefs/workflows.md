# Workflows Quick Reference

Common development workflows using Codex Control MCP.

---

## Workflow Categories

1. **Analysis Workflows** - Code review, security audits, refactoring planning
2. **Development Workflows** - Iterative development, feature implementation
3. **Testing Workflows** - Test execution, failure debugging, coverage
4. **Cloud Workflows** - Long-running tasks, background processing
5. **GitHub Workflows** - PR creation, automated fixes, CI integration

---

## 1. Analysis Workflows

### Quick Code Review

**Goal**: Analyze code for bugs, security issues, or improvements.

**Steps**:
```
1. Use codex_run with read-only mode
   → Fast, no file changes

2. Review output for issues
   → Categorize by severity

3. If changes needed:
   → Use codex_plan to preview
   → Use codex_apply to implement
```

**Example**:
```typescript
// Step 1: Analyze
{
  "task": "Review src/api.ts for security vulnerabilities, performance issues, and code quality problems",
  "mode": "read-only"
}

// Step 2: If issues found, preview fixes
{
  "task": "Fix the security vulnerabilities identified in previous analysis",
  "mode": "preview"
}

// Step 3: Apply with confirmation
{
  "task": "Fix the security vulnerabilities identified in previous analysis",
  "confirm": true,
  "mode": "workspace-write"
}
```

**Use Cases**:
- Pre-commit code review
- Security audit
- Performance analysis
- Technical debt assessment

---

### Comprehensive Refactoring Planning

**Goal**: Plan large-scale refactoring with detailed analysis.

**Steps**:
```
1. Use codex_local_exec (read-only)
   → Get detailed analysis with thread persistence

2. Ask follow-up questions via codex_local_resume
   → Clarify approach, explore alternatives

3. Create implementation plan
   → Document steps, dependencies

4. Execute incrementally
   → Use codex_local_resume for each step
```

**Example**:
```typescript
// Step 1: Initial analysis
{
  "task": "Analyze the authentication system across all files and identify opportunities for refactoring to improve security and maintainability",
  "mode": "read-only"
}
// Returns: thread_abc123xyz

// Step 2: Follow-up questions
{
  "threadId": "thread_abc123xyz",
  "task": "What would be the risks and benefits of switching from JWT to session-based auth?"
}

// Step 3: Create plan
{
  "threadId": "thread_abc123xyz",
  "task": "Create a detailed step-by-step migration plan with rollback strategy"
}

// Step 4: Execute (later, in feature branch)
{
  "threadId": "thread_abc123xyz",
  "task": "Implement step 1 of the migration plan: Update auth middleware",
  "mode": "workspace-write"
}
```

**Benefits**:
- ✅ Thread persistence preserves context
- ✅ High cache rates (45-93%) save costs
- ✅ Iterative exploration before commitment

---

## 2. Development Workflows

### Feature Development (Iterative)

**Goal**: Build new feature with test-driven approach.

**Steps**:
```
1. codex_local_exec (read-only)
   → Analyze existing code, plan approach

2. codex_local_resume
   → Write tests first (TDD)

3. codex_local_resume (workspace-write in feature branch)
   → Implement feature to pass tests

4. codex_local_resume
   → Refactor and optimize

5. Review and commit
```

**Example**:
```typescript
// Step 1: Analysis
{
  "task": "Analyze how file uploads are currently handled and plan a new drag-and-drop upload feature",
  "mode": "read-only"
}
// Returns: thread_abc123xyz

// Step 2: Write tests
{
  "threadId": "thread_abc123xyz",
  "task": "Create comprehensive test cases for drag-and-drop file upload",
  "mode": "workspace-write"
}

// Step 3: Implement feature
{
  "threadId": "thread_abc123xyz",
  "task": "Implement the drag-and-drop upload feature to pass all tests",
  "mode": "workspace-write"
}

// Step 4: Refine
{
  "threadId": "thread_abc123xyz",
  "task": "Add progress indicators and error handling for edge cases",
  "mode": "workspace-write"
}
```

**Best Practices**:
- ✅ Use feature branches (not main)
- ✅ Write tests first
- ✅ Leverage thread persistence
- ✅ Commit after each successful step

---

### Bug Fixing (Root Cause Analysis)

**Goal**: Debug issue, find root cause, apply minimal fix.

**Steps**:
```
1. codex_local_exec (read-only)
   → Reproduce bug, analyze symptoms

2. codex_local_resume
   → Trace code paths, identify root cause

3. codex_local_resume
   → Propose minimal fix

4. codex_local_resume (workspace-write)
   → Apply fix and verify
```

**Example**:
```typescript
// Step 1: Reproduce and analyze
{
  "task": "Investigate why users report 'null pointer exception' when uploading files larger than 10MB. Reproduce the issue and analyze the code path.",
  "mode": "read-only"
}
// Returns: thread_abc123xyz

// Step 2: Root cause analysis
{
  "threadId": "thread_abc123xyz",
  "task": "What is the exact root cause of the null pointer exception?"
}

// Step 3: Propose fix
{
  "threadId": "thread_abc123xyz",
  "task": "Propose the minimal code change to fix this issue"
}

// Step 4: Apply fix
{
  "threadId": "thread_abc123xyz",
  "task": "Apply the fix and add a test case to prevent regression",
  "mode": "workspace-write"
}
```

**Benefits**:
- ✅ Systematic debugging approach
- ✅ Context preserved across steps
- ✅ Minimal, targeted fixes

---

## 3. Testing Workflows

### Run Tests and Fix Failures

**Goal**: Execute test suite, identify failures, apply fixes.

**Steps**:
```
1. codex_run (read-only)
   → Run test suite, capture failures

2. If failures < 5:
   → Use codex_local_exec (workspace-write)
   → Fix each failure iteratively

3. If failures > 5:
   → Use codex_cloud_submit
   → Background execution
```

**Example (Few Failures)**:
```typescript
// Step 1: Run tests
{
  "task": "Run the full test suite and report all failures",
  "mode": "read-only"
}

// Step 2: Fix iteratively
{
  "task": "Fix the 3 failing tests in utils.test.ts",
  "mode": "workspace-write"
}
```

**Example (Many Failures)**:
```typescript
// Use Cloud for long-running task
{
  "task": "Run the full test suite, fix all failures, and create a PR with fixes",
  "envId": "env_myproject",
  "attempts": 3
}
```

---

### Test Coverage Analysis

**Goal**: Identify untested code and add coverage.

**Steps**:
```
1. codex_local_exec (read-only)
   → Run coverage tool, identify gaps

2. codex_local_resume (workspace-write)
   → Add tests for uncovered code

3. codex_local_resume
   → Verify coverage improved
```

**Example**:
```typescript
// Step 1: Coverage analysis
{
  "task": "Run test coverage and identify functions with less than 80% coverage",
  "mode": "read-only",
  "outputSchema": {
    "type": "object",
    "properties": {
      "uncovered": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "file": { "type": "string" },
            "function": { "type": "string" },
            "coverage": { "type": "number" }
          }
        }
      }
    }
  }
}
// Returns: thread_abc123xyz + structured list

// Step 2: Add tests
{
  "threadId": "thread_abc123xyz",
  "task": "Add comprehensive tests for the 5 functions with lowest coverage",
  "mode": "workspace-write"
}
```

---

## 4. Cloud Workflows

### Long-Running Test Suite

**Goal**: Run comprehensive tests in background.

**Steps**:
```
1. codex_cloud_submit
   → Submit task to Codex Cloud

2. Continue working locally
   → Task runs independently

3. codex_cloud_check_reminder
   → Check pending tasks periodically

4. codex_cloud_results
   → Review results when complete
```

**Example**:
```typescript
// Step 1: Submit
{
  "task": "Run the full integration test suite against all supported databases (PostgreSQL, MySQL, MongoDB). Fix any failures and create a detailed report.",
  "envId": "env_myproject",
  "attempts": 2,
  "model": "gpt-4o"
}
// Returns: task-2025-11-12-abc123

// Step 2: Work on other tasks...

// Step 3: Check status (later)
{} // codex_cloud_check_reminder
// Shows: Task still running (45 minutes elapsed)

// Step 4: Get results (when complete)
{
  "taskId": "task-2025-11-12-abc123"
}
```

---

### Overnight Refactoring

**Goal**: Large-scale refactoring that takes hours.

**Steps**:
```
1. Setup GitHub environment
   → Use codex_github_setup_guide

2. codex_cloud_submit (before bed)
   → Submit comprehensive refactoring task

3. Morning: codex_cloud_check_reminder
   → Check task completion

4. codex_cloud_results
   → Review PR created by Codex
```

**Example**:
```typescript
// Evening: Submit task
{
  "task": "Migrate all class components to functional components with hooks. Ensure all tests pass. Create PR titled 'Migrate to Hooks'.",
  "envId": "env_myproject",
  "model": "o3-mini",
  "attempts": 3
}

// Morning: Check status
{} // codex_cloud_check_reminder
// Shows: Task completed 2 hours ago

// Review PR on GitHub
// Merge if tests pass
```

---

## 5. GitHub Workflows

### Autonomous PR Creation

**Goal**: Complete feature development with automated PR.

**Prerequisites**:
```
1. GitHub environment configured
   → Use codex_github_setup_guide

2. Environment templates loaded
   → See .github-node-typescript, .github-python, etc.
```

**Workflow**:
```typescript
// Submit complete feature task
{
  "task": "Create feature branch 'feature/oauth-login', implement OAuth2 login flow with Google and GitHub providers, add comprehensive tests, ensure all existing tests pass, create PR titled 'Add OAuth2 Login' with detailed description.",
  "envId": "env_myproject",
  "model": "gpt-4o"
}

// Codex Cloud will:
// 1. Create feature branch
// 2. Implement OAuth2 login
// 3. Add tests
// 4. Run test suite
// 5. Create PR with description
// 6. You review and merge
```

**Task Description Best Practices**:
- ✅ Specify branch name explicitly
- ✅ Include testing requirements
- ✅ Specify PR title and description needs
- ✅ List acceptance criteria

---

### Automated Bug Fixes

**Goal**: Fix GitHub issues automatically.

**Workflow**:
```typescript
// Fix specific GitHub issue
{
  "task": "Fix GitHub issue #142: 'File upload fails for files >10MB'. Create feature branch 'fix/issue-142', implement fix with tests, create PR referencing issue.",
  "envId": "env_myproject"
}

// Codex Cloud will:
// 1. Read issue details via gh CLI
// 2. Reproduce bug
// 3. Implement fix
// 4. Add regression test
// 5. Create PR with issue reference
```

---

### CI Integration

**Goal**: Run Codex tasks in GitHub Actions.

**Setup** (`.github/workflows/codex-review.yml`):
```yaml
name: Codex Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  codex-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Codex Review
        run: |
          # Submit review task to Codex Cloud
          # Use codex_cloud_submit via API

          # Wait for completion
          # Use codex_cloud_status to poll

          # Add PR comment with results
          # Use codex_cloud_results + gh CLI
```

---

## Workflow Selection Matrix

| Scenario | Tool Chain | Duration | Persistence |
|----------|-----------|----------|-------------|
| **Quick analysis** | `codex_run` | 1-5 min | ❌ No |
| **Iterative dev** | `codex_local_exec` + `resume` | 5-30 min | ✅ Thread |
| **Long refactoring** | `codex_cloud_submit` | 30+ min | ✅ Task |
| **Preview changes** | `codex_plan` → `codex_apply` | 2-10 min | ❌ No |
| **Multi-step debugging** | `codex_local_exec` + `resume` | 10-20 min | ✅ Thread |
| **GitHub PR** | `codex_cloud_submit` | 20-60 min | ✅ Task |

---

## Best Practices Across Workflows

### Before Starting
- ✅ Check git status (clean working directory)
- ✅ Create feature branch (not main)
- ✅ Review existing code structure
- ✅ Define clear success criteria

### During Execution
- ✅ Use descriptive task descriptions
- ✅ Leverage thread persistence for multi-step tasks
- ✅ Monitor token usage (local SDK tools)
- ✅ Check intermediate results

### After Completion
- ✅ Review all changes (`git diff`)
- ✅ Run tests locally
- ✅ Verify no secrets committed
- ✅ Create meaningful commit messages
- ✅ Update documentation if needed

### Error Recovery
- ✅ Use `codex_local_resume` to continue from failure
- ✅ Review error messages carefully
- ✅ Check `codex_status` for queue issues
- ✅ Use `codex_cloud_check_reminder` for pending tasks

---

## Repository CI/CD (v3.2.2+)

**Fully automated pipeline** - No manual versioning or publishing required.

### Automated on Every PR
- Multi-platform testing (Node 20.x/22.x on Ubuntu/macOS/Windows)
- Lint, type check, coverage, security audit
- CodeQL security scanning

### Automated on Main Commits
- **semantic-release** determines version from conventional commits:
  - `fix:` → Patch (3.2.x)
  - `feat:` → Minor (3.x.0)
  - `feat!:` or `BREAKING CHANGE:` → Major (x.0.0)
- Auto-publish to npm with provenance
- Generate CHANGELOG.md
- Create GitHub releases

### Continuous Security
- Weekly CodeQL scans
- Dependabot dependency updates
- Secret scanning with push protection
- npm audit on every CI run

**See**: `docs/CI-CD-SECURITY-PLAN.md`, `docs/GITHUB-SETTINGS.md`
