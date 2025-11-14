# Tools Quick Reference (v3.0.0)

Complete guide to the unified Codex Control MCP interface.

---

## Unified Natural Language Interface

### Primary Tool

**`codex`** - Single tool accepting natural language instructions

**How It Works**:
1. Describe what you want in natural language
2. Router automatically detects intent and execution mode
3. Appropriate backend primitive is invoked
4. Result returned with automatic routing details

**No Need to Choose**:
- ❌ Don't pick from 14 separate tools
- ✅ Just describe what you want naturally

---

## Natural Language Examples

### Local Execution (Quick Tasks)

```typescript
// Simple analysis
{ "request": "run tests" }
// → Routes to _codex_local_run (read-only)

{ "request": "analyze code for bugs" }
// → Routes to _codex_local_run (read-only)

{ "request": "fix the error in utils.ts" }
// → Routes to _codex_local_run (workspace-write)
```

### Threading (Iterative Development)

```typescript
// Real-time progress
{ "request": "analyze code with progress" }
// → Routes to _codex_local_exec (streaming)

{ "request": "start new task with progress updates" }
// → Routes to _codex_local_exec (returns thread ID)

{ "request": "debug this issue step by step" }
// → Routes to _codex_local_exec (thread persistence)
```

### Cloud Execution (Long-Running)

```typescript
// Cloud submission
{ "request": "run tests in the cloud" }
// → Routes to _codex_cloud_submit

{ "request": "run comprehensive test suite on cloud" }
// → Routes to _codex_cloud_submit

{ "request": "create feature branch and PR in cloud" }
// → Routes to _codex_cloud_submit
```

### Task Management

```typescript
// Check status
{ "request": "check status of T-local-abc123" }
// → Routes to _codex_local_status

{ "request": "wait for T-cloud-xyz789" }
// → Routes to _codex_cloud_wait

{ "request": "cancel T-local-def456" }
// → Routes to _codex_local_cancel

{ "request": "get results for T-cloud-ghi012" }
// → Routes to _codex_cloud_results
```

### Configuration

```typescript
// List environments
{ "request": "list environments" }
// → Routes to _codex_cloud_list_environments

{ "request": "show available environments" }
// → Routes to _codex_cloud_list_environments

// GitHub setup
{ "request": "setup github for https://github.com/myorg/repo" }
// → Routes to _codex_cloud_github_setup
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

## Smart Routing Features

### Automatic Mode Detection

**Local vs Cloud**:
- "run tests" → Local
- "run tests in the cloud" → Cloud
- "run tests on cloud" → Cloud

**Threading vs One-Shot**:
- "analyze code" → One-shot
- "analyze code with progress" → Threading
- "debug step by step" → Threading

**Task ID Extraction**:
- "check T-local-abc123" → Extracts task ID automatically
- "wait for cloud task T-cloud-xyz789" → Extracts and routes to cloud

---

## Advanced Parameters

### Context and Preferences

```typescript
{
  "request": "run tests in the cloud",
  "context": {
    "working_dir": "/path/to/project",
    "repo_root": "/path/to/repo"
  },
  "preference": {
    "mode": "cloud",  // Force cloud execution
    "timeout_ms": 300000
  }
}
```

### Structured Hints (Fast-Path)

```typescript
{
  "request": "check my task",
  "hints": {
    "operation": "check",       // Bypass natural language parsing
    "taskId": "T-local-abc123", // Explicit task ID
    "mode": "local"             // Explicit mode
  }
}
```

### Debugging

```typescript
{
  "request": "run tests",
  "dry_run": true,   // Show routing decision without executing
  "explain": true    // Include decision trace
}
```

---

## Hidden Implementation (14 Primitives)

These primitives are automatically invoked by the router. You don't need to call them directly.

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

### Configuration (2 tools)
- `_codex_cloud_list_environments` - List environments
- `_codex_cloud_github_setup` - GitHub integration guide

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
- ✅ Use `dry_run: true` to preview routing
- ✅ Check task IDs are valid format (T-local-* or T-cloud-*)
- ✅ Include enough context in natural language

---

## Testing & Validation

**v3.0.0 Test Results**:
- Core E2E: 14/14 tests (100%)
- Natural Language: 51/51 tests (100%)
- Error Cases: 26/26 tests (100%)
- **Total: 91/91 tests (100%)**

See `WEEK-5-COMPLETION-SUMMARY.md` for comprehensive test documentation.

---

## Migration from v2.x

### Before (v2.x - 13 separate tools)
```typescript
// Had to choose the right tool manually
codex_run({ task: "run tests", mode: "read-only" })
codex_local_exec({ task: "analyze", mode: "read-only" })
codex_cloud_submit({ task: "run tests", envId: "env_123" })
```

### After (v3.0.0 - unified interface)
```typescript
// Just describe what you want
{ "request": "run tests" }
{ "request": "analyze with progress" }
{ "request": "run tests in the cloud" }
```

**Backward Compatibility**: Hidden primitives still available for advanced use cases.
