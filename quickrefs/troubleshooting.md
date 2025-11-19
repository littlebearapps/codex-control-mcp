# Troubleshooting Quick Reference

Common issues and solutions for Codex Control MCP.

---

## Issue Categories

1. **Installation & Setup** - CLI not found, build errors
2. **Authentication** - Login failures, API key issues
3. **MCP Integration** - Server not discovered, communication errors
4. **Execution Issues** - Tasks failing, timeouts, errors
5. **Cloud Tasks** - Submission failures, status checks
6. **Local SDK** - Thread issues, git requirements
7. **Performance** - Slow execution, high token usage

---

## 1. Installation & Setup

### Issue: Codex CLI Not Found

**Symptoms**:

```
Error: codex: command not found
spawn codex ENOENT
```

**Diagnosis**:

```bash
which codex  # Should return path to codex
codex --version  # Should print version
```

**Solutions**:

**Solution 1: Install Codex CLI**

```bash
npm install -g @openai/codex
which codex  # Verify installation
codex --version  # Verify working
```

**Solution 2: Check PATH**

```bash
echo $PATH  # Should include npm global bin
npm config get prefix  # Get npm global path
export PATH="$(npm config get prefix)/bin:$PATH"
```

**Solution 3: Reinstall**

```bash
npm uninstall -g @openai/codex
npm install -g @openai/codex
```

---

### Issue: TypeScript Build Errors

**Symptoms**:

```
npm run build fails
tsc errors
dist/ folder missing
```

**Diagnosis**:

```bash
npm run build  # Check error output
ls dist/  # Verify dist exists
```

**Solutions**:

**Solution 1: Clean Build**

```bash
rm -rf dist node_modules
npm install
npm run build
```

**Solution 2: Check TypeScript Version**

```bash
npm list typescript  # Should be 5.6+
npm install --save-dev typescript@5.6
npm run build
```

**Solution 3: Fix Import Errors**

```typescript
// ❌ Bad
import { something } from "./missing-file";

// ✅ Good
import { something } from "./existing-file";
```

---

### Issue: Missing Dependencies

**Symptoms**:

```
Cannot find module '@modelcontextprotocol/sdk'
Cannot find module '@openai/codex-sdk'
```

**Solution**:

```bash
cd /path/to/codex-control
npm install  # Install all dependencies
npm run build
```

---

## 2. Authentication

### Issue: Authentication Failed

**Symptoms**:

```
Error: Authentication failed
codex: Not authenticated
401 Unauthorized
```

**Diagnosis**:

```bash
codex auth status  # Check auth state
echo $CODEX_API_KEY  # Check if set
```

**Solutions**:

**Solution 1: Re-authenticate**

```bash
codex auth  # Start auth flow
# Follow prompts to log in
codex auth status  # Verify success
```

**Solution 2: Use API Key**

```bash
export CODEX_API_KEY=sk-proj-your-key-here
# Or add to .envrc for direnv
echo "export CODEX_API_KEY=sk-proj-..." >> .envrc
direnv allow
```

**Solution 3: Check ChatGPT Pro**

```bash
# Codex CLI requires ChatGPT Pro subscription
# Verify subscription at https://chatgpt.com/settings
```

**Solution 4: Clear Auth State**

```bash
# Remove cached auth
rm -rf ~/.codex/auth
codex auth  # Re-authenticate
```

---

### Issue: API Key Not Recognized

**Symptoms**:

```
Error: Invalid API key
Error: API key format incorrect
```

**Solution**:

```bash
# Check key format
echo $CODEX_API_KEY  # Should start with 'sk-proj-'

# Test with explicit key
CODEX_API_KEY=sk-proj-... codex auth status

# If still failing, generate new key:
# https://platform.openai.com/api-keys
```

---

## 3. MCP Integration

### Issue: MCP Server Not Discovered

**Symptoms**:

```
Claude Code doesn't show codex-control tools
Tools not available in /tools list
```

**Diagnosis**:

```bash
# Check MCP config
cat ~/.claude/config/.mcp.json

# Test server manually
node /path/to/codex-control/dist/index.js
```

**Solutions**:

**Solution 1: Verify MCP Config**

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

**Solution 2: Restart Claude Code**

```bash
# MCP servers are discovered at startup
# Quit and restart Claude Code
```

**Solution 3: Check File Permissions**

```bash
ls -la /path/to/codex-control/dist/index.js
# Should be readable
chmod +r /path/to/codex-control/dist/index.js
```

**Solution 4: Test Server Manually**

```bash
node /path/to/codex-control/dist/index.js
# Should print MCP server info
# Press Ctrl+C to exit
```

---

### Issue: MCP Server Crashes

**Symptoms**:

```
Tools suddenly unavailable
MCP server disconnected
Error in Claude Code
```

