# Architecture Quick Reference

System design, components, and data flow for Codex Control MCP.

---

## High-Level Architecture

### Three Execution Paths

#### 1. Local CLI (Blocking)
```
Claude Code → MCP Server → spawn(codex exec) → ChatGPT Pro
```
- **Used by**: Tools 1-4 (run, plan, apply, status)
- **Characteristics**: Blocking, no persistence, simple
- **Process**: CLI subprocess, JSONL parsing, synchronous response

#### 2. Local SDK (Streaming)
```
Claude Code → MCP Server → @openai/codex-sdk → codex CLI → ChatGPT Pro
                                    ↓
                          Thread Storage (~/.codex/sessions)
```
- **Used by**: Tools 9-10 (local_exec, local_resume)
- **Characteristics**: Async, thread persistence, real-time events
- **Process**: SDK manages threads, streams events, caches context

#### 3. Cloud (Background)
```
Claude Code → MCP Server → spawn(codex cloud exec) → Codex Cloud
                                    ↓
                          Task Registry (~/.config/codex-control/cloud-tasks.json)
```
- **Used by**: Tools 5-8 (cloud_submit, cloud_list_tasks, etc.)
- **Characteristics**: Fire-and-forget, sandboxed, persistent
- **Process**: Submit and track, monitor via Web UI

---

## Directory Structure

```
codex-control/
├── src/
│   ├── index.ts                  # MCP server entry point
│   ├── executor/
│   │   ├── jsonl_parser.ts       # JSONL event stream parser
│   │   ├── process_manager.ts    # Process spawning + queue
│   │   └── error_mapper.ts       # Error → MCP format
│   ├── security/
│   │   ├── input_validator.ts    # Input sanitization
│   │   └── redactor.ts           # Secret scrubbing
│   ├── utils/
│   │   └── metadata_extractor.ts # Structured metadata extraction 🆕
│   └── tools/
│       ├── run.ts                # codex_run (local CLI)
│       ├── plan.ts               # codex_plan (local CLI)
│       ├── apply.ts              # codex_apply (local CLI)
│       ├── status.ts             # codex_status
│       ├── local_exec.ts         # codex_local_exec (SDK) 🆕
│       ├── local_resume.ts       # codex_local_resume (SDK) 🆕
│       ├── cloud.ts              # Cloud tools (5-10)
│       ├── cloud_check_reminder.ts # Pending task reminder 🆕
│       ├── list_environments.ts  # Environment listing 🆕
│       └── github_setup.ts       # GitHub integration guide
├── dist/                         # Compiled JavaScript
├── quickrefs/                    # Documentation
├── scripts/                      # Template scripts
├── package.json
├── tsconfig.json
├── config.json                   # MCP server metadata
└── README.md
```

---

## Key Components

### 1. MCP Server (`index.ts`)

**Purpose**: Entry point for MCP protocol communication.

**Responsibilities**:
- Register all 13 tools with MCP SDK
- Handle tool invocation requests
- Manage server lifecycle (startup, shutdown)
- Expose MCP resources (environment templates)

**Key Functions**:
- `server.setRequestHandler(ListToolsRequestSchema, ...)` - List tools
- `server.setRequestHandler(CallToolRequestSchema, ...)` - Execute tools
- `server.setRequestHandler(ListResourcesRequestSchema, ...)` - List templates
- `server.setRequestHandler(ReadResourceRequestSchema, ...)` - Read templates

---

### 2. JSONL Parser (`executor/jsonl_parser.ts`)

**Purpose**: Parse Codex CLI event streams (JSONL format).

**Characteristics**:
- **Tolerant**: Handles partial lines, non-JSON stderr
- **Line-buffered**: Processes complete lines only
- **Event-driven**: Emits events as they arrive
- **Error-resilient**: Continues parsing after errors

**Input Example**:
```
{"type":"turn.started","turnId":"turn_001"}
{"type":"item.completed","itemId":"item_001"}
Not JSON - ignored
{"type":"turn.completed","turnId":"turn_001"}
```

**Output**:
```typescript
[
  { type: 'turn.started', turnId: 'turn_001' },
  { type: 'item.completed', itemId: 'item_001' },
  { type: 'turn.completed', turnId: 'turn_001' }
]
```

---

### 3. Process Manager (`executor/process_manager.ts`)

**Purpose**: Manage Codex CLI subprocesses with concurrency control.

**Features**:
- **Queue-based**: FIFO queue for tasks exceeding concurrency
- **Concurrency limit**: Max 2-4 parallel processes (configurable)
- **Process cleanup**: Kill on timeout, graceful termination
- **No shell injection**: Uses `spawn(cmd, args)`, not `exec(string)`

**Queue States**:
- **Running**: Currently executing (≤ MAX_CONCURRENCY)
- **Queued**: Waiting for slot to open
- **Completed**: Finished successfully
- **Failed**: Errored or timed out

---

### 4. Input Validator (`security/input_validator.ts`)

**Purpose**: Sanitize and validate all user inputs.

