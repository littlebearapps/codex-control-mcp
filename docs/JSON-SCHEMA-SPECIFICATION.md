# JSON Schema Specification - MCP Delegator v3.6

## Structured Response Formats for AI Agent Consumption

**Version**: 3.6.0
**Status**: Draft
**Last Updated**: 2025-11-18

---

## Overview

This document defines the JSON response schemas for all 15 MCP Delegator tools when `format: "json"` is requested. The design prioritizes:

1. **Consistency**: Common envelope structure across all tools
2. **Parsability**: Machine-readable, predictable schemas
3. **Token Efficiency**: Conditional output, smart truncation
4. **Category Separation**: 5 distinct tool categories with specific schemas
5. **Error Handling**: Structured error responses including timeouts

---

## Common Envelope Structure

All tools return this base structure when `format: "json"`:

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/{category}/v1",
  "tool": "tool_name",
  "tool_category": "execution_ack|wait_result|status_snapshot|result_set|registry_info",
  "request_id": "uuid-generated-by-server",
  "ts": "2025-11-18T10:05:22Z",
  "status": "ok|error",
  "meta": {
    /* category-specific metadata */
  },
  "data": {
    /* category-specific payload */
  },
  "error": {
    /* present only when status=error */
  }
}
```

### Envelope Fields

| Field           | Type   | Required    | Description                                                    |
| --------------- | ------ | ----------- | -------------------------------------------------------------- |
| `version`       | string | Yes         | MCP Delegator version (e.g., "3.6")                            |
| `schema_id`     | string | Yes         | Stable schema identifier (e.g., "codex/v3.6/execution_ack/v1") |
| `tool`          | string | Yes         | Tool name that generated response                              |
| `tool_category` | string | Yes         | One of 5 categories                                            |
| `request_id`    | string | Yes         | UUID for request tracking                                      |
| `ts`            | string | Yes         | ISO-8601 timestamp                                             |
| `status`        | string | Yes         | "ok" or "error"                                                |
| `meta`          | object | Yes         | Category-specific metadata (small, scalar values)              |
| `data`          | object | Conditional | Category-specific payload (omitted if status=error)            |
| `error`         | object | Conditional | Error details (present only if status=error)                   |

---

## Error Object Structure

Used across all categories when `status: "error"`:

```json
{
  "error": {
    "code": "TIMEOUT|VALIDATION|TOOL_ERROR|NOT_FOUND|UNSUPPORTED|INTERNAL",
    "message": "Human-readable error description",
    "details": {
      "exit_code": 1,
      "stderr_tail": "last 1000 chars of stderr",
      "file": "path/to/file",
      "line": 42,
      "column": 15
    },
    "retryable": true,
    "duration_ms": 5432
  }
}
```

### Error Codes

| Code          | Description                | Retryable | Use Case                                 |
| ------------- | -------------------------- | --------- | ---------------------------------------- |
| `TIMEOUT`     | Task exceeded time limit   | Maybe     | Idle timeout (5m) or hard timeout (20m)  |
| `VALIDATION`  | Invalid input parameters   | No        | Bad task description, invalid mode, etc. |
| `TOOL_ERROR`  | Codex CLI execution failed | Maybe     | Exit code 1, process crash               |
| `NOT_FOUND`   | Resource not found         | No        | Task ID doesn't exist, thread not found  |
| `UNSUPPORTED` | Feature not available      | No        | Background execution on Windows          |
| `INTERNAL`    | Server-side error          | Yes       | Unexpected exceptions                    |

### Timeout Error (Special Case)

When TimeoutWatchdog (v3.2.1) triggers:

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/execution_ack/v1",
  "tool": "_codex_local_exec",
  "tool_category": "execution_ack",
  "request_id": "uuid",
  "ts": "2025-11-18T10:10:22Z",
  "status": "error",
  "meta": {},
  "error": {
    "code": "TIMEOUT",
    "message": "Task exceeded idle timeout (5 minutes with no output)",
    "details": {
      "timeout_type": "idle",
      "elapsed_seconds": 305,
      "partial_results": {
        "last_events": [
          { "type": "turn.started", "turnId": "turn_001" },
          { "type": "item.completed", "itemId": "item_001" }
        ],
        "last_output": "Last 64KB of stdout/stderr..."
      }
    },
    "retryable": false,
    "duration_ms": 305000
  }
}
```