**Diagnosis**:

```bash
# Check recent logs
# Look for stderr output from MCP server

# Test server manually
node /path/to/codex-control/dist/index.js
```

**Solutions**:

**Solution 1: Check for Syntax Errors**

```bash
npm run build  # Rebuild
node dist/index.js  # Test manually
```

**Solution 2: Check Dependencies**

```bash
npm install  # Ensure all deps installed
npm list  # Check for missing packages
```

**Solution 3: Review Error Logs**

```bash
# Check for stack traces
# Fix code errors
npm run build
```

---

## 4. Execution Issues

### Issue: Task Times Out (v3.2.1+ Automatic Detection)

**Symptoms**:

```
Error: Process timed out
Execution exceeded time limit
Idle timeout: No events received for 5 minutes
Hard timeout: Execution exceeded 20 minutes
```

**Background** (v3.2.1):
All 6 execution tools now have automatic timeout detection:

- **Process-spawning tools**: 5 min idle / 20 min hard timeout with MCP notifications
- **SDK tools**: Background monitoring with task registry updates
- **Polling tools**: Hard timeout wrappers (11-31 min max)

**Diagnosis**:

```bash
# Check task complexity and expected duration
# Review timeout notifications in Claude Code
# Check partial results in error message (last 50 events captured)
```

**Solutions**:

**Solution 1: Use Cloud for Long Tasks**

```bash
# Tasks exceeding 20 min should use Cloud
# Cloud tasks can run for hours
codex_cloud_submit
```

**Solution 2: Break Task into Steps**

```typescript
// ❌ One large task (may timeout)
{
  task: "Refactor entire codebase, run tests, create PR"
}

// ✅ Multiple smaller tasks (each completes faster)
{
  task: "Analyze codebase for refactoring opportunities",
  mode: "read-only"
}
// Then use codex_local_resume for each step
```

**Solution 3: Review Partial Results**

```typescript
// v3.2.1+ captures last 50 JSONL events on timeout
// Check error message for partial progress
// Resume from where it stopped using codex_local_resume
```

**Solution 4: Adjust Expectations**

```typescript
// If task legitimately needs >20 min:
// ✅ Use codex_cloud_submit (designed for long tasks)

// If task should complete <20 min but times out:
// ✅ Investigate performance issues or simplify task
```

---

### Issue: Tasks Stuck in "Working" State

**Symptoms**:

```
Tasks remain in "working" status for hours/days
codex_local_status shows old tasks that never completed
Task never marked as completed/failed/canceled
```

**Background**:
SDK tasks (codex_local_exec, codex_local_resume) can get stuck if timeout detection fails to update registry due to SQLite exceptions or other errors. This is a known issue with root cause identified in Issue 1.3.

**Diagnosis**:

```bash
# Check for stuck tasks
# Use codex_local_status with showAll: true

# Query database directly
sqlite3 ~/.config/mcp-delegator/tasks.db "
  SELECT id, status,
    ROUND((julianday('now') - julianday(created_at/1000, 'unixepoch')) * 24, 1) as hours_ago
  FROM tasks
  WHERE status = 'working'
  ORDER BY hours_ago DESC
  LIMIT 10;
"
```

**Solutions**:

**Solution 1: Use Manual Cleanup Tool**

```typescript
// Clean up tasks stuck > 1 hour (default)
{} // Call _codex_cleanup_registry tool

// Custom threshold (e.g., 30 minutes)
{
  "stuckTaskMaxAgeSeconds": 1800
}

// Preview cleanup without changes
{
  "dryRun": true
}
```

**Solution 2: Clean Up Via Database** (Emergency)

```bash
# Mark all tasks stuck > 2 hours as failed
sqlite3 ~/.config/mcp-delegator/tasks.db "
  UPDATE tasks
  SET status = 'failed',
      error = 'Manually cleaned up - stuck for >2 hours',
      updated_at = $(date -u +%s)000,
      completed_at = $(date -u +%s)000
  WHERE status IN ('pending', 'working')
    AND created_at < $(date -u +%s)000 - 7200000;
"

# Verify cleanup
sqlite3 ~/.config/mcp-delegator/tasks.db "
  SELECT COUNT(*) FROM tasks WHERE status = 'working';
"
```

**Solution 3: Restart MCP Server**

```bash
# Restart Claude Code (MCP server restart)
# Future versions will have automatic cleanup on startup
```

**Prevention**:

- ✅ Future versions (v3.4.2+) will have automatic cleanup
- ✅ Cleanup will run on MCP server startup
- ✅ Periodic cleanup every 15 minutes
- ✅ See Issue 1.3 investigation for complete details

**See**: `docs/debugging/ISSUE-1.3-INVESTIGATION.md` for root cause analysis

