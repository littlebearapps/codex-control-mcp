# Codex Control MCP Server

**Version**: 2.1.0
**Status**: ✅ Dual-Mode Execution - Local SDK + Cloud with Real-Time Status Tracking
**Purpose**: Complete Codex workflow control with both local (real-time status) and cloud (background) execution modes

---

## Overview

The Codex Control MCP Server provides comprehensive control over OpenAI Codex execution with two modes:

1. **Local Mode** (NEW in v2.1.0): TypeScript SDK integration with real-time event streaming, full status visibility, and thread resumption
2. **Cloud Mode**: Background execution in sandboxed containers with persistent task tracking

**🎉 v2.1.0 - Dual Execution Modes**:
- ✅ **Local Execution via SDK** (NEW): Real-time status tracking, event streaming, thread resumption
- ✅ **Cloud Task Reminders** (NEW): Enhanced registry with Web UI links for pending tasks
- ✅ **Environment Registry** (NEW): Local config for Codex Cloud environment discovery
- ✅ **Hybrid Workflow Support**: Choose local for visibility, cloud for long-running tasks

**Previous Features**:
- ✅ Complete GitHub PR workflow automation (v2.0.0)
- ✅ Environment templates and setup guide (v1.5.0-2.0.0)
- ✅ Automatic task persistence and multi-instance tracking (v1.3.0)

## Features

### 🔧 Thirteen Core Tools

**Local Execution via CLI** (blocking, CLI-based):
1. **`codex_run`** - Execute read-only tasks (analysis, tests, etc.)
2. **`codex_plan`** - Preview changes without executing
3. **`codex_apply`** - Apply file modifications (requires confirmation)
4. **`codex_status`** - View server status and active processes

**Local Execution via SDK** (🆕 v2.1.0 - TypeScript SDK with streaming):
5. **`codex_local_exec`** - Execute tasks locally with real-time event streaming and full status visibility
6. **`codex_local_resume`** - Resume previous local thread with follow-up tasks

**Cloud Execution** (background execution with persistence):
7. **`codex_cloud_submit`** - Submit tasks to Codex Cloud (auto-tracked)
8. **`codex_cloud_list_tasks`** - List all tracked cloud tasks with filtering
9. **`codex_cloud_status`** - Check status of cloud tasks (shows registry info)
10. **`codex_cloud_results`** - View results of completed cloud tasks
11. **`codex_cloud_check_reminder`** - 🆕 Get Web UI links for pending Cloud tasks

**GitHub Integration & Configuration**:
12. **`codex_github_setup_guide`** - Generate custom GitHub integration guide
13. **`codex_list_environments`** - 🆕 List available Codex Cloud environments from local config

### 🎯 MCP Resources

**Environment Templates** (via MCP resources):
- **`github-node-typescript`** - Node.js/TypeScript projects with GitHub PR workflow
- **`github-python`** - Python projects with GitHub PR workflow
- **`github-go`** - Go projects with GitHub PR workflow
- **`github-rust`** - Rust projects with GitHub PR workflow
- **`basic-codex-cloud`** - Basic environment without GitHub integration

Access via:
- `ListResourcesRequestSchema` - Discover available templates
- `ReadResourceRequestSchema` - Read full template configuration
- URI scheme: `codex://environment-template/{name}`

### 🔒 Security Features

- **Input Validation**: Prevents command injection, path traversal, invalid parameters
- **Secret Redaction**: Automatic scrubbing of API keys, tokens, passwords from logs
- **Mutation Gating**: Requires explicit `confirm=true` for file-modifying operations
- **Concurrency Control**: Max 2-4 parallel processes (configurable)

### 💾 Persistent Task Tracking (v1.3.0)

- **Automatic Registration**: Task IDs stored automatically on submission
- **Multi-Instance Isolation**: Each working directory tracks its own tasks
- **Restart Recovery**: Tasks survive Claude Code crashes/restarts
- **Storage Location**: `~/.config/codex-control/cloud-tasks.json`
- **Task History**: Full audit trail with timestamps, status, and metadata
- **Filtering**: Query by working directory, environment, status
- **Cross-Session**: Continue tracking long-running tasks across sessions

### 📊 Real-Time Monitoring

- JSONL event stream parsing from `codex exec --json`
- Tolerant line-buffered parser handles partial lines and non-JSON stderr
- Process queue with concurrency limits
- Graceful error handling and cleanup

---

## Installation

### Prerequisites

- **Node.js**: >= 20.0.0
- **OpenAI Codex CLI**: Installed and configured
- **ChatGPT Pro** subscription (or `CODEX_API_KEY` environment variable)

### Install Codex CLI

```bash
# Install OpenAI Codex SDK
npm install -g @openai/codex

# Verify installation
codex --version

# Authenticate (if using ChatGPT Pro, this is automatic)
codex auth
```

### Build MCP Server

```bash
cd /Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control

# Install dependencies
npm install

# Build TypeScript
npm run build

# Verify build
ls -la dist/index.js
```

---

## Configuration

### Add to MCP Profile

Add this configuration to your `.mcp.json` file:

```json
{
  "mcpServers": {
    "codex-control": {
      "command": "node",
      "args": [
        "/Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control/dist/index.js"
      ],
      "env": {
        "CODEX_MAX_CONCURRENCY": "2"
      }
    }
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CODEX_MAX_CONCURRENCY` | `2` | Maximum parallel Codex processes |
| `CODEX_API_KEY` | (none) | Optional: Override ChatGPT Pro auth |

### User Configuration Files

**Codex Cloud Environments** (`~/.config/codex-control/environments.json`):

Maintain a local registry of your Codex Cloud environments for quick reference:

```json
{
  "seo-ads-expert-online": {
    "name": "SEO Ads Expert",
    "repoUrl": "https://github.com/littlebearapps/seo-ads-expert",
    "stack": "node",
    "description": "SEO and Google Ads automation tool"
  },
  "illustrations-training": {
    "name": "Illustrations Training",
    "repoUrl": "https://github.com/littlebearapps/illustrations",
    "stack": "python",
    "description": "Kohya LoRA training with Runpod integration"
  }
}
```

Create this file to enable `codex_list_environments` tool.

---

## Usage

### Tool 1: `codex_run` (Read-Only Execution)

Execute Codex tasks without file modifications.

**Parameters**:
- `task` (required): Task description for Codex
- `mode` (optional): Execution mode (`read-only` (default), `full-auto`, `danger-full-access`)
- `model` (optional): OpenAI model (`gpt-4o`, `o1`, `o3-mini`, etc.)
- `outputSchema` (optional): JSON schema for structured output
- `workingDir` (optional): Absolute path to working directory
- `envPolicy` (optional): Environment variable policy (`inherit-none` (default), `inherit-all`, `allow-list`)
- `envAllowList` (optional): List of environment variables to pass (only with `envPolicy='allow-list'`)

