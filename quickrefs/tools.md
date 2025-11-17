# Tools Quick Reference (v3.0.1)

Complete guide to Codex Control MCP's 15 hidden primitives.

---

## How It Works

**Pattern**: Users describe tasks naturally → Claude Code's NLP selects appropriate primitive → Results returned

### Architecture

**15 Hidden Primitives** (all prefixed with `_`):
- Not directly exposed to users
- Claude Code's native NLP selects the right one
- Similar to zen MCP pattern

**User Experience**:
```
User: "Use codex control to run tests"
  ↓
Claude Code analyzes intent
  ↓
Selects: _codex_local_run
  ↓
Executes and returns results
```

**No Need to Choose**:
- ❌ Don't manually select from 15 primitives
- ✅ Just describe what you want naturally

---

## Usage Examples

### Local Execution (Quick Tasks)

```
User: "Use codex control to run tests"
→ Claude Code selects: _codex_local_run

User: "Use codex control to analyze code for bugs"
→ Claude Code selects: _codex_local_run

User: "Use codex control to fix the error in utils.ts"
→ Claude Code selects: _codex_local_run (workspace-write mode)
```

### Threading (Iterative Development)

```
User: "Use codex control to analyze code with real-time progress"
→ Claude Code selects: _codex_local_exec

User: "Use codex control to start a task with progress updates"
→ Claude Code selects: _codex_local_exec (returns thread ID)

User: "Use codex control to debug this issue step by step"
→ Claude Code selects: _codex_local_exec (thread persistence)
```

### Cloud Execution (Long-Running)

```
User: "Use codex control to run tests in the cloud"
→ Claude Code selects: _codex_cloud_submit

User: "Use codex control to run comprehensive test suite on cloud"
→ Claude Code selects: _codex_cloud_submit

User: "Use codex control to create feature branch and PR in cloud"
→ Claude Code selects: _codex_cloud_submit
```

### Task Management

```
User: "Use codex control to check status of T-local-abc123"
→ Claude Code selects: _codex_local_status

User: "Use codex control to wait for T-cloud-xyz789"
→ Claude Code selects: _codex_cloud_wait

User: "Use codex control to cancel T-local-def456"
→ Claude Code selects: _codex_local_cancel

User: "Use codex control to get results for T-cloud-ghi012"
→ Claude Code selects: _codex_cloud_results
```

### Configuration & Maintenance

```
User: "Use codex control to list environments"
→ Claude Code selects: _codex_cloud_list_environments

User: "Use codex control to show available environments"
→ Claude Code selects: _codex_cloud_list_environments

User: "Use codex control to setup GitHub for https://github.com/myorg/repo"
→ Claude Code selects: _codex_cloud_github_setup

User: "Use codex control to clean up stuck tasks"
→ Claude Code selects: _codex_cleanup_registry

User: "Use codex control to preview cleanup of old tasks"
→ Claude Code selects: _codex_cleanup_registry (with dryRun: true)
```

---

## When to Use Each Pattern

### Quick Analysis (1-5 minutes)
**Pattern**: Simple action verbs
```
"run tests"
"analyze code"
"check for bugs"
```
**Routes to**: Local execution (one-shot)

### Iterative Development (5-30 minutes)
**Pattern**: Include progress/threading keywords
```
"analyze with progress"
"debug step by step"
"investigate with real-time updates"
```
**Routes to**: Local SDK (threaded)

### Long-Running Tasks (30+ minutes)
**Pattern**: Include cloud context
```
"run tests in the cloud"
"comprehensive refactoring on cloud"
"create PR via cloud"
```
**Routes to**: Cloud submission

### Task Operations
**Pattern**: Action + Task ID
```
"check status of T-local-abc123"
"wait for T-cloud-xyz789"
"cancel T-local-def456"
```
**Routes to**: Appropriate task operation

---

## Hidden Implementation (15 Primitives)

These primitives are automatically selected by Claude Code's NLP. Users don't call them directly.

### Local Execution (7 tools)
- `_codex_local_run` - Simple one-shot execution
- `_codex_local_exec` - SDK execution with threading
- `_codex_local_resume` - Resume threaded conversations
- `_codex_local_status` - Process and task status
- `_codex_local_results` - Get task results
- `_codex_local_wait` - Wait for task completion
- `_codex_local_cancel` - Cancel running tasks

### Cloud Execution (5 tools)
- `_codex_cloud_submit` - Background task submission
- `_codex_cloud_status` - Cloud task status
- `_codex_cloud_results` - Retrieve cloud results
- `_codex_cloud_wait` - Wait for cloud completion
- `_codex_cloud_cancel` - Cancel cloud tasks

### Configuration & Maintenance (3 tools)
- `_codex_cloud_list_environments` - List environments
- `_codex_cloud_github_setup` - GitHub integration guide
- `_codex_cleanup_registry` - Clean up stuck and old tasks

---

## Common Workflows

### Workflow 1: Quick Analysis
```typescript
// Single request, automatic routing
{ "request": "run tests" }
```

### Workflow 2: Iterative Development
```typescript
// Step 1: Start with progress
{ "request": "analyze code with progress" }
// Returns: { "thread_id": "thread_abc123", ... }

// Step 2: Continue (manual resume)
// Use _codex_local_resume with thread ID
```

### Workflow 3: Cloud Task
```typescript
// Step 1: Submit
{ "request": "run comprehensive tests in the cloud" }
// Returns: { "task_id": "T-cloud-abc123", ... }

// Step 2: Check status
{ "request": "check status of T-cloud-abc123" }

// Step 3: Get results
{ "request": "get results for T-cloud-abc123" }
```

---

## Best Practices

### Natural Language Tips
- ✅ Be specific: "run unit tests" vs "run tests"
- ✅ Include context: "in the cloud", "with progress"
- ✅ Use task IDs when available: "check T-local-abc123"

### Execution Mode Selection
- ✅ Quick tasks (< 5 min): Default (no keywords)
- ✅ Iterative work: Add "with progress" or "step by step"
- ✅ Long tasks (> 30 min): Add "in the cloud"

### Error Handling
- ✅ Be specific in your natural language requests
- ✅ Task IDs must be valid format (T-local-* or T-cloud-*)
- ✅ Include enough context for Claude Code to select the right primitive

---

## Testing & Validation

**v3.0.1 Status**:
- ✅ All 15 primitives working and verified
- ✅ npm package published (@littlebearapps/mcp-delegator)
- ✅ Async workflow validated
- ✅ Parameter bug fix confirmed (_codex_local_results)
- ✅ Production deployment verified

**v3.0.0 (Unified Tool - Removed)**:
- Core E2E: 14/14 tests (100%)
- Natural Language: 51/51 tests (100%)
- Error Cases: 26/26 tests (100%)
- Unified tool removed in v3.0.1 due to intermittent hanging issues

See `ASYNC-COMPREHENSIVE-TEST-RESULTS.md` for latest validation.

---

## Evolution

### v3.0.1 (Current)
```
User: "Use codex control to run tests"
  ↓
Claude Code's NLP selects primitive
  ↓
_codex_local_run executes
```

**Pattern**: Natural language → Claude Code selects → Primitive executes

### v3.0.0 (Removed)
```
{ "request": "run tests" }
  ↓
Unified tool routes
  ↓
Primitive executes
```

**Issue**: Intermittent hanging, removed unified tool in v3.0.1

### v2.x (Legacy)
```typescript
codex_run({ task: "run tests", mode: "read-only" })
codex_local_exec({ task: "analyze" })
codex_cloud_submit({ task: "run tests", envId: "env_123" })
```

**Issue**: Had to manually select from 13 tools