---

## Tool Categories & Schemas

### Category 1: Execution Acknowledgment (4 tools)

**Tools**: `_codex_local_run`, `_codex_local_exec`, `_codex_local_resume`, `_codex_cloud_submit`

**Purpose**: Async task submission, returns task ID immediately

**Schema ID**: `codex/v3.6/execution_ack/v1`

#### Success Response

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/execution_ack/v1",
  "tool": "_codex_local_exec",
  "tool_category": "execution_ack",
  "request_id": "f2a3b4c5-...",
  "ts": "2025-11-18T10:05:22Z",
  "status": "ok",
  "meta": {
    "queue_position": 2,
    "estimated_start_ms": 5000
  },
  "data": {
    "task_id": "T-local-abc123",
    "thread_id": "thread_xyz789",
    "accepted": true,
    "capability": "background",
    "expected_duration": "5-10 minutes",
    "started_at": "2025-11-18T10:05:22Z"
  }
}
```

#### Fields

| Field                     | Type    | Required | Description                         |
| ------------------------- | ------- | -------- | ----------------------------------- |
| `meta.queue_position`     | integer | No       | Position in queue (0 = running now) |
| `meta.estimated_start_ms` | integer | No       | Estimated milliseconds until start  |
| `data.task_id`            | string  | Yes      | Unique task identifier              |
| `data.thread_id`          | string  | No       | Thread ID (SDK executions only)     |
| `data.accepted`           | boolean | Yes      | Task accepted for execution         |
| `data.capability`         | string  | Yes      | "background" or "foreground"        |
| `data.expected_duration`  | string  | No       | Human-readable estimate             |
| `data.started_at`         | string  | Yes      | ISO-8601 start timestamp            |

#### Notes

- No stdout/stderr in acknowledgment (use results tools)
- For `_codex_local_run`: May include `thread_id` if SDK used internally
- For cloud: `capability: "background"` always

---

### Category 2: Wait Result (2 tools)

**Tools**: `_codex_local_wait`, `_codex_cloud_wait`

**Purpose**: Block until completion, return full results (like results tools)

**Schema ID**: `codex/v3.6/wait_result/v1`

#### Success Response

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/wait_result/v1",
  "tool": "_codex_local_wait",
  "tool_category": "wait_result",
  "request_id": "uuid",
  "ts": "2025-11-18T10:15:22Z",
  "status": "ok",
  "meta": {
    "started_ts": "2025-11-18T10:05:22Z",
    "completed_ts": "2025-11-18T10:15:22Z",
    "duration_ms": 600000,
    "exit_code": 0
  },
  "data": {
    "task_id": "T-local-abc123",
    "state": "completed",
    "summary": "Modified 9 files, added 47 tests",
    "metadata": {
      "duration": 600,
      "file_operations": {
        "modified_files": ["src/api.ts", "src/utils.ts"],
        "added_files": ["tests/api.test.ts"],
        "deleted_files": [],
        "lines_changed": 342
      },
      "test_results": {
        "passed": 47,
        "failed": 0,
        "skipped": 0,
        "failed_tests": []
      },
      "thread_info": {
        "thread_id": "thread_xyz789",
        "cache_hit_rate": 0.93,
        "token_usage": {
          "input_tokens": 12000,
          "cached_input_tokens": 11160,
          "output_tokens": 3500
        }
      }
    },
    "artifacts": [
      {
        "type": "file",
        "ref": "src/api.ts",
        "size": 4523,
        "sha256": "abc123..."
      }
    ],
    "output": {
      "included": false,
      "reason": "Output excluded by default (use include_output=true)",
      "truncated": false,
      "max_bytes": 0
    }
  }
}
```

#### Fields