**Example - Analyze Code**:
```json
{
  "task": "Analyze main.ts for potential bugs and security issues",
  "mode": "read-only"
}
```

**Example - Run Tests**:
```json
{
  "task": "Run the test suite and report any failures",
  "mode": "read-only",
  "workingDir": "/Users/nathanschram/claude-code-tools/illustrations"
}
```

**Example - With Environment Variables** (Integration Testing):
```json
{
  "task": "Run integration tests against the API",
  "mode": "read-only",
  "envPolicy": "allow-list",
  "envAllowList": ["DATABASE_URL", "API_KEY", "TEST_ENV"]
}
```

**Output**:
```
✅ Codex Task Completed

**Summary**: Analyzed main.ts - found 3 potential issues

**File Changes** (0): None (read-only mode)

**Commands Executed** (1):
- `npm test` (exit 0)

**Events**: 12 events captured
**Exit Code**: 0
```

---

### Tool 2: `codex_plan` (Preview Changes)

Preview what Codex would do without executing.

**Parameters**:
- `task` (required): Task description to preview
- `model` (optional): OpenAI model
- `workingDir` (optional): Working directory
- `envPolicy` (optional): Environment variable policy (`inherit-none` (default), `inherit-all`, `allow-list`)
- `envAllowList` (optional): List of environment variables to pass (only with `envPolicy='allow-list'`)

**Example**:
```json
{
  "task": "Add error handling to API endpoints in server.ts"
}
```

**Output**:
```
📋 Codex Task Plan (Preview)

**Original Task**: Add error handling to API endpoints in server.ts

**Plan Summary**: Will add try-catch blocks to 5 endpoints

**Proposed File Changes** (1):
- modified: `src/server.ts`

**Proposed Commands** (0): None

**Note**: This is a preview only. Use `codex_apply` with `confirm=true` to execute.
```

---

### Tool 3: `codex_apply` (Apply Mutations)

Execute file-modifying tasks with confirmation.

**Parameters**:
- `task` (required): Task description
- `confirm` (required): Must be `true` to proceed
- `mode` (optional): `full-auto` (default) or `danger-full-access`
- `model` (optional): OpenAI model
- `outputSchema` (optional): JSON schema
- `workingDir` (optional): Working directory
- `envPolicy` (optional): Environment variable policy (`inherit-none` (default), `inherit-all`, `allow-list`)
- `envAllowList` (optional): List of environment variables to pass (only with `envPolicy='allow-list'`)

**Example - First Call (Without Confirmation)**:
```json
{
  "task": "Add TypeScript types to all functions in utils.ts",
  "confirm": false
}
```

**Output**:
```
⚠️ Confirmation Required

This operation will modify files in your project.

**Task**: Add TypeScript types to all functions in utils.ts
**Mode**: full-auto

**To proceed**, call this tool again with `confirm=true`.

**Tip**: Use `codex_plan` first to preview changes.
```

**Example - Second Call (With Confirmation)**:
```json
{
  "task": "Add TypeScript types to all functions in utils.ts",
  "confirm": true
}
```

**Output**:
```
✅ Changes Applied

**Task**: Add TypeScript types to all functions in utils.ts
**Mode**: full-auto

**Summary**: Added TypeScript types to 8 functions

**Files Modified** (1):
- modified: `src/utils.ts`

**Commands Executed** (1):
- `npm run typecheck` (exit 0)

**Events**: 15 events captured
**Exit Code**: 0

**Next Steps**:
- Review changes: `git diff`
- Run tests: `npm test` or equivalent
- Commit changes: `git add . && git commit -m "..."`
```

---

### Tool 4: `codex_status` (Server Status)

Get current server status and queue information.

**Parameters**: None

**Example**:
```json
{}
```

**Output**:
```
📊 Codex Control Status

**Active Processes**: 0
**Queued Tasks**: 0
**Running Tasks**: 0
**Max Concurrency**: 2

✅ No active Codex tasks

**Available Tools**:
- `codex_run` - Execute read-only tasks (analysis, tests)
- `codex_plan` - Preview changes without executing
- `codex_apply` - Apply file modifications (requires confirm=true)
- `codex_status` - View this status
- `codex_cloud_submit` - Submit background tasks to Codex Cloud
- `codex_cloud_status` - Check cloud task status
- `codex_cloud_results` - View cloud task results
```

---

## Choosing Execution Mode

Codex Control MCP provides three execution approaches. Choose based on your needs:

| Feature | Local CLI (Tools 1-4) | Local SDK (Tools 9-10) 🆕 | Cloud (Tools 5-8) |
|---------|---------------------|----------------------|------------------|
| **Real-Time Status** | ❌ Blocking | ✅ Event Streaming | ❌ Background |
| **Thread Resumption** | ❌ No | ✅ Yes | ❌ No |
| **Token Visibility** | ❌ No | ✅ Yes | ❌ No |
| **Session Persistence** | ❌ No | ✅ Yes | ✅ Yes |
| **Execution Location** | Local Mac | Local Mac | Cloud Containers |
| **Best For** | Quick tasks | Iterative development | Long-running tasks |
| **Max Duration** | ~5-10 minutes | No hard limit | Hours |
| **Context Preservation** | ❌ No | ✅ Full thread history | ❌ No |

**Recommendations**:

**Use Local SDK** (`codex_local_exec` + `codex_local_resume`) when:
- ✅ You want to see real-time progress
- ✅ You need to ask follow-up questions
- ✅ You're doing iterative development (analyze → fix → test)
- ✅ You want to track token usage and costs
- ✅ Tasks take 5-30 minutes with multiple steps

**Use Cloud** (`codex_cloud_submit`) when:
- ✅ Tasks will take hours (full test suites, comprehensive refactoring)
- ✅ You want fire-and-forget execution
- ✅ You need sandboxed environment with specific dependencies
- ✅ You want to continue working on other tasks
- ✅ Tasks run overnight or across multiple sessions

**Use Local CLI** (Tools 1-4) when:
- ✅ Quick read-only analysis (1-5 minutes)
- ✅ Simple one-shot tasks
- ✅ You don't need thread resumption
- ✅ Legacy compatibility with existing workflows

---

### Tool 5: `codex_cloud_submit` (Background Execution)

Submit tasks to Codex Cloud for background execution in sandboxed containers.

**Parameters**:
- `task` (required): Task description for Codex Cloud
- `envId` (required): Environment ID from Codex Cloud settings
- `attempts` (optional): Number of assistant attempts (best-of-N), defaults to 1
- `model` (optional): OpenAI model (`gpt-4o`, `o1`, `o3-mini`, etc.)

