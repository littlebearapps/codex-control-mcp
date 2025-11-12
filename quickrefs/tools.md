# Tools Quick Reference

Complete guide to all 13 Codex Control MCP tools.

---

## Tool Categories

### Local Execution (CLI-based)
1. `codex_run` - Read-only execution
2. `codex_plan` - Preview changes
3. `codex_apply` - Apply mutations
4. `codex_status` - Server status

### Local Execution (SDK-based) 🆕
5. `codex_local_exec` - Real-time streaming execution
6. `codex_local_resume` - Resume threads

### Cloud Execution
7. `codex_cloud_submit` - Submit background tasks
8. `codex_cloud_list_tasks` - List task registry
9. `codex_cloud_status` - Check task status
10. `codex_cloud_results` - Get task results
11. `codex_cloud_check_reminder` - Pending task reminder

### Configuration & Setup
12. `codex_list_environments` - List environments
13. `codex_github_setup_guide` - GitHub integration guide

---

## When to Use Which Tool

### Quick Analysis (1-5 minutes)
→ Use `codex_run` with `mode='read-only'`
- Code analysis, security audits
- Running tests (read-only)
- No file modifications

### Iterative Development (5-30 minutes)
→ Use `codex_local_exec` + `codex_local_resume`
- Real-time progress visibility
- Follow-up questions
- Thread persistence across sessions
- Token tracking and caching

### Long-Running Tasks (30+ minutes)
→ Use `codex_cloud_submit`
- Full test suites, builds
- Comprehensive refactoring
- Fire-and-forget execution
- Device independence

### Preview Before Apply
→ Use `codex_plan` then `codex_apply`
- See proposed changes first
- Confirm before mutations
- Review diffs

---

## Execution Mode Comparison

| Mode | Tool | Visibility | Persistence | Best For |
|------|------|------------|-------------|----------|
| **Local CLI** | `codex_run` | ❌ Blocking | ❌ No | Quick tasks |
| **Local SDK** | `codex_local_exec` | ✅ Streaming | ✅ Threads | Iterative dev |
| **Cloud** | `codex_cloud_submit` | ❌ Background | ✅ Tasks | Long-running |

---

## Tool Details

### 1. codex_run (Local CLI)

**Purpose**: Execute read-only tasks without file modifications.

**Parameters**:
```typescript
{
  task: string;           // Required: Task description
  mode?: string;          // Optional: 'read-only' (default)
  model?: string;         // Optional: OpenAI model
  workingDir?: string;    // Optional: Working directory
  envPolicy?: string;     // Optional: 'inherit-none' (default)
  envAllowList?: string[]; // Optional: Allowed env vars
}
```

**Example**:
```typescript
{
  "task": "Analyze main.ts for bugs and security issues",
  "mode": "read-only"
}
```

**Use When**:
- ✅ Quick analysis (1-5 minutes)
- ✅ Running tests (read-only)
- ✅ Code reviews
- ✅ Security audits

---

### 2. codex_plan (Local CLI)

**Purpose**: Preview what Codex would do without executing.

**Parameters**:
```typescript
{
  task: string;        // Required: Task to preview
  model?: string;      // Optional: OpenAI model
  workingDir?: string; // Optional: Working directory
}
```

**Example**:
```typescript
{
  "task": "Add error handling to all API endpoints"
}
```

**Use When**:
- ✅ Before `codex_apply` to review changes
- ✅ Learning what Codex would suggest
- ✅ Understanding impact before mutations

---

### 3. codex_apply (Local CLI)

**Purpose**: Execute file-modifying tasks with confirmation.

**Parameters**:
```typescript
{
  task: string;        // Required: Task description
  confirm: boolean;    // Required: Must be true
  mode?: string;       // Optional: 'full-auto' (default)
  model?: string;      // Optional: OpenAI model
  workingDir?: string; // Optional: Working directory
}
```

**Example**:
```typescript
{
  "task": "Add TypeScript types to utils.ts",
  "confirm": true,
  "mode": "full-auto"
}
```

**Use When**:
- ✅ Applying changes after `codex_plan`
- ✅ One-shot mutations
- ✅ Not needing thread persistence

---

### 4. codex_status (Local CLI)

**Purpose**: Get server status and queue information.

**Parameters**: None

**Example**: `{}`

**Use When**:
- ✅ Checking active processes
- ✅ Debugging concurrency issues
- ✅ Monitoring queue status

---

### 5. codex_local_exec (Local SDK) 🆕

**Purpose**: Execute tasks locally with real-time event streaming.

**Parameters**:
```typescript
{
  task: string;              // Required: Task description
  workingDir?: string;       // Optional: Working directory
  mode?: string;             // Optional: 'read-only' (default)
  outputSchema?: object;     // Optional: JSON Schema
  skipGitRepoCheck?: boolean; // Optional: Skip git check
  model?: string;            // Optional: OpenAI model
}
```

