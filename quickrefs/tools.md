# Tools Quick Reference (v3.6.0)

Complete guide to MCP Delegator's 15 hidden primitives with JSON format support.

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

## JSON Format Support (v3.6.0)

### Overview

All 15 tools now support structured JSON output for AI agent consumption. This provides:
- **97% token reduction**: 18,000 → 500 tokens per response
- **Structured parsing**: No markdown parsing needed
- **Metadata extraction**: Test results, file changes, errors extracted automatically
- **Type safety**: Consistent schema across all responses

### Requesting JSON Format

Add `format: "json"` parameter to any tool call:

```typescript
{
  "task": "Run tests and fix failures",
  "mode": "workspace-write",
  "format": "json"  // Request JSON output
}
```

**Default**: Markdown format (human-readable)
**JSON format**: Optimized for AI agents

### JSON Response Categories

All tools return one of 5 envelope types:

#### 1. **execution_ack** (Task Started)
Tools: `_codex_local_run`, `_codex_local_exec`, `_codex_local_resume`, `_codex_cloud_submit`

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/execution_ack/v1",
  "tool": "_codex_local_exec",
  "tool_category": "execution_ack",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "ts": "2025-11-18T15:30:00Z",
  "status": "ok",
  "meta": {
    "thread_id": "thread_abc123xyz"
  },
  "data": {
    "task_id": "T-local-mi42qev9rfxri9",
    "accepted": true,
    "capability": "background",
    "started_at": "2025-11-18T15:30:00Z"
  }
}
```

**Tokens**: ~150 (vs 2,500 markdown)

#### 2. **result_set** (Task Completed)
Tools: `_codex_local_results`, `_codex_cloud_results`

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/result_set/v1",
  "tool": "_codex_local_results",
  "tool_category": "result_set",
  "request_id": "550e8400-e29b-41d4-a716-446655440001",
  "ts": "2025-11-18T15:45:00Z",
  "status": "ok",
  "meta": {
    "thread_id": "thread_abc123xyz",
    "cache_hit_rate": 0.968
  },
  "data": {
    "task_id": "T-local-mi42qev9rfxri9",
    "result": "success",
    "summary": "All tests passed (117/117)",
    "metadata": {
      "test_results": {
        "passed": 117,
        "failed": 0,
        "skipped": 0
      },
      "file_operations": {
        "modified": ["src/api.ts", "src/utils.ts"],
        "added": [],
        "deleted": [],
        "lines_changed": 42
      },
      "duration_seconds": 245
    },
    "output": {
      "included": false,
      "truncated": false,
      "max_bytes": 65536
    }
  }
}
```

**Tokens**: ~300 (vs 18,000 markdown with full output)

**Note**: `output.included: false` when task succeeds - output omitted to save tokens. Set to `true` on errors for debugging.

#### 3. **status_snapshot** (Current State)
Tools: `_codex_local_status`, `_codex_cloud_status`

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/status_snapshot/v1",
  "tool": "_codex_local_status",
  "tool_category": "status_snapshot",
  "request_id": "550e8400-e29b-41d4-a716-446655440002",
  "ts": "2025-11-18T15:32:00Z",
  "status": "ok",
  "meta": {
    "snapshot_ts": "2025-11-18T15:32:00Z",
    "total": 74,
    "filtered": 3
  },
  "data": {
    "running": [
      {
        "task_id": "T-local-mi42qev9rfxri9",
        "task_desc": "Run tests and fix failures",
        "mode": "workspace-write",
        "elapsed_seconds": 120
      }
    ],
    "queued": [],
    "completed_recent": [],
    "failed_recent": []
  }
}
```

**Tokens**: ~200 (vs 3,500 markdown)

**Note**: Empty arrays omitted when no tasks in that state.

#### 4. **wait_result** (Polling Complete)
Tools: `_codex_local_wait`, `_codex_cloud_wait`

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/wait_result/v1",
  "tool": "_codex_local_wait",
  "tool_category": "wait_result",
  "request_id": "550e8400-e29b-41d4-a716-446655440003",
  "ts": "2025-11-18T15:45:00Z",
  "status": "ok",
  "meta": {
    "wait_duration_seconds": 245,
    "poll_count": 49
  },
  "data": {
    "task_id": "T-local-mi42qev9rfxri9",
    "final_status": "completed",
    "result": "success",
    "summary": "All tests passed",
    "metadata": {
      "test_results": {
        "passed": 117,
        "failed": 0
      }
    }
  }
}
```