**Example - Submit Security Audit**:
```json
{
  "task": "Run comprehensive security audit on all API endpoints and report vulnerabilities",
  "envId": "env_abc123xyz"
}
```

**Example - Long-Running Build**:
```json
{
  "task": "Run full test suite, fix any failures, and create PR with fixes",
  "envId": "env_abc123xyz",
  "attempts": 3,
  "model": "o3-mini"
}
```

**Output**:
```
🚀 Task Submitted to Codex Cloud

**Task ID**: task-2025-11-11-abc123
**Monitor**: https://chatgpt.com/codex/tasks/task-2025-11-11-abc123

**Environment**: env_abc123xyz
**Task**: Run comprehensive security audit...

**Status**: Running in background
**Device Independence**: Task continues even if you close Claude Code

✅ **Task Registered**: Automatically tracked in persistent storage
**List Tasks**: Use `codex_cloud_list_tasks` to view all your cloud tasks
**Check Status**: Use `codex_cloud_status` with taskId="task-2025-11-11-abc123"
**Get Results**: Use `codex_cloud_results` with taskId="task-2025-11-11-abc123" (when complete)

**Web UI**: https://chatgpt.com/codex (view all tasks)
**CLI**: `codex cloud` (browse tasks in terminal)

✅ You can continue working on other tasks. The cloud task runs independently.
✅ Task will be tracked even if Claude Code restarts.
```

**Key Benefits**:
- ✅ **Background Execution**: Task runs in cloud, doesn't block Claude Code
- ✅ **Auto-Tracking**: Task ID automatically stored for later retrieval (v1.3.0)
- ✅ **Persistence**: Continues even if you close Claude Code or restart your machine
- ✅ **Device Independence**: Check status from web, CLI, or mobile app
- ✅ **Sandboxed Containers**: Isolated environment with defined dependencies
- ✅ **Long-Running Tasks**: Perfect for builds, tests, security audits (no timeouts)

---

### Tool 6: `codex_cloud_list_tasks` 🆕 (List Tracked Tasks)

List all cloud tasks tracked in persistent storage with filtering options.

**Parameters** (all optional):
- `workingDir` (optional): Filter by working directory (defaults to current directory)
- `envId` (optional): Filter by Codex Cloud environment ID
- `status` (optional): Filter by status (`submitted`, `completed`, `failed`, `cancelled`)
- `limit` (optional): Maximum number of tasks to return (default: 50)
- `showStats` (optional): Include statistics about all tracked tasks (default: false)

**Example - List Current Directory's Tasks**:
```json
{}
```

**Example - Filter by Status**:
```json
{
  "status": "submitted",
  "limit": 10
}
```

**Example - View All Tasks with Stats**:
```json
{
  "showStats": true,
  "limit": 100
}
```

**Output**:
```
📋 Codex Cloud Tasks

**Total Tasks**: 15
**By Status**: submitted (3), completed (10), failed (2)

**Filtered Results**: 3 tasks
**Working Directory**: /Users/nathanschram/claude-code-tools/illustrations/main

---

### task-2025-11-11-abc123

- **Task**: Train LoRA model on tier1_dataset with 1000 steps
- **Environment**: env_illustrations
- **Status**: 🟡 submitted
- **Submitted**: 2 hours ago (2025-11-11 14:00:00)
- **Model**: gpt-4o
- **Web UI**: https://chatgpt.com/codex/tasks/task-2025-11-11-abc123

### task-2025-11-11-def456

- **Task**: Run comprehensive security audit
- **Environment**: env_illustrations
- **Status**: 🟡 submitted
- **Submitted**: 30 minutes ago (2025-11-11 15:30:00)
- **Web UI**: https://chatgpt.com/codex/tasks/task-2025-11-11-def456

---

**Actions**:
- Check status: `codex_cloud_status` with taskId
- Get results: `codex_cloud_results` with taskId
- Filter by status: Add `status` parameter
- View stats: Add `showStats: true`
```

**Key Benefits**:
- ✅ **Automatic Filtering**: Shows only tasks from current working directory
- ✅ **Multi-Instance Isolation**: Each project sees only its own tasks
- ✅ **Restart Recovery**: Tasks persist across Claude Code sessions
- ✅ **Full History**: Complete audit trail with timestamps and metadata
- ✅ **Flexible Queries**: Filter by status, environment, or working directory

---

### Tool 7: `codex_cloud_status` (Check Cloud Tasks)

Check status of Codex Cloud tasks.

**Parameters**:
- `taskId` (optional): Specific task ID to check
- `showAll` (optional): Show all tasks instead of specific task

**Example - Check Specific Task**:
```json
{
  "taskId": "task-2025-11-11-abc123"
}
```

**Example - View All Tasks**:
```json
{
  "showAll": true
}
```

**Output**:
```
📊 Codex Cloud Task Status

**Task ID**: task-2025-11-11-abc123

**Check Status**:
1. **Web UI**: https://chatgpt.com/codex/tasks/task-2025-11-11-abc123
2. **CLI**: Run `codex cloud` and search for task ID
3. **Mobile**: Open ChatGPT app → Codex → Tasks

**Task States**:
- 🟡 **Queued**: Waiting to start
- 🔵 **Running**: Currently executing
- 🟢 **Completed**: Finished successfully
- 🔴 **Failed**: Encountered errors

**Note**: Codex Cloud TUI is interactive and not yet scriptable via MCP.
Use web UI for programmatic status checks until SDK support is added.
```

---

### Tool 8: `codex_cloud_results` (View Cloud Results)

Get results of completed Codex Cloud tasks.

**Parameters**:
- `taskId` (required): Task ID to get results for

**Example**:
```json
{
  "taskId": "task-2025-11-11-abc123"
}
```

**Output**:
```
📄 Codex Cloud Task Results

**Task ID**: task-2025-11-11-abc123

**View Results**:
1. **Web UI**: https://chatgpt.com/codex/tasks/task-2025-11-11-abc123
   - View full output, diffs, and PR links
   - Download artifacts if available

2. **CLI Browse**: Run `codex cloud` and navigate to task
   - Interactive TUI with full task details

3. **Apply Changes Locally**:
   - If task created PR: Review and merge on GitHub
   - If changes available: Use `codex cloud` to apply locally

**Next Steps**:
- Review changes in web UI
- Create PR if task suggests changes
- Run follow-up tasks if needed

**Note**: Full result parsing requires Codex SDK integration (future enhancement).
Currently, use web UI for complete results.
```

---

### Tool 9: `codex_local_exec` 🆕 (Local Execution with SDK)