**Example**:
```typescript
{
  "task": "Find all TODO comments and list them",
  "mode": "read-only",
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

**Use When**:
- ✅ Iterative development (5-30 minutes)
- ✅ Want real-time progress visibility
- ✅ Need thread persistence for follow-ups
- ✅ Want token tracking and caching

**Returns**: Thread ID for use with `codex_local_resume`

---

### 6. codex_local_resume (Local SDK) 🆕

**Purpose**: Resume previous thread with follow-up tasks.

**Parameters**:
```typescript
{
  threadId: string;       // Required: From codex_local_exec
  task: string;           // Required: Follow-up task
  mode?: string;          // Optional: Inherits from thread
  outputSchema?: object;  // Optional: JSON Schema
}
```

**Example**:
```typescript
{
  "threadId": "thread_abc123xyz",
  "task": "Now fix the most critical bug from the analysis"
}
```

**Use When**:
- ✅ Continuing previous analysis
- ✅ Iterative refactoring
- ✅ Follow-up questions
- ✅ Multi-step workflows

**Note**: Requires git repository (or use `skipGitRepoCheck` in initial exec)

---

### 7. codex_cloud_submit (Cloud)

**Purpose**: Submit tasks to Codex Cloud for background execution.

**Parameters**:
```typescript
{
  task: string;      // Required: Task description
  envId: string;     // Required: Environment ID
  attempts?: number; // Optional: Best-of-N (default: 1)
  model?: string;    // Optional: OpenAI model
}
```

**Example**:
```typescript
{
  "task": "Run full test suite and fix any failures",
  "envId": "env_abc123xyz",
  "attempts": 3
}
```

**Use When**:
- ✅ Long-running tasks (30+ minutes)
- ✅ Fire-and-forget execution
- ✅ Sandboxed environment needed
- ✅ Device independence required

**Auto-Tracked**: Task ID stored in `~/.config/codex-control/cloud-tasks.json`

---

### 8. codex_cloud_list_tasks (Cloud) 🆕

**Purpose**: List all tracked cloud tasks with filtering.

**Parameters**:
```typescript
{
  workingDir?: string;  // Optional: Filter by directory
  envId?: string;       // Optional: Filter by environment
  status?: string;      // Optional: Filter by status
  limit?: number;       // Optional: Max results (default: 50)
  showStats?: boolean;  // Optional: Include stats (default: false)
}
```

**Example**:
```typescript
{
  "status": "submitted",
  "limit": 10
}
```

**Use When**:
- ✅ Reviewing task history
- ✅ Finding task IDs
- ✅ Checking project activity
- ✅ Debugging task issues

---

### 9. codex_cloud_status (Cloud)

**Purpose**: Check status of cloud tasks.

**Parameters**:
```typescript
{
  taskId?: string;   // Optional: Specific task
  showAll?: boolean; // Optional: Show all tasks
}
```

**Example**:
```typescript
{
  "taskId": "task-2025-11-11-abc123"
}
```

**Use When**:
- ✅ Checking if task is complete
- ✅ Getting Web UI links
- ✅ Monitoring progress

---

### 10. codex_cloud_results (Cloud)

**Purpose**: Get results of completed cloud tasks.

**Parameters**:
```typescript
{
  taskId: string; // Required: Task ID
}
```

**Example**:
```typescript
{
  "taskId": "task-2025-11-11-abc123"
}
```

**Use When**:
- ✅ Task is marked as complete
- ✅ Need to view output
- ✅ Want to apply changes locally

---

### 11. codex_cloud_check_reminder (Cloud) 🆕

**Purpose**: Check for pending cloud tasks and get Web UI links.

**Parameters**: None

**Example**: `{}`

**Use When**:
- ✅ Periodic checks during development
- ✅ Morning review of overnight tasks
- ✅ Before submitting new tasks
- ✅ After long breaks

---

### 12. codex_list_environments (Config) 🆕

**Purpose**: List available Codex Cloud environments.

**Parameters**: None

**Example**: `{}`

**Use When**:
- ✅ Starting new project
- ✅ Reviewing configured environments
- ✅ Planning task submissions
- ✅ Documentation of environment structure

**Setup**: Create `~/.config/codex-control/environments.json`

---

### 13. codex_github_setup_guide (Config)

**Purpose**: Generate custom GitHub integration guide.

**Parameters**:
```typescript
{
  repoUrl: string;       // Required: GitHub repo URL
  stack: string;         // Required: 'node', 'python', 'go', 'rust'
  gitUserName?: string;  // Optional: Git user name
  gitUserEmail?: string; // Optional: Git user email
}
```

**Example**:
```typescript
{
  "repoUrl": "https://github.com/myorg/my-project",
  "stack": "node",
  "gitUserName": "Your Name",
  "gitUserEmail": "your@email.com"
}
```

**Use When**:
- ✅ Setting up GitHub integration
- ✅ Need repository-specific instructions
- ✅ Want pre-filled setup scripts
- ✅ Testing autonomous PR workflows

---

## Common Workflows

### Workflow 1: Quick Analysis
```
codex_run → Review output → Done
```

### Workflow 2: Preview and Apply
```
codex_plan → Review → codex_apply (confirm=true) → Done
```

### Workflow 3: Iterative Development
```
codex_local_exec → Review thread → codex_local_resume → Repeat
```

### Workflow 4: Long-Running Task
```
codex_cloud_submit → codex_cloud_check_reminder → codex_cloud_results
```

### Workflow 5: GitHub Setup
```
codex_github_setup_guide → Follow guide → Test with cloud_submit
```

---

## Best Practices

### Always
- ✅ Use `mode='read-only'` first to review
- ✅ Check git status before mutations
- ✅ Use descriptive task descriptions
- ✅ Specify working directory when not in cwd

### Never
- ❌ Use `danger-full-access` without understanding risks
- ❌ Skip `codex_plan` for large mutations
- ❌ Ignore error messages
- ❌ Commit without reviewing changes

### For Best Results
- 🎯 Be specific in task descriptions
- 🎯 Use `outputSchema` for structured data
- 🎯 Leverage thread persistence for multi-step tasks
- 🎯 Monitor token usage with local SDK tools