---

### Issue: Codex CLI Exits with Error

**Symptoms**:

```
Codex Exec exited with code 1
Error: Execution failed
```

**Diagnosis**:

```bash
# Run Codex CLI manually
codex exec "your task here"

# Check stderr output
codex exec "your task" 2>&1 | tee output.log
```

**Solutions**:

**Solution 1: Check Task Description**

```typescript
// ❌ Vague
task: "Fix it";

// ✅ Specific
task: "Fix the null pointer exception in utils.ts line 42";
```

**Solution 2: Check Working Directory**

```typescript
// ❌ Wrong directory
workingDir: "/tmp/nonexistent";

// ✅ Valid directory
workingDir: "/Users/nathanschram/project";
```

**Solution 3: Check Mode**

```typescript
// Try read-only first
mode: "read-only";
```

---

### Issue: Git Repository Required

**Symptoms**:

```
Not inside a trusted directory
Error: Git repository required
--skip-git-repo-check needed
```

**Diagnosis**:

```bash
cd /your/directory
ls -la .git  # Check for .git folder
git rev-parse --git-dir  # Verify git repo
```

**Solutions**:

**Solution 1: Initialize Git**

```bash
cd /your/directory
git init
# Now it's a trusted directory
```

**Solution 2: Use skipGitRepoCheck** (for codex_local_exec only)

```typescript
{
  task: "Analyze files",
  skipGitRepoCheck: true
}
```

**Solution 3: Use Cloud** (no git requirement)

```typescript
{
  task: "Analyze files",
  envId: "env_myproject"
}
```

---

## 5. Cloud Tasks

### Issue: Cloud Task Submission Fails

**Symptoms**:

```
Error submitting to Codex Cloud
codex cloud exec failed
```

**Diagnosis**:

```bash
# Test cloud CLI manually
codex cloud exec "test task"

# Check environment ID
codex cloud  # Browse environments
```

**Solutions**:

**Solution 1: Verify Environment ID**

```typescript
// ❌ Wrong ID
envId: "env_nonexistent";

// ✅ Valid ID (from Codex Cloud settings)
envId: "env_abc123xyz";
```

**Solution 2: Check Authentication**

```bash
codex auth status  # Must be authenticated
codex auth  # Re-auth if needed
```

**Solution 3: Test Environment**

```bash
codex cloud  # Browse to environment
# Verify it exists and is configured
```

---

### Issue: Can't Check Cloud Task Status

**Symptoms**:

```
Task ID not found
Status unavailable
```

**Diagnosis**:

```bash
# Check task registry
cat ~/.config/codex-control/cloud-tasks.json

# Use Web UI
# https://chatgpt.com/codex/tasks/{taskId}
```

**Solutions**:

**Solution 1: Use Web UI**

```bash
# Open in browser
open "https://chatgpt.com/codex/tasks/task-2025-11-12-abc123"
```

**Solution 2: Check Task Registry**

```bash
cat ~/.config/codex-control/cloud-tasks.json
# Find taskId in registry
```

**Solution 3: Use Check Reminder**

```typescript
{
} // codex_cloud_check_reminder
// Lists all pending tasks with links
```

---

## 6. Local SDK

### Issue: Thread Resumption Fails

**Symptoms**:

```
Thread not found
Cannot resume thread
```

**Diagnosis**:

```bash
# Check thread storage
ls ~/.codex/sessions/
ls ~/.codex/sessions/thread_abc123xyz/
```

**Solutions**:

**Solution 1: Verify Thread ID**

```typescript
// ❌ Wrong ID
threadId: "thread_invalid";

// ✅ Valid ID (from codex_local_exec)
threadId: "thread_019a720e-386b-7902-824a-648819f7cef6";
```

**Solution 2: Check Thread Storage**

```bash
ls -la ~/.codex/sessions/
# Verify thread directory exists
```

**Solution 3: Start New Thread**

```typescript
// If thread lost, start fresh
{
  task: "Continue previous work: [describe context]",
  mode: "read-only"
}
```

---

### Issue: Git Repo Check on Resume

**Symptoms**:

```
Not inside a trusted directory
Error on codex_local_resume
```

**Diagnosis**:

```bash
pwd  # Check current directory
ls -la .git  # Verify git repo
```

**Solution**:

```bash
# Initialize git if needed
git init

# For Claude Code projects, this is automatic
# All projects are git repos
```

---

## 7. Performance

### Issue: Slow Execution

**Symptoms**:

```
Tasks take very long
Slow response times
```

**Diagnosis**:

```bash
# Check active processes
# Use codex_status

# Check concurrency
echo $CODEX_MAX_CONCURRENCY
```

**Solutions**:

**Solution 1: Increase Concurrency**