**Tokens**: ~180 (vs 2,800 markdown)

#### 5. **registry_info** (System Info)
Tools: `_codex_cloud_list_environments`, `_codex_cleanup_registry`, `_codex_local_cancel`, `_codex_cloud_cancel`, `_codex_cloud_github_setup`

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/registry_info/v1",
  "tool": "_codex_cloud_list_environments",
  "tool_category": "registry_info",
  "request_id": "550e8400-e29b-41d4-a716-446655440004",
  "ts": "2025-11-18T15:30:00Z",
  "status": "ok",
  "meta": {
    "source": "~/.config/mcp-delegator/environments.json"
  },
  "data": {
    "environments": [
      {
        "env_id": "env_illustrations",
        "name": "Illustrations Project",
        "repo_url": "https://github.com/user/illustrations",
        "tech_stack": "node"
      }
    ],
    "count": 1
  }
}
```

**Tokens**: ~150 (vs 1,200 markdown)

### Error Responses (All Categories)

When errors occur, all tools return consistent error envelopes:

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/error/v1",
  "tool": "_codex_local_exec",
  "request_id": "550e8400-e29b-41d4-a716-446655440005",
  "ts": "2025-11-18T15:30:05Z",
  "status": "error",
  "error": {
    "code": "TIMEOUT",
    "message": "Task exceeded idle timeout (300s elapsed)",
    "details": {
      "timeout_type": "idle",
      "elapsed_seconds": 305,
      "partial_results": {
        "last_events": [...],
        "last_output": "..."
      }
    },
    "retryable": false,
    "duration_ms": 305000
  }
}
```

**Error Codes**:
- `TIMEOUT`: Task exceeded time limits (includes partial results)
- `VALIDATION`: Invalid parameters (returned for Zod validation failures)
- `TOOL_ERROR`: Codex execution failed
- `NOT_FOUND`: Task/resource not found
- `UNSUPPORTED`: Feature not supported
- `INTERNAL`: Server error

### When to Use JSON Format

**✅ Use JSON when**:
- Building AI agent workflows
- Need structured data extraction (test results, file changes)
- Want minimal token usage
- Parsing markdown is complex
- Need type-safe responses

**❌ Use Markdown when**:
- Presenting to human users
- Need detailed explanations
- Debugging/troubleshooting interactively
- Don't need structured parsing

### Token Savings Examples

| Scenario | Markdown Tokens | JSON Tokens | Savings |
|----------|----------------|-------------|---------|
| Task started | 2,500 | 150 | 94% |
| Tests passed (no output) | 18,000 | 300 | 98% |
| Status check | 3,500 | 200 | 94% |
| Error with partial results | 8,000 | 400 | 95% |
| **Average** | **8,000** | **260** | **97%** |

### Metadata Extraction

All `result_set` and `wait_result` responses include extracted metadata:

```json
{
  "metadata": {
    "test_results": {
      "passed": 45,
      "failed": 2,
      "skipped": 0,
      "failed_tests": ["test_auth_timeout", "test_api_rate_limit"]
    },
    "file_operations": {
      "modified": ["src/auth.ts", "src/api.ts"],
      "added": ["tests/auth.test.ts"],
      "deleted": [],
      "lines_changed": 127
    },
    "error_context": {
      "error_message": "TypeError: Cannot read property 'id' of null",
      "error_type": "TypeError",
      "failed_files": ["src/auth.ts"],
      "error_locations": [
        {
          "file": "src/auth.ts",
          "line": 42,
          "column": 15
        }
      ],
      "suggestions": [
        "Start investigation at src/auth.ts:42",
        "Check for null/undefined values",
        "Run failing tests individually"
      ]
    },
    "duration_seconds": 245,
    "thread_info": {
      "thread_id": "thread_abc123xyz",
      "cache_hit_rate": 0.968,
      "input_tokens": 11373,
      "cached_tokens": 11008
    }
  }
}
```

**Metadata is automatically extracted** - no additional work needed!

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