Execute Codex tasks locally with real-time event streaming via TypeScript SDK.

**Parameters**:
- `task` (required): Task description for Codex
- `workingDir` (optional): Working directory (defaults to current directory)
- `mode` (optional): Execution mode (`read-only` (default), `full-auto`, `danger-full-access`)
- `outputSchema` (optional): JSON Schema for structured output
- `skipGitRepoCheck` (optional): Skip Git repository check (default: false)
- `model` (optional): OpenAI model (`gpt-5-codex`, `gpt-5`, etc.)

**Example - Analyze with Real-Time Progress**:
```json
{
  "task": "Analyze all TypeScript files for potential bugs and performance issues",
  "mode": "read-only"
}
```

**Example - With Structured Output**:
```json
{
  "task": "Find all TODO comments in the codebase",
  "outputSchema": {
    "type": "object",
    "properties": {
      "todos": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "file": { "type": "string" },
            "line": { "type": "number" },
            "text": { "type": "string" }
          }
        }
      }
    }
  }
}
```

**Output**:
```
✅ Codex Local Execution Completed

**Thread ID**: thread_abc123xyz
**Final Response**: Found 12 potential bugs across 8 TypeScript files...

**Token Usage**:
- Input: 2,500 tokens (1,200 cached)
- Output: 800 tokens

**Events Captured**: 25 events
- turn.started
- item.completed (15x)
- turn.completed

**Next Steps**:
- Resume thread: Use `codex_local_resume` with threadId="thread_abc123xyz"
- Review full event log for detailed progress
```

**Key Benefits**:
- ✅ **Real-Time Visibility**: See exactly what Codex is doing as it happens
- ✅ **Thread Resumption**: Continue conversations across Claude Code sessions
- ✅ **Full Event Stream**: Access all turn events, not just final output
- ✅ **Token Tracking**: Monitor usage and cost in real-time
- ✅ **Structured Output**: Get programmatic responses via JSON Schema
- ✅ **Local Execution**: Runs on your Mac with local filesystem access

**When to Use Local vs Cloud**:
- **Use Local** when you want real-time progress visibility
- **Use Cloud** for long-running tasks (tests, builds, complex refactoring)
- **Use Local** for iterative development with multiple follow-ups
- **Use Cloud** for fire-and-forget background tasks

---

### Tool 10: `codex_local_resume` 🆕 (Resume Local Thread)

Resume a previous local thread with follow-up tasks and full conversation context.