```bash
# In .mcp.json
"env": {
  "CODEX_MAX_CONCURRENCY": "4"
}
# Restart Claude Code
```

**Solution 2: Use Cloud for Long Tasks**

```typescript
// ❌ Local for 1-hour task
codex_local_exec;

// ✅ Cloud for 1-hour task
codex_cloud_submit;
```

**Solution 3: Break into Smaller Tasks**

```typescript
// Use codex_local_resume for incremental steps
// Leverage caching (45-93% cache rates)
```

---

### Issue: High Token Usage

**Symptoms**:

```
Expensive execution
High costs
```

**Diagnosis**:

```bash
# Use codex_local_exec to track tokens
# Check token usage in output
```

**Solutions**:

**Solution 1: Use Thread Persistence**

```typescript
// ❌ Repeat context each time
codex_local_exec(task1);
codex_local_exec(task2); // No caching

// ✅ Resume thread for caching
codex_local_exec(task1); // Returns thread_abc123
codex_local_resume(thread_abc123, task2); // 45-93% cache
```

**Solution 2: Be Specific**

```typescript
// ❌ Vague (large context needed)
task: "Fix the code";

// ✅ Specific (focused context)
task: "Fix null pointer in utils.ts line 42";
```

**Solution 3: Use Structured Output**

```typescript
// Add outputSchema to reduce parsing
{
  task: "List TODOs",
  outputSchema: { /* JSON schema */ }
}
```

---

## Update Notifications (v3.5.0+)

### Disable Update Notifications

**If you don't want to see update notifications** when starting the server:

**Method 1: Environment Variable** (Recommended)

```bash
export NO_UPDATE_NOTIFIER=1

# Or add to shell profile
echo "export NO_UPDATE_NOTIFIER=1" >> ~/.zshrc
source ~/.zshrc
```

**Method 2: Config File**

```bash
mkdir -p ~/.config/configstore
echo '{"optOut": true}' > ~/.config/configstore/update-notifier-@littlebearapps-mcp-delegator.json
```

**Method 3: Global npm Setting**

```bash
npm config set update-notifier false
```

**See**: `docs/NPM-UPDATE-NOTIFICATIONS.md` for complete details

---

## Common Error Messages

### "spawn codex ENOENT"

- **Meaning**: Codex CLI not found
- **Fix**: Install with `npm install -g @openai/codex`

### "Authentication failed"

- **Meaning**: Not logged in or invalid API key
- **Fix**: Run `codex auth` or set `CODEX_API_KEY`

### "Codex Exec exited with code 1"

- **Meaning**: Codex CLI error
- **Fix**: Run manually to see error: `codex exec "task"`

### "Not inside a trusted directory"

- **Meaning**: Not a git repository
- **Fix**: Run `git init` or use `skipGitRepoCheck: true`

### "Process timed out" / "Idle timeout" / "Hard timeout" (v3.2.1+)

- **Meaning**: Task exceeded timeout limits (5 min idle or 20 min hard)
- **Fix**: Use `codex_cloud_submit` for long tasks, or break into smaller steps
- **Note**: Partial results captured in error message (last 50 events)

### "INVALID_PARAMS"

- **Meaning**: Invalid tool parameters
- **Fix**: Check parameter types and required fields

### "INTERNAL_ERROR"

- **Meaning**: Server error
- **Fix**: Check logs, rebuild server, restart Claude Code

---

## Diagnostic Commands

### Check Installation

```bash
which codex  # Find codex CLI
codex --version  # Check version
npm list -g @openai/codex  # Check global install
```

### Check Authentication

```bash
codex auth status  # Check auth state
echo $CODEX_API_KEY  # Check env var
```

### Check MCP Server

```bash
cat ~/.claude/config/.mcp.json  # Check config
node /path/to/dist/index.js  # Test server
```

### Check Build

```bash
npm run build  # Build TypeScript
ls -la dist/index.js  # Verify output
```

### Check Concurrency

```bash
# Use codex_status tool
echo $CODEX_MAX_CONCURRENCY  # Check env var
```

---

## Getting Help

### Before Asking for Help

1. **Check this troubleshooting guide**
2. **Review error messages carefully**
3. **Test with simple task first**
4. **Check recent changes**
5. **Review git status**

### Include in Support Request

- **Error message** (full text)
- **Tool used** (codex_run, codex_local_exec, etc.)
- **Parameters** (redact secrets)
- **Environment** (Node version, OS, etc.)
- **Steps to reproduce**
- **Expected vs actual behavior**

### Resources

- **README**: `README.md`
- **Validation results**: `TEST-RESULTS-v2.1.0.md`
- **Architecture**: `quickrefs/architecture.md`
- **Workflows**: `quickrefs/workflows.md`
- **Security**: `quickrefs/security.md`