| Field               | Type    | Required | Description                                   |
| ------------------- | ------- | -------- | --------------------------------------------- |
| `meta.started_ts`   | string  | Yes      | ISO-8601 task start time                      |
| `meta.completed_ts` | string  | Yes      | ISO-8601 task completion time                 |
| `meta.duration_ms`  | integer | Yes      | Total execution time in ms                    |
| `meta.exit_code`    | integer | No       | Process exit code (if applicable)             |
| `data.task_id`      | string  | Yes      | Task identifier                               |
| `data.state`        | string  | Yes      | "completed", "failed", "cancelled", "timeout" |
| `data.summary`      | string  | Yes      | One-line human-readable summary               |
| `data.metadata`     | object  | Yes      | Full EnhancedMetadata object                  |
| `data.artifacts`    | array   | No       | Array of artifact references                  |
| `data.output`       | object  | No       | Output inclusion policy                       |

#### Output Inclusion Policy

**Default**: `include_output: false` (output excluded for token efficiency)

```json
"output": {
  "included": false,
  "reason": "Output excluded by default",
  "truncated": false,
  "max_bytes": 0
}
```

**With `include_output: true`**:

```json
"output": {
  "included": true,
  "stdout": "Full stdout content...",
  "stderr": "Full stderr content...",
  "truncated": false,
  "max_bytes": 65536
}
```

**Truncated Output** (if exceeds max_bytes):

```json
"output": {
  "included": true,
  "stdout": "First 32KB... [truncated] ...last 32KB",
  "stderr": "",
  "truncated": true,
  "max_bytes": 65536,
  "original_size": 250000
}
```

#### State Values

| State       | Description          | metadata.error_context       |
| ----------- | -------------------- | ---------------------------- |
| `completed` | Successful execution | Not present                  |
| `failed`    | Execution error      | Present with details         |
| `cancelled` | User cancelled       | Not present                  |
| `timeout`   | Exceeded time limit  | Present with partial results |

---

### Category 3: Status Snapshot (2 tools)

**Tools**: `_codex_local_status`, `_codex_cloud_status`

**Purpose**: Non-blocking status query, no outputs/logs

**Schema ID**: `codex/v3.6/status_snapshot/v1`

#### Success Response

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/status_snapshot/v1",
  "tool": "_codex_local_status",
  "tool_category": "status_snapshot",
  "request_id": "uuid",
  "ts": "2025-11-18T10:05:22Z",
  "status": "ok",
  "meta": {
    "snapshot_ts": "2025-11-18T10:05:22Z",
    "total": 3
  },
  "data": {
    "summary": {
      "running": 2,
      "queued": 1,
      "recently_completed": 5
    },
    "tasks": [
      {
        "task_id": "T-local-abc123",
        "state": "working",
        "started_ts": "2025-11-18T10:00:00Z",
        "elapsed_seconds": 322,
        "progress": {
          "percent": 50,
          "completed_steps": 1,
          "total_steps": 2,
          "current_activity": "Analyzing codebase"
        }
      },
      {
        "task_id": "T-local-def456",
        "state": "working",
        "started_ts": "2025-11-18T10:03:00Z",
        "elapsed_seconds": 142,
        "progress": null
      }
    ],
    "queue": [
      {
        "task_id": "T-local-ghi789",
        "position": 0,
        "estimated_start_ms": 180000
      }
    ],
    "recently_completed": [
      {
        "task_id": "T-local-jkl012",
        "state": "completed",
        "duration_seconds": 420,
        "completed_ts": "2025-11-18T09:55:00Z"
      }
    ]
  }
}
```

#### Conditional Output Rules

**Always Include**:

- `summary` object (running, queued, recently_completed counts)

**Conditionally Include** (only if non-empty):

- `tasks` array: Only if `summary.running > 0`
- `queue` array: Only if `summary.queued > 0`
- `recently_completed` array: Only if `summary.recently_completed > 0`

**Default Limits**:

- `tasks`: Show all running tasks (no limit)
- `queue`: Show all queued tasks (no limit)
- `recently_completed`: Limit to 5 (overridable with `limit` parameter)

#### Fields

| Field                             | Type    | Required    | Description                 |
| --------------------------------- | ------- | ----------- | --------------------------- |
| `meta.snapshot_ts`                | string  | Yes         | When snapshot was taken     |
| `meta.total`                      | integer | Yes         | Total tasks in snapshot     |
| `data.summary.running`            | integer | Yes         | Count of running tasks      |
| `data.summary.queued`             | integer | Yes         | Count of queued tasks       |
| `data.summary.recently_completed` | integer | Yes         | Count of recently completed |
| `data.tasks`                      | array   | Conditional | Running tasks (if > 0)      |
| `data.queue`                      | array   | Conditional | Queued tasks (if > 0)       |
| `data.recently_completed`         | array   | Conditional | Recent tasks (if > 0)       |

#### Notes

- **No stdout/stderr** in status snapshots (use results tools)
- **No full output** (token efficiency)
- `verbose: true` parameter can add `last_lines` (last 5 lines per task, max)

---

### Category 4: Result Set (2 tools)

**Tools**: `_codex_local_results`, `_codex_cloud_results`

**Purpose**: Fetch complete execution results with metadata

**Schema ID**: `codex/v3.6/result_set/v1`

#### Success Response

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/result_set/v1",
  "tool": "_codex_local_results",
  "tool_category": "result_set",
  "request_id": "uuid",
  "ts": "2025-11-18T10:15:22Z",
  "status": "ok",
  "meta": {
    "count": 1
  },
  "data": {
    "task_id": "T-local-abc123",
    "state": "completed",
    "summary": "Modified 9 files, added 47 tests, all passing",
    "duration_seconds": 503,
    "completed_ts": "2025-11-18T10:15:22Z",
    "metadata": {
      "duration": 503,
      "file_operations": {
        "modified_files": [
          "src/crud/workspace.service.ts",
          "src/crud/workspace.repository.ts",
          "tests/crud/workspace.test.ts"
        ],
        "added_files": [],
        "deleted_files": [],
        "lines_changed": 342
      },
      "test_results": {
        "passed": 47,
        "failed": 0,
        "skipped": 0,
        "failed_tests": []
      },
      "thread_info": {
        "thread_id": "thread_xyz789",
        "cache_hit_rate": 0.93,
        "token_usage": {
          "input_tokens": 12000,
          "cached_input_tokens": 11160,
          "output_tokens": 3500
        }
      },
      "error_context": null,
      "task_status": "completed"
    },
    "output": {
      "included": false,
      "reason": "Output excluded by default (use include_output=true)",
      "truncated": false,
      "max_bytes": 0
    },
    "events": {
      "included": false,
      "count": 47,
      "reason": "Events excluded by default (use include_events=true)"
    }
  }
}
```