**Validations**:
- **Task length**: Max 10,000 characters
- **Mode whitelist**: Only `read-only`, `workspace-write`, `danger-full-access`
- **Model whitelist**: Known OpenAI models only
- **Path validation**: No `..` traversal, absolute paths only
- **Injection prevention**: Escape shell metacharacters

**Example**:
```typescript
// Input
task: "rm -rf / && echo 'hacked'"
workingDir: "../../../etc"

// Validation
✗ Invalid workingDir (path traversal)
✗ Task contains dangerous command
```

---

### 5. Secret Redactor (`security/redactor.ts`)

**Purpose**: Scrub sensitive data from outputs.

**Patterns Matched** (15+):
- OpenAI API keys (`sk-proj-...`)
- AWS credentials (`AKIA...`, `aws_secret_access_key=...`)
- GitHub tokens (`ghp_...`, `gho_...`, `github_pat_...`)
- JWT tokens (`eyJ...`)
- Private keys (`-----BEGIN PRIVATE KEY-----`)
- Passwords (`password=...`, `PASSWORD=...`)
- Database URLs (`postgres://user:pass@host`)
- Bearer tokens (`Authorization: Bearer ...`)

**Redaction**:
```typescript
// Before
OPENAI_API_KEY=sk-proj-abc123def456...

// After
OPENAI_API_KEY=sk-***REDACTED***
```

---

### 6. Metadata Extractor (`utils/metadata_extractor.ts`) 🆕

**Purpose**: Extract structured metadata from Codex output text for AI agent decision-making.

**What It Extracts**:
- **Test Results**: Passed/failed/skipped counts, failed test names (Jest, Pytest, Mocha)
- **File Operations**: Modified/added/deleted files, lines changed (Git diff-style)
- **Thread Info**: Thread ID, cache hit rate (e.g., 96.8%), token usage
- **Task Status**: pending/running/completed/failed/canceled
- **Error Context**: Error message, type, failed files, locations with **actionable suggestions**
- **Duration**: Execution time in seconds

**Actionable Suggestions**:
```typescript
// AI agents get specific guidance
error_context: {
  error_message: "Cannot read property 'name' of null",
  error_type: "TypeError",
  failed_files: ["utils.ts", "api.ts"],
  error_locations: [
    { file: "utils.ts", line: 42, column: 15 }
  ],
  suggestions: [
    "Start investigation at utils.ts:42",
    "Check variable types and null/undefined values",
    "Run failing tests individually to isolate issues"
  ]
}
```

**Integration**:
- Automatically called in `convertPrimitiveResult()` (src/tools/codex.ts)
- Added to `CodexToolResponse.metadata` field
- Graceful failure - won't break tool if extraction fails
- Zero token cost - extraction is local regex-based parsing

**Pattern Matching Examples**:
```typescript
// Jest: "Tests: 2 failed, 45 passed, 47 total"
// Pytest: "30 passed, 1 failed in 8.23s"
// Git: "modified: src/api.ts"
// Tokens: "input_tokens": 11373, "cached_input_tokens": 11008
// Error: "at processUser (utils.ts:42:15)"
```

**Test Coverage**: 7/7 tests (100% pass rate) - see `test-metadata-extraction.ts`

---

## Data Flow

### Local CLI Execution (codex_run)

```
1. Claude Code sends MCP request
   ↓
2. MCP Server receives CallToolRequest
   ↓
3. Input Validator sanitizes parameters
   ↓
4. Process Manager spawns codex CLI
   ↓
5. JSONL Parser processes event stream
   ↓
6. Secret Redactor scrubs sensitive data
   ↓
7. Error Mapper converts errors to MCP format
   ↓
8. Metadata Extractor extracts structured metadata 🆕
   ↓
9. MCP Server sends CallToolResponse (with metadata)
   ↓
10. Claude Code receives result
```

### Local SDK Execution (codex_local_exec)

```
1. Claude Code sends MCP request
   ↓
2. MCP Server receives CallToolRequest
   ↓
3. Input Validator sanitizes parameters
   ↓
4. Import @openai/codex-sdk
   ↓
5. SDK.startThread(task, mode, workingDir)
   ↓
6. SDK spawns codex CLI with session management
   ↓
7. Real-time event streaming (turn.started, item.completed, etc.)
   ↓
8. Thread persisted to ~/.codex/sessions/
   ↓
9. MCP Server returns thread ID + events + token usage
   ↓
10. Claude Code receives result
```

### Cloud Submission (codex_cloud_submit)

```
1. Claude Code sends MCP request
   ↓
2. MCP Server receives CallToolRequest
   ↓
3. Input Validator sanitizes parameters
   ↓
4. Process Manager spawns codex cloud exec
   ↓
5. Codex Cloud returns task ID immediately
   ↓
6. Task Registry stores task metadata
   ↓
7. MCP Server returns task ID + Web UI link
   ↓
8. Claude Code receives result
   ↓
9. (Background) Task executes in Codex Cloud
   ↓
10. (Later) User checks status via Web UI or tools
```