**Parameters**:
- `threadId` (required): Thread ID from previous `codex_local_exec` execution
- `task` (required): Follow-up task to execute
- `mode` (optional): Execution mode (defaults to previous thread's mode)
- `outputSchema` (optional): JSON Schema for structured output

**Example - Continue Analysis**:
```json
{
  "threadId": "thread_abc123xyz",
  "task": "Now fix the most critical bug you found in the previous analysis"
}
```

**Example - Iterative Refactoring**:
```json
{
  "threadId": "thread_abc123xyz",
  "task": "Apply the refactoring to the next 3 files in the same pattern",
  "mode": "full-auto"
}
```

**Output**:
```
✅ Thread Resumed Successfully

**Thread ID**: thread_abc123xyz (continued)
**Final Response**: Fixed critical null pointer dereference in utils.ts...

**Files Modified** (1):
- modified: `src/utils.ts`

**Token Usage**:
- Input: 3,200 tokens (2,800 cached)
- Output: 600 tokens

**Events Captured**: 18 events

**Context Preserved**: Full conversation history maintained across sessions
```

**Key Benefits**:
- ✅ **Context Preservation**: Codex remembers entire conversation history
- ✅ **Iterative Development**: Break large tasks into multiple steps
- ✅ **Session Persistence**: Threads survive Claude Code restarts
- ✅ **Token Efficiency**: Previous context is cached for cost savings
- ✅ **Follow-Up Questions**: Ask clarifying questions without repeating context

**Use Cases**:
- Multi-step refactoring (analyze → plan → apply)
- Iterative bug fixes (find → fix → test)
- Code reviews with follow-ups (review → explain → suggest)
- Exploratory analysis (investigate → deeper dive → conclusions)

**Thread Storage**: Threads are stored in `~/.codex/sessions` and persist until explicitly deleted.

---

### Tool 11: `codex_cloud_check_reminder` 🆕 (Check Pending Cloud Tasks)

Check for pending Codex Cloud tasks and get Web UI links for status checking.

**Parameters**: None

**Example**:
```json
{}
```

**Output - With Pending Tasks**:
```
⏳ You have 3 pending Cloud tasks

**Pending Tasks**:

### task-2025-11-11-abc123
- **Environment**: env_illustrations
- **Task**: Train LoRA model on tier1_dataset with 1000 steps...
- **Submitted**: 45 minutes ago (2025-11-11 14:15:00)
- **Check Status**: https://chatgpt.com/codex/tasks/task-2025-11-11-abc123

### task-2025-11-11-def456
- **Environment**: env_seo_ads
- **Task**: Run comprehensive security audit on all API endpoints...
- **Submitted**: 2 hours ago (2025-11-11 12:00:00)
- **Check Status**: https://chatgpt.com/codex/tasks/task-2025-11-11-def456

### task-2025-11-11-ghi789
- **Environment**: env_notebridge
- **Task**: Implement WebSocket support and create integration tests...
- **Submitted**: 4 hours ago (2025-11-11 10:00:00)
- **Check Status**: https://chatgpt.com/codex/tasks/task-2025-11-11-ghi789

**Actions**:
- Click Web UI links to check current status
- Use `codex_cloud_results` when tasks complete
- Check back periodically for updates
```

**Output - No Pending Tasks**:
```
✅ No pending Cloud tasks. All submitted tasks have been checked or completed.
```

**Key Benefits**:
- ✅ **Organized Tracking**: See all pending tasks in one place
- ✅ **Direct Links**: Click to check status without searching
- ✅ **Time Context**: Know how long tasks have been running
- ✅ **Persistent Registry**: Survives Claude Code restarts

**Use Cases**:
- Periodic checks during development
- Morning review of overnight tasks
- Before submitting new tasks (check queue)
- After long breaks (catch up on task status)

**Behind the Scenes**: Reads from `~/.config/codex-control/cloud-tasks.json` and filters for tasks with `status='submitted'`.

---

### Tool 12: `codex_list_environments` 🆕 (List Available Environments)

List available Codex Cloud environments from local configuration.

**Parameters**: None

**Example**:
```json
{}
```

**Output - With Environments**:
```
✅ 3 environments configured

**Available Environments**:

### seo-ads-expert-online
- **Name**: SEO Ads Expert
- **Repository**: https://github.com/littlebearapps/seo-ads-expert
- **Stack**: node
- **Description**: SEO and Google Ads automation tool

### illustrations-training
- **Name**: Illustrations Training
- **Repository**: https://github.com/littlebearapps/illustrations
- **Stack**: python
- **Description**: Kohya LoRA training with Runpod integration

### notebridge-dev
- **Name**: NoteBridge Development
- **Repository**: https://github.com/littlebearapps/notebridge
- **Stack**: node
- **Description**: Chrome extension for note-taking

**Usage**:
- Use environment IDs with `codex_cloud_submit`
- Example: `{ "task": "...", "envId": "seo-ads-expert-online" }`

**Configuration**: `/Users/nathanschram/.config/codex-control/environments.json`
```

**Output - No Environments**:
```
⚠️ Environment config not found. Create ~/.config/codex-control/environments.json to define environments.

**Example Configuration**:
{
  "seo-ads-expert-online": {
    "name": "SEO Ads Expert",
    "repoUrl": "https://github.com/littlebearapps/seo-ads-expert",
    "stack": "node",
    "description": "SEO and Google Ads automation tool"
  },
  "illustrations-training": {
    "name": "Illustrations Training",
    "repoUrl": "https://github.com/littlebearapps/illustrations",
    "stack": "python",
    "description": "Kohya LoRA training with Runpod integration"
  }
}
```

**Key Benefits**:
- ✅ **Local Registry**: Track all your Codex Cloud environments
- ✅ **Quick Reference**: See environment IDs without Web UI
- ✅ **Metadata**: Store descriptions, repo URLs, and tech stacks
- ✅ **Discoverable**: Claude Code can see all available environments

**Use Cases**:
- Starting new project (which environment to use?)
- Reviewing configured environments
- Planning task submissions
- Documentation of environment structure

**Setup**:
1. Create config directory: `mkdir -p ~/.config/codex-control`
2. Create config file: `~/.config/codex-control/environments.json`
3. Add environment definitions (see example above)
4. Use `codex_list_environments` to verify

**Note**: No programmatic API exists for environment discovery from Codex Cloud - this tool uses a user-maintained local config file.

---

### Tool 13: `codex_github_setup_guide` 🆕 (GitHub Integration Helper)

Generate custom GitHub integration guide for Codex Cloud environments with autonomous setup instructions.

**Parameters**:
- `repoUrl` (required): GitHub repository URL (e.g., `https://github.com/user/repo`)
- `stack` (required): Technology stack (`node`, `python`, `go`, `rust`)
- `gitUserName` (optional): Git user name (defaults to "Codex Agent")
- `gitUserEmail` (optional): Git user email (defaults to "codex@example.com")

**Example - Node.js Project**:
```json
{
  "repoUrl": "https://github.com/myorg/my-project",
  "stack": "node",
  "gitUserName": "Your Name",
  "gitUserEmail": "your@email.com"
}
```

**Example - Python Project**:
```json
{
  "repoUrl": "https://github.com/myorg/data-pipeline",
  "stack": "python"
}
```

**Output - Complete Setup Guide**:
The tool generates a comprehensive 8-section guide (400+ lines) customized for your repository:

**📝 Repository Configuration**:
- Repository URL and technology stack
- Template selected based on stack

**🔐 Step 1: Create Fine-Grained GitHub Token**:
- Direct link to token creation page
- Token name pre-filled with repository name
- Exact permissions required (Contents, Pull requests, Workflows)
- Repository access configuration
- Security reminders

**⚙️ Step 2: Configure Codex Cloud Environment**:
- Environment name suggestion
- Repository URL and branch configuration
- Secrets configuration (GITHUB_TOKEN)
- Environment variables (GIT_USER_NAME, GIT_USER_EMAIL, stack-specific)
- **Pre-filled Setup Script** (from template, ready to copy-paste)
- **Pre-filled Maintenance Script** (from template, ready to copy-paste)

**✅ Step 3: Test GitHub Integration**:
- Test task JSON (ready to use with `codex_cloud_submit`)
- Expected results checklist
- Verification steps

**🔧 Troubleshooting**:
- Authentication failed (4 solutions with test commands)
- GitHub CLI not found (3 solutions with verification)
- Can't create pull request (5 solutions)
- Setup script failed (5 common causes)

**📚 Next Steps**:
- Autonomous PR workflow examples (feature dev, bug fixes, refactoring)
- Best practices for task descriptions
- Learning resources

**Key Benefits**:
- ✅ **Zero External Documentation**: Everything needed in one guide
- ✅ **Repository-Specific**: Customized for your project
- ✅ **Copy-Paste Ready**: Setup scripts pre-filled from templates
- ✅ **Test Verification**: Includes test task to verify setup
- ✅ **Troubleshooting**: Common issues with solutions
- ✅ **Technology-Aware**: Stack-specific environment variables and setup
- ✅ **Security-First**: Fine-grained permissions, no hardcoded secrets

**Use Case - Complete Autonomous Setup**:
1. User asks Claude Code: "Help me set up GitHub integration for my Node.js project"
2. Claude Code calls: `codex_github_setup_guide` with repository URL and stack
3. User receives complete guide with pre-filled scripts
4. User follows guide, configures Codex Cloud environment
5. User tests with provided test task
6. Result: Fully autonomous GitHub PR workflow enabled

**Behind the Scenes**:
- Loads appropriate template (`github-node`, `github-python`, etc.)
- Extracts repository details (owner, name)
- Customizes git configuration
- Generates stack-specific environment variables
- Pre-fills setup and maintenance scripts from template
- Creates test task with expected results

**Error Handling**:
- Repository URL validation (must be GitHub)
- Stack validation (must be supported)
- Template lookup failure (clear error with supported stacks)

---

## GitHub Integration (v2.0.0)

### Complete Autonomous Workflow

Codex Control v2.0.0 enables Claude Code to autonomously guide users through complete GitHub PR workflows without requiring external documentation.

**Three-Phase Approach**:

**Phase 1: Enhanced Tool Schemas** (v1.4.0)
- Comprehensive tool descriptions with PREREQUISITES, WORKFLOW, BEST PRACTICES
- Token budget: 1,051 / 3,000 tokens (35% usage)
- All Codex Cloud tools fully documented

**Phase 2: Environment Templates** (v1.5.0)
- 5 pre-configured templates for different technology stacks
- 4-level fallback error handling for GitHub CLI installation
- Pre-written setup and maintenance scripts
- Exposed via MCP resources for discovery

**Phase 3: Setup Helper Tool** (v2.0.0)
- Interactive guide generator (`codex_github_setup_guide`)
- Repository-specific configuration
- Pre-filled scripts from templates
- Test tasks with expected results

### Quick Start: GitHub Integration

**Step 1: Ask Claude Code**:
```
"Help me set up GitHub integration for my Node.js project at https://github.com/myorg/my-project"
```

**Step 2: Claude Code Responds**:
- Calls `codex_github_setup_guide` tool
- Generates complete setup guide
- Provides pre-filled scripts
- Includes test task

**Step 3: Follow the Guide**:
- Create fine-grained GitHub token
- Configure Codex Cloud environment
- Run test task to verify setup

**Step 4: Start Using Autonomous Workflows**:
```json
{
  "task": "Create feature branch 'feature/add-auth', implement JWT authentication with tests, create PR titled 'Add JWT Authentication'",
  "envId": "your-environment-id"
}
```

**Result**: Fully autonomous GitHub PR workflow - from branch creation to PR submission!

### Template Features

All GitHub templates include:

**4-Level Fallback Error Handling**:
- Level 1: Standard APT installation
- Level 2: Direct binary download
- Level 3: Graceful degradation (warn and continue)
- Level 4: Clear manual installation instructions

**Why 4-level fallback?**
- Codex Cloud containers may have network restrictions
- Different base images may have different package managers
- Core workflows (clone, commit, push) work even if gh CLI fails
- Clear instructions help users fix issues manually

**Security**:
- Fine-grained token permissions (repository-scoped)
- No hardcoded credentials
- Secrets vs environment variables clearly distinguished
- Automated validation (CI checks for hardcoded secrets)

**Maintenance**:
- Setup script: Initial environment configuration
- Maintenance script: Dependency updates for cached containers
- Version pinning for stability

---

## Codex Cloud Setup

### 1. Configure Environments

Codex Cloud environments define the execution context (dependencies, secrets, setup scripts).

**Setup via Web UI**:
1. Visit https://chatgpt.com/codex/settings/environments
2. Create new environment for your project
3. Configure:
   - **Name**: Descriptive name (e.g., "NoteBridge Development")
   - **Dependencies**: `package.json`, `requirements.txt`, etc.
   - **Secrets**: API keys, database URLs (encrypted)
   - **Setup Script**: Initialization commands
   - **Internet Access**: Off/Limited/Full

**Get Environment ID**:
```bash
# Option 1: Browse in terminal
codex cloud

# Option 2: Check web UI
# Visit https://chatgpt.com/codex/settings/environments
# Copy ENV_ID from environment details
```

### 2. Submit Tasks via Claude Code

Once environments are configured:

```typescript
// Via Claude Code MCP tool
{
  "task": "Run security audit and create report",
  "envId": "env_abc123xyz"  // From Codex Cloud settings
}
```

### 3. Monitor Tasks

**Web UI** (recommended):
- https://chatgpt.com/codex - All tasks
- https://chatgpt.com/codex/tasks/{taskId} - Specific task

**CLI TUI**:
```bash
codex cloud  # Interactive browser
```

**Mobile App**:
- ChatGPT app → Codex → Tasks

**Limitations**:
- ❌ Environment configuration has NO programmatic API (web UI only)
- ❌ `codex cloud` TUI is interactive-only (not scriptable yet)
- ✅ Task submission is fully scriptable via `codex cloud exec`

---

## Architecture

### High-Level Flow

**Local Execution via CLI** (blocking, Tools 1-4):
```
┌─────────────────┐
│  Claude Code    │
│  (MCP Client)   │
└────────┬────────┘
         │ MCP Protocol
         │ (stdio transport)
         ▼
┌─────────────────┐
│ codex-control   │
│  MCP Server     │
│  (TypeScript)   │
└────────┬────────┘
         │ spawn (no shell)
         ▼
┌─────────────────┐
│  codex exec     │
│  --json CLI     │
│  (local)        │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  ChatGPT Pro    │
│  (or API key)   │
└─────────────────┘
```

**Local Execution via SDK** 🆕 (async streaming, Tools 9-10):
```
┌─────────────────┐
│  Claude Code    │
│  (MCP Client)   │
└────────┬────────┘
         │ MCP Protocol
         │ (stdio transport)
         ▼
┌─────────────────┐
│ codex-control   │
│  MCP Server     │
│  (TypeScript)   │
└────────┬────────┘
         │ Import @openai/codex-sdk
         ▼
┌─────────────────┐
│  Codex SDK      │
│  (TypeScript)   │
│  - startThread()│
│  - resumeThread()│
│  - runStreamed()│
└────────┬────────┘
         │ Wraps CLI + manages sessions
         ▼
┌─────────────────┐
│  codex CLI      │
│  (local exec)   │
└────────┬────────┘
         │ Event streaming
         ▼
┌─────────────────┐
│  ChatGPT Pro    │
│  (or API key)   │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Thread Storage │
│  ~/.codex/      │
│  sessions/      │
└─────────────────┘
```

**Codex Cloud** (background, Tools 5-8):
```
┌─────────────────┐
│  Claude Code    │
│  (MCP Client)   │
└────────┬────────┘
         │ MCP Protocol
         │ (stdio transport)
         ▼
┌─────────────────┐
│ codex-control   │
│  MCP Server     │
│  (TypeScript)   │
└────────┬────────┘
         │ spawn (no shell)
         ▼
┌─────────────────┐
│ codex cloud exec│
│  (returns taskID│
│   immediately)  │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Codex Cloud    │
│  (Sandboxed     │
│   Containers)   │
└─────────────────┘
         │
         ▼
    (Monitor via web UI,
     CLI, or mobile app)
```

### Components

**Executor**:
- `jsonl_parser.ts` - Tolerant JSONL event stream parser
- `process_manager.ts` - Process spawning, concurrency queue
- `error_mapper.ts` - Error mapping to MCP format

**Security**:
- `input_validator.ts` - Input validation, sanitization
- `redactor.ts` - Secret scrubbing (15+ patterns)

**Tools**:
- `run.ts` - Read-only execution (local CLI)
- `plan.ts` - Preview mode (local CLI)
- `apply.ts` - Mutation with gating (local CLI)
- `status.ts` - Server status (local CLI)
- `local_exec.ts` - 🆕 Local execution via SDK with streaming
- `local_resume.ts` - 🆕 Thread resumption with context preservation
- `cloud.ts` - Cloud task submission, status, and results
- `cloud_check_reminder.ts` - 🆕 Pending task reminder with Web UI links
- `list_environments.ts` - 🆕 Environment registry listing
- `github_setup.ts` - GitHub integration setup guide

**Server**:
- `index.ts` - MCP server entry point

---

## Security

### Input Validation

- **Task Length**: Max 10,000 characters
- **Mode Whitelist**: Only `read-only`, `full-auto`, `danger-full-access`
- **Model Whitelist**: Known OpenAI models (`gpt-4o`, `o1`, `o3-mini`, etc.)
- **Path Validation**: No path traversal (`..`), absolute paths only
- **No Shell Injection**: Uses `spawn(cmd, args)` not `exec(string)`

### Secret Redaction

Automatically scrubs 15+ sensitive patterns:
- OpenAI API keys (`sk-...`)
- AWS credentials (`AKIA...`)
- GitHub tokens (`ghp_...`, `gho_...`)
- JWT tokens
- Private keys
- Passwords
- Database connection strings

**Example**:
```typescript
// Before redaction
OPENAI_API_KEY=sk-proj-abc123...

// After redaction
OPENAI_API_KEY=sk-***REDACTED***
```

### Mutation Gating

File-modifying modes require explicit confirmation:

```typescript
// This fails
{ task: "modify files", mode: "full-auto", confirm: false }

// This succeeds
{ task: "modify files", mode: "full-auto", confirm: true }
```

### Environment Variable Policy

Control which environment variables are passed to Codex Cloud execution:

**Three Modes**:
1. **`inherit-none`** (default, most secure) - No environment variables passed
2. **`inherit-all`** (convenient, less secure) - All environment variables passed
3. **`allow-list`** (recommended) - Only specified variables passed

**Example - Allow-List (Recommended)**:
```json
{
  "task": "Run integration tests",
  "envPolicy": "allow-list",
  "envAllowList": ["DATABASE_URL", "API_KEY", "TEST_ENV"]
}
```

**Example - Inherit All (Use with Caution)**:
```json
{
  "task": "Deploy to staging",
  "envPolicy": "inherit-all"
}
```

**Integration with Keychain**:
When using `direnv` with macOS Keychain secrets (via `kc.sh`), all secrets are automatically loaded into the MCP server's environment. Use `envPolicy='allow-list'` to selectively pass only required secrets to Codex Cloud execution.

---

## Troubleshooting

### Codex CLI Not Found

```bash
# Install Codex CLI
npm install -g @openai/codex

# Verify installation
which codex
codex --version
```

### Authentication Errors

```bash
# Check auth status
codex auth status

# Re-authenticate
codex auth

# Or set API key
export CODEX_API_KEY=sk-proj-...
```

### MCP Server Not Discovered

```bash
# Check MCP configuration
cat ~/.claude/config/.mcp.json

# Test server manually
node /Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control/dist/index.js

# Restart Claude Code
# MCP servers are discovered on startup
```

### TypeScript Build Errors

```bash
cd /Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control

# Clean build
rm -rf dist node_modules
npm install
npm run build
```

---

## Development

### Project Structure

```
codex-control/
├── package.json              # Dependencies, scripts
├── tsconfig.json             # TypeScript config
├── jest.config.js            # Jest test config
├── config.json               # Server metadata
├── README.md                 # This file
├── .mcp-config-template.json # MCP config template
├── src/
│   ├── index.ts             # MCP server entry
│   ├── executor/
│   │   ├── jsonl_parser.ts  # Event stream parser
│   │   ├── process_manager.ts # Process spawning
│   │   └── error_mapper.ts  # Error handling
│   ├── security/
│   │   ├── input_validator.ts # Input validation
│   │   └── redactor.ts      # Secret scrubbing
│   └── tools/
│       ├── run.ts           # codex_run tool (local)
│       ├── plan.ts          # codex_plan tool (local)
│       ├── apply.ts         # codex_apply tool (local)
│       ├── status.ts        # codex_status tool (local)
│       └── cloud.ts         # codex_cloud_* tools (cloud)
└── dist/                     # Compiled output
```

### Build Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode
npm run watch

# Run tests (when implemented)
npm test

# Run server directly
npm start
```

---

## v2.0 Enhancement Plan

### ✅ Phase 1: Enhanced Tool Schemas (v1.4.0) - Complete

**Delivered**:
- Comprehensive tool descriptions with structured sections
- PREREQUISITES, WORKFLOW, BEST PRACTICES for all Codex Cloud tools
- Token budget: 1,051 / 3,000 tokens (35% usage, 65% headroom)
- All schemas validated and passing CI

**Impact**: Claude Code can now understand complete workflows autonomously

### ✅ Phase 2: Environment Templates (v1.5.0) - Complete

**Delivered**:
- 5 production-ready environment templates
- 4-level fallback error handling
- MCP resources for template discovery
- Comprehensive template validation (Python + CI)
- Security checks (no hardcoded secrets)

**Impact**: Pre-configured GitHub integration for all major technology stacks

### ✅ Phase 3: Setup Helper Tool (v2.0.0) - Complete

**Delivered**:
- Interactive guide generator (`codex_github_setup_guide`)
- Repository-specific configuration
- Pre-filled scripts from templates
- Test tasks with expected results
- Comprehensive troubleshooting

**Impact**: Zero external documentation required for GitHub integration setup

### 🎉 Result: Complete Autonomous GitHub Workflow

All three phases complete! Claude Code can now:
1. ✅ Understand complete workflows (enhanced schemas)
2. ✅ Access pre-configured templates (MCP resources)
3. ✅ Guide users through setup (interactive tool)
4. ✅ Execute autonomous PR workflows (Codex Cloud)

**No external documentation required** - everything is discoverable through MCP!

---

## Known Limitations & Workarounds

### v2.1.0 Limitations

#### 1. Thread Resumption Git Repository Check ⚠️

**Issue**: The `codex_local_resume` tool cannot skip git repository validation when resuming threads.

**⭐ IMPORTANT**: **This limitation does NOT affect typical Claude Code workflows!** If you're developing in git repositories (which most users are), you won't encounter this issue.

---

**What is a "Trusted Git Directory"?**

A "trusted directory" means:
1. ✅ The directory contains a `.git` folder (is a git repository)
2. ✅ It's not in a potentially dangerous location (like `/`, `/usr/bin/`, etc.)

**Quick Check**:
```bash
# Check if your directory is trusted:
ls -la .git
# See ".git/" folder? = Trusted ✅

# OR
git rev-parse --git-dir
# Success? = Trusted ✅
```

**For Claude Code Users**: All your project directories are already trusted git repositories! Examples:
- ✅ `/Users/nathanschram/claude-code-tools/` - git repo
- ✅ `/Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control/` - git repo
- ✅ `/Users/nathanschram/claude-code-tools/illustrations/` - git repo
- ✅ Any project using feature branches - git repo

**You won't hit this limitation in normal development!**

---

**Root Cause**: The Codex SDK's `resumeThread()` method doesn't accept a `skipGitRepoCheck` option, unlike `startThread()` which does. This is an SDK limitation, not a bug in our implementation.

**When You WOULD Hit This**:
- ❌ Running in `/Users/yourname/Downloads` (not a git repo)
- ❌ Running in `/tmp/random-directory` (not a git repo)
- ❌ Testing in non-git directories without `skipGitRepoCheck`

**Impact**:
- ✅ **Zero impact for git-based workflows** (99% of Claude Code usage)
- ⚠️ **Medium impact for non-git contexts** (rare edge case)

**Workaround** (only needed if NOT in a git repo):
```bash
# Option 1: Initialize git in your directory (recommended)
cd /path/to/your/project
git init
# Now it's trusted and codex_local_resume works!

# Option 2: Use codex_local_exec with skipGitRepoCheck for one-shot tasks
# (Don't rely on resumption if you need to skip git checks)

# Option 3: Use Cloud execution for non-git contexts
# codex_cloud_submit doesn't have this limitation
```

**Example Error** (only in non-git directories):
```
Codex Exec exited with code 1:
Not inside a trusted directory and --skip-git-repo-check was not specified.
```

**Why This Exists**: Codex CLI has a safety mechanism to prevent accidental command execution in random directories. It requires either:
- A git repository (trusted context), OR
- Explicit `skipGitRepoCheck: true` flag

**The Problem**:
- ✅ `codex_local_exec` can use `skipGitRepoCheck: true`
- ❌ `codex_local_resume` cannot (SDK doesn't support it)

**Test Results**: In our v2.1.0 testing, we ran tests in a git repository but used `skipGitRepoCheck: true` for the initial call. When resuming, the SDK re-checked and couldn't skip. **In normal git repos without skipGitRepoCheck, this works fine.**

**Future**: This will be resolved if/when OpenAI adds configuration options to `resumeThread()` in the SDK.

---

#### 2. Cloud Task Status Polling (Partially Mitigated) ℹ️

**Issue**: No programmatic API exists for polling Codex Cloud task status.

**Impact**:
- ✅ **Mitigated in v2.1.0** by `codex_cloud_check_reminder` tool
- Users get organized view with Web UI links
- Still requires manual Web UI checking for detailed status

**Workaround**:
```typescript
// Use the reminder tool to see all pending tasks
await codex_cloud_check_reminder()

// Output includes:
// - Task IDs
// - Environment IDs
// - Time elapsed
// - Direct Web UI links for each task

// Then click Web UI links to check detailed status:
// https://chatgpt.com/codex/tasks/{taskId}
```

**User Experience**: Instead of searching through Web UI manually, you get an organized list with direct links and time context.

---

#### 3. Environment Discovery (Partially Mitigated) ℹ️

**Issue**: No programmatic API exists for listing Codex Cloud environments.

**Impact**:
- ✅ **Mitigated in v2.1.0** by `codex_list_environments` tool
- Requires manual config file maintenance
- Environment creation still requires Web UI

**Workaround**:
```bash
# Step 1: Create config directory
mkdir -p ~/.config/codex-control

# Step 2: Create environments config
cat > ~/.config/codex-control/environments.json << 'EOF'
{
  "your-env-id": {
    "name": "Your Environment Name",
    "repoUrl": "https://github.com/user/repo",
    "stack": "node",
    "description": "Your project description"
  }
}
EOF

# Step 3: Use the tool to list environments
# Now codex_list_environments will return your environments
```

**User Experience**: Quick reference of all environments without Web UI access. Claude Code can discover and use environments programmatically.

---

#### 4. Codex Cloud TUI Not Scriptable ℹ️

**Issue**: The `codex cloud` TUI (Terminal User Interface) is interactive-only and not scriptable.

**Impact**:
- ✅ **No impact on MCP usage** - We use `codex cloud exec` for submissions
- ⚠️ **Cannot parse TUI output** programmatically

**Workaround**:
- Use Web UI links from `codex_cloud_check_reminder`
- Use `codex cloud exec` for task submission (already implemented)
- Monitor via Web UI at https://chatgpt.com/codex

---

### General Limitations (All Versions)

#### Authentication

**Issue**: Requires ChatGPT Pro subscription or `CODEX_API_KEY` environment variable.

**Workaround**:
```bash
# Option 1: Use ChatGPT Pro (automatic auth)
# No setup needed - just log in

# Option 2: Set API key manually
export CODEX_API_KEY=sk-proj-...
```

---

#### Concurrency

**Issue**: Local execution is single-threaded per MCP server instance.

**Impact**: Multiple concurrent `codex_local_exec` calls will queue.

**Workaround**:
- Use `CODEX_MAX_CONCURRENCY` environment variable (default: 2)
- For parallel execution, use multiple Cloud tasks via `codex_cloud_submit`

---

### Comparison: Local SDK vs Cloud Execution

When choosing between local and cloud execution, consider these trade-offs:

| Feature | Local SDK | Cloud |
|---------|-----------|-------|
| **Git Repo Requirement** | ⚠️ Yes (for resume) | ✅ No |
| **Real-Time Status** | ✅ Full visibility | ❌ Web UI only |
| **Long-Running Tasks** | ⚠️ Blocks MCP | ✅ Background |
| **Thread Resumption** | ✅ Yes (in git repos) | ❌ No |
| **Token Visibility** | ✅ Full tracking | ❌ No visibility |
| **Best For** | Iterative dev in repos | Long tasks, any context |

**Recommendation**:
- Use **Local SDK** for iterative development in git repositories
- Use **Cloud** for long-running tasks or non-git contexts
- Use `codex_cloud_check_reminder` to monitor Cloud tasks

---

## Future Enhancements

Potential future enhancements (not planned):

### GitHub Actions Integration
- Run Codex tasks in GitHub Actions workflows
- Environment-scoped secrets
- Scheduled/manual triggers

### Hybrid Architecture
- Intelligent routing (local vs cloud)
- Cost optimization with usage tracking
- Local for quick tasks, cloud for heavy workloads

### SDK Result Parsing
- Programmatic access to Codex Cloud task results
- Automated diff parsing and application
- PR status tracking via API

---

## References

- **Implementation Plan**: `/Users/nathanschram/claude-code-tools/docs/sdk-implementation/CODEX-CONTROL-MCP-IMPLEMENTATION-PLAN.md`
- **OpenAI Codex Docs**: https://developers.openai.com/codex
- **MCP SDK**: https://github.com/modelcontextprotocol/sdk
- **Phase Reports**: `/Users/nathanschram/claude-code-tools/docs/sdk-implementation/`

---

## Support

**Issues**: Report at `/Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control/`
**Author**: Nathan Schram
**License**: MIT

---

**Built with**: TypeScript 5.6, Node.js 20+, MCP SDK 1.0.4