#### With Errors

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/result_set/v1",
  "tool": "_codex_local_results",
  "tool_category": "result_set",
  "request_id": "uuid",
  "ts": "2025-11-18T10:15:22Z",
  "status": "ok",
  "meta": {
    "count": 1
  },
  "data": {
    "task_id": "T-local-abc123",
    "state": "failed",
    "summary": "Task failed: TypeError at workspace.service.ts:42",
    "duration_seconds": 145,
    "completed_ts": "2025-11-18T10:15:22Z",
    "metadata": {
      "duration": 145,
      "file_operations": {
        "modified_files": [],
        "added_files": [],
        "deleted_files": [],
        "lines_changed": 0
      },
      "error_context": {
        "error_message": "Cannot read property 'name' of null",
        "error_type": "TypeError",
        "failed_files": ["src/crud/workspace.service.ts"],
        "error_locations": [
          {
            "file": "src/crud/workspace.service.ts",
            "line": 42,
            "column": 15
          }
        ],
        "suggestions": [
          "Start investigation at workspace.service.ts:42",
          "Check variable types and null/undefined values",
          "Run failing tests individually to isolate issues"
        ]
      },
      "task_status": "failed"
    },
    "output": {
      "included": true,
      "stdout": "Full output for debugging...",
      "stderr": "TypeError: Cannot read property 'name' of null\n  at ...",
      "truncated": false,
      "max_bytes": 65536
    }
  }
}
```

#### Output Inclusion Rules

**Default Behavior**:

- `state: "completed"`: Output excluded (use `include_output: true`)
- `state: "failed"`: Output **always included** (for debugging)
- `state: "timeout"`: Partial output **always included**

**Parameters**:

- `include_output: true`: Force output inclusion
- `include_events: true`: Include JSONL events (SDK only)
- `max_output_bytes: 65536`: Truncation limit (default 64KB)

---

### Category 5: Registry Info (3 tools)

**Tools**: `_codex_cloud_list_environments`, `_codex_cloud_github_setup`, `_codex_cleanup_registry`

**Purpose**: Configuration data, capabilities, maintenance

**Schema ID**: `codex/v3.6/registry_info/v1`

#### List Environments

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/registry_info/v1",
  "tool": "_codex_cloud_list_environments",
  "tool_category": "registry_info",
  "request_id": "uuid",
  "ts": "2025-11-18T10:05:22Z",
  "status": "ok",
  "meta": {
    "count": 3,
    "source": "~/.config/mcp-delegator/environments.json"
  },
  "data": {
    "environments": [
      {
        "id": "env_illustrations",
        "name": "Illustrations Training",
        "repository": "https://github.com/littlebearapps/illustrations",
        "tech_stack": "python",
        "created_at": "2025-11-01T00:00:00Z"
      },
      {
        "id": "env_myproject",
        "name": "My Project",
        "repository": "https://github.com/user/myproject",
        "tech_stack": "node",
        "created_at": "2025-10-15T00:00:00Z"
      }
    ]
  }
}
```