---

## Concurrency Model

### Process Queue

```
MAX_CONCURRENCY = 2

Request 1 → [Running] ──┐
Request 2 → [Running] ──┤→ Active (2/2 slots)
Request 3 → [Queued] ───┘
Request 4 → [Queued]
```

### Queue Management

**On Task Arrival**:
1. Check if slots available (running < MAX_CONCURRENCY)
2. If yes: Start immediately
3. If no: Add to queue (FIFO)

**On Task Completion**:
1. Mark task as completed
2. Check queue for waiting tasks
3. If queue not empty: Start next task
4. Repeat until queue empty or slots full

**Benefits**:
- ✅ Prevents resource exhaustion
- ✅ Fair ordering (FIFO)
- ✅ Graceful degradation under load

---

## Thread Management (Local SDK)

### Thread Storage

**Location**: `~/.codex/sessions/`

**Structure**:
```
~/.codex/sessions/
├── thread_abc123xyz/
│   ├── metadata.json       # Thread info
│   ├── conversation.jsonl  # Turn history
│   └── cache.json          # Cached context
└── thread_def456uvw/
    └── ...
```

### Thread Lifecycle

```
1. Start Thread
   codex_local_exec(task) → thread_abc123xyz

2. Execute Task
   Codex processes → Events streamed → Result returned

3. Persist Thread
   ~/.codex/sessions/thread_abc123xyz/ created

4. Resume Thread
   codex_local_resume(thread_abc123xyz, task) → Loads context

5. Continue Execution
   Full conversation history preserved → High cache rates
```

### Context Caching

**First Execution**:
- Input: 10,000 tokens (0 cached)
- Cache: Store conversation context

**Resumed Execution**:
- Input: 12,000 tokens (9,500 cached = 79% cache rate)
- Savings: ~80% reduction in input token costs

---

## Task Registry (Cloud)

### Registry Location

**File**: `~/.config/codex-control/cloud-tasks.json`

**Structure**:
```json
{
  "tasks": [
    {
      "taskId": "task-2025-11-11-abc123",
      "envId": "env_illustrations",
      "task": "Run comprehensive security audit...",
      "status": "submitted",
      "submittedAt": "2025-11-11T14:00:00Z",
      "workingDir": "/Users/nathanschram/project/",
      "model": "gpt-4o"
    }
  ]
}
```

### Registry Operations

**On Task Submit**:
1. Submit to Codex Cloud
2. Get task ID
3. Store in registry with metadata
4. Return task ID to user

**On Task List**:
1. Load registry
2. Filter by workingDir (default)
3. Apply additional filters (status, envId, etc.)
4. Return matching tasks

**On Status Check**:
1. Load registry
2. Find task by ID
3. Return Web UI link for status

---

## Security Layers

### Layer 1: Input Validation
```
User Input → Sanitization → Validation → Accept/Reject
```

### Layer 2: Secret Redaction
```
Process Output → Pattern Matching → Redaction → Safe Output
```

### Layer 3: Mutation Gating
```
File Modification → Confirm Check → Allow/Deny
```

### Layer 4: No Shell Injection
```
Command → spawn(cmd, args) → Safe Execution
(NOT: exec(`cmd ${userInput}`))
```

---

## Error Handling

### Error Flow

```
1. Error occurs in Codex CLI
   ↓
2. Error captured by Process Manager
   ↓
3. Error mapped to MCP format by Error Mapper
   ↓
4. Secrets redacted from error message
   ↓
5. User-friendly error returned to Claude Code
```

### Error Codes

| Error | MCP Code | Meaning |
|-------|----------|---------|
| Invalid params | `INVALID_PARAMS` | Bad input |
| Codex CLI error | `INTERNAL_ERROR` | Execution failed |
| Timeout | `INTERNAL_ERROR` | Process took too long |
| Auth failure | `INTERNAL_ERROR` | Codex auth failed |

---

## Performance Considerations

### Concurrency
- Default: 2 parallel processes
- Adjust via `CODEX_MAX_CONCURRENCY` env var
- Queue prevents resource exhaustion

### Token Efficiency
- Local SDK: 45-93% cache rates
- Thread resumption: Preserves context
- Structured output: Reduces parsing overhead

### Memory
- Event streams are line-buffered
- Partial lines held in memory
- Completed events released immediately

---

## Integration Points

### With Claude Code
- MCP protocol over stdio
- JSON-RPC 2.0 format
- Tool discovery via ListTools
- Resource discovery via ListResources

### With Codex CLI
- Subprocess spawning (no shell)
- JSONL event parsing
- Error code handling

### With Codex SDK
- npm package: `@openai/codex-sdk`
- Thread management: `startThread`, `resumeThread`
- Event streaming: `runStreamed`

### With Codex Cloud
- CLI submission: `codex cloud exec`
- Web UI monitoring: `https://chatgpt.com/codex`
- Task registry: Local JSON storage