#### GitHub Setup Guide

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/registry_info/v1",
  "tool": "_codex_cloud_github_setup",
  "tool_category": "registry_info",
  "request_id": "uuid",
  "ts": "2025-11-18T10:05:22Z",
  "status": "ok",
  "meta": {
    "repository": "https://github.com/user/repo",
    "tech_stack": "node"
  },
  "data": {
    "guide": "# GitHub Integration Setup\n\n## Step 1: Create Token...",
    "steps": [
      {
        "step": 1,
        "title": "Create Fine-Grained Token",
        "instructions": "Visit https://github.com/settings/tokens..."
      },
      {
        "step": 2,
        "title": "Configure Environment",
        "instructions": "Add token to environment variables..."
      }
    ],
    "verification_task": "Test GitHub access by creating a feature branch"
  }
}
```

#### Cleanup Registry

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/registry_info/v1",
  "tool": "_codex_cleanup_registry",
  "tool_category": "registry_info",
  "request_id": "uuid",
  "ts": "2025-11-18T10:05:22Z",
  "status": "ok",
  "meta": {
    "dry_run": false,
    "stuck_threshold_seconds": 3600,
    "old_threshold_hours": 24
  },
  "data": {
    "stuck_tasks": {
      "found": 3,
      "cleaned": 3,
      "task_ids": ["T-local-abc", "T-local-def", "T-local-ghi"]
    },
    "old_tasks": {
      "found": 12,
      "deleted": 12,
      "oldest_age_hours": 48
    },
    "summary": "Cleaned 3 stuck tasks, deleted 12 old tasks"
  }
}
```

---

## Conditional Output Reference

### Summary Table

| Tool Category   | Default Output          | Include Full Output                      | Include Events         |
| --------------- | ----------------------- | ---------------------------------------- | ---------------------- |
| Execution Ack   | Task ID only            | N/A                                      | N/A                    |
| Wait Result     | Metadata + summary      | `include_output: true`                   | N/A                    |
| Status Snapshot | Summary + running tasks | `verbose: true` (last 5 lines)           | N/A                    |
| Result Set      | Metadata + summary      | Auto on error, or `include_output: true` | `include_events: true` |
| Registry Info   | Full data               | N/A                                      | N/A                    |

### Truncation Limits

| Field                       | Default Max Bytes | Truncation Strategy       |
| --------------------------- | ----------------- | ------------------------- |
| `output.stdout`             | 32768 (32KB)      | First 16KB + last 16KB    |
| `output.stderr`             | 32768 (32KB)      | First 16KB + last 16KB    |
| `events` array              | 50 events         | Last 50 events            |
| `recently_completed`        | 5 tasks           | Last 5 by completion time |
| `error.details.stderr_tail` | 1024 (1KB)        | Last 1KB                  |

---

## Tool-to-Category Mapping

| Tool                             | Category        | Schema ID                     | Returns Full Results    |
| -------------------------------- | --------------- | ----------------------------- | ----------------------- |
| `_codex_local_run`               | execution_ack   | codex/v3.6/execution_ack/v1   | No (use results tool)   |
| `_codex_local_exec`              | execution_ack   | codex/v3.6/execution_ack/v1   | No (use results tool)   |
| `_codex_local_resume`            | execution_ack   | codex/v3.6/execution_ack/v1   | No (use results tool)   |
| `_codex_cloud_submit`            | execution_ack   | codex/v3.6/execution_ack/v1   | No (use results tool)   |
| `_codex_local_wait`              | wait_result     | codex/v3.6/wait_result/v1     | Yes (blocks until done) |
| `_codex_cloud_wait`              | wait_result     | codex/v3.6/wait_result/v1     | Yes (blocks until done) |
| `_codex_local_status`            | status_snapshot | codex/v3.6/status_snapshot/v1 | No (status only)        |
| `_codex_cloud_status`            | status_snapshot | codex/v3.6/status_snapshot/v1 | No (status only)        |
| `_codex_local_results`           | result_set      | codex/v3.6/result_set/v1      | Yes (full metadata)     |
| `_codex_cloud_results`           | result_set      | codex/v3.6/result_set/v1      | Yes (full metadata)     |
| `_codex_local_cancel`            | registry_info   | codex/v3.6/registry_info/v1   | No (operation result)   |
| `_codex_cloud_cancel`            | registry_info   | codex/v3.6/registry_info/v1   | No (operation result)   |
| `_codex_cleanup_registry`        | registry_info   | codex/v3.6/registry_info/v1   | No (cleanup report)     |
| `_codex_cloud_list_environments` | registry_info   | codex/v3.6/registry_info/v1   | No (config data)        |
| `_codex_cloud_github_setup`      | registry_info   | codex/v3.6/registry_info/v1   | No (setup guide)        |

---

## Compatibility Notes

### Progress Notifications (v3.5.0)

MCP progress notifications are **protocol-level** and **orthogonal to response format**:

- Progress notifications: Sent via `notifications/progress` (MCP transport)
- JSON responses: Tool return values (MCP call result)
- **No conflict**: Both can coexist

**Example**:

```typescript
// During execution, server sends (protocol-level):
notifications/progress: {
  progressToken: "T-local-abc123",
  progress: 50,
  total: 100,
  message: "50% complete"
}

// At completion, tool returns (call result):
{
  "version": "3.6",
  "status": "ok",
  "data": { "task_id": "T-local-abc123", ... }
}
```

### Timeout Detection (v3.2.1)

TimeoutWatchdog integrates with JSON format via structured error responses:

**Idle Timeout** (5 minutes no output):

```json
{
  "status": "error",
  "error": {
    "code": "TIMEOUT",
    "message": "Task exceeded idle timeout",
    "details": {
      "timeout_type": "idle",
      "elapsed_seconds": 305,
      "partial_results": { "last_events": [...], "last_output": "..." }
    }
  }
}
```

**Hard Timeout** (20 minutes total):

```json
{
  "status": "error",
  "error": {
    "code": "TIMEOUT",
    "message": "Task exceeded hard timeout",
    "details": {
      "timeout_type": "hard",
      "elapsed_seconds": 1205
    }
  }
}
```

### Metadata Extraction (v3.2.1)

Existing `metadata_extractor.ts` works with both formats:

- **Input**: Raw Codex output (text)
- **Output**: Structured metadata object
- **Integration**: Metadata embedded in `data.metadata` field (JSON) or formatted text (markdown)

---

## Implementation Guidelines

### TypeScript Interfaces

```typescript
// Common envelope
interface JsonEnvelope<T> {
  version: string;
  schema_id: string;
  tool: string;
  tool_category:
    | "execution_ack"
    | "wait_result"
    | "status_snapshot"
    | "result_set"
    | "registry_info";
  request_id: string;
  ts: string;
  status: "ok" | "error";
  meta: Record<string, any>;
  data?: T;
  error?: JsonError;
}

// Error structure
interface JsonError {
  code:
    | "TIMEOUT"
    | "VALIDATION"
    | "TOOL_ERROR"
    | "NOT_FOUND"
    | "UNSUPPORTED"
    | "INTERNAL";
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  duration_ms?: number;
}

// Category-specific data types
interface ExecutionAckData {
  task_id: string;
  thread_id?: string;
  accepted: boolean;
  capability: "background" | "foreground";
  expected_duration?: string;
  started_at: string;
}

interface WaitResultData {
  task_id: string;
  state: "completed" | "failed" | "cancelled" | "timeout";
  summary: string;
  metadata: EnhancedMetadata;
  artifacts?: Array<{
    type: string;
    ref: string;
    size: number;
    sha256?: string;
  }>;
  output?: {
    included: boolean;
    stdout?: string;
    stderr?: string;
    truncated: boolean;
    max_bytes: number;
    original_size?: number;
  };
}

// ... etc for other categories
```

### JSON Schema Validation

Use JSON Schema (draft 2020-12) for runtime validation:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "codex/v3.6/execution_ack/v1",
  "type": "object",
  "required": [
    "version",
    "schema_id",
    "tool",
    "tool_category",
    "request_id",
    "ts",
    "status"
  ],
  "properties": {
    "version": { "type": "string", "const": "3.6" },
    "schema_id": { "type": "string" },
    "status": { "enum": ["ok", "error"] }
  }
}
```

### Envelope Builder Utility

```typescript
function buildJsonEnvelope<T>(
  tool: string,
  category: string,
  schemaId: string,
  meta: Record<string, any>,
  data?: T,
  error?: JsonError,
): JsonEnvelope<T> {
  return {
    version: "3.6",
    schema_id: schemaId,
    tool,
    tool_category: category,
    request_id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    status: error ? "error" : "ok",
    meta,
    ...(data && { data }),
    ...(error && { error }),
  };
}
```

---

## Migration Guide

### For AI Agents

**v3.5 (Markdown)**:

```typescript
const result = await _codex_local_exec({ task: "..." });
// Returns: "## 📊 Task Started\n\nTask ID: T-local-abc123..."
// Must parse markdown to extract task_id
```

**v3.6 (JSON)**:

```typescript
const result = await _codex_local_exec({
  task: "...",
  format: "json",
});
// Returns: { version: "3.6", data: { task_id: "T-local-abc123" }, ... }
// Direct access: result.data.task_id
```

### Backward Compatibility

- **Default**: `format: "markdown"` (no breaking change)
- **Opt-in**: Add `format: "json"` to any tool call
- **Both work**: All 15 tools support both formats

---

## Appendix: Complete Examples

### Example 1: Full Execution Workflow (JSON)

```typescript
// 1. Start task
const start = await _codex_local_exec({
  task: "Implement user authentication",
  format: "json",
});
// Returns: { data: { task_id: "T-local-abc123", thread_id: "thread_xyz" } }

// 2. Wait for completion
const result = await _codex_local_wait({
  task_id: start.data.task_id,
  format: "json",
});
// Returns: { data: { state: "completed", metadata: { ... } } }

// 3. Extract summary
console.log(`✅ ${result.data.summary}`);
console.log(
  `📁 Modified: ${result.data.metadata.file_operations.modified_files.length} files`,
);
console.log(`✅ Tests: ${result.data.metadata.test_results.passed} passed`);
```

### Example 2: Error Handling (JSON)

```typescript
const result = await _codex_local_exec({
  task: "Invalid task",
  format: "json",
});

if (result.status === "error") {
  console.error(`Error: ${result.error.code}`);
  console.error(`Message: ${result.error.message}`);

  if (result.error.code === "TIMEOUT") {
    console.log("Partial results:");
    console.log(result.error.details.partial_results);
  }

  if (result.error.retryable) {
    console.log("This error is retryable");
  }
}
```

### Example 3: Status Polling (JSON)

```typescript
const status = await _codex_local_status({
  format: "json",
});

console.log(`Running: ${status.data.summary.running}`);
console.log(`Queued: ${status.data.summary.queued}`);

// Only access if present (conditional output)
if (status.data.tasks) {
  status.data.tasks.forEach((task) => {
    console.log(`Task ${task.task_id}: ${task.elapsed_seconds}s elapsed`);
  });
}
```

---

## Version History

| Version | Date       | Changes                                         |
| ------- | ---------- | ----------------------------------------------- |
| 3.6.0   | 2025-11-18 | Initial JSON format support, 5 category schemas |
