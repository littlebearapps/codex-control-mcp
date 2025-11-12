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
import { something } from './missing-file'

// ✅ Good
import { something } from './existing-file'
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

### Issue: Task Times Out

**Symptoms**:
```
Error: Process timed out
Execution exceeded time limit
```

**Diagnosis**:
```bash
# Check task complexity
# Review concurrency settings
```

**Solutions**:

**Solution 1: Increase Timeout** (not configurable in v2.1.0)
```bash
# For long tasks, use Cloud instead
codex_cloud_submit
```

**Solution 2: Break Task into Steps**
```typescript
// ❌ One large task
{
  task: "Refactor entire codebase, run tests, create PR"
}

// ✅ Multiple smaller tasks
{
  task: "Analyze codebase for refactoring opportunities",
  mode: "read-only"
}
// Then use codex_local_resume for each step
```

**Solution 3: Use Cloud for Long Tasks**
```typescript
{
  task: "Run full test suite and fix all failures",
  envId: "env_myproject"
}
```

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
task: "Fix it"

// ✅ Specific
task: "Fix the null pointer exception in utils.ts line 42"
```

**Solution 2: Check Working Directory**
```typescript
// ❌ Wrong directory
workingDir: "/tmp/nonexistent"

// ✅ Valid directory
workingDir: "/Users/nathanschram/project"
```

**Solution 3: Check Mode**
```typescript
// Try read-only first
mode: "read-only"
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
envId: "env_nonexistent"

// ✅ Valid ID (from Codex Cloud settings)
envId: "env_abc123xyz"
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
{} // codex_cloud_check_reminder
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
threadId: "thread_invalid"

// ✅ Valid ID (from codex_local_exec)
threadId: "thread_019a720e-386b-7902-824a-648819f7cef6"
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
codex_local_exec

// ✅ Cloud for 1-hour task
codex_cloud_submit
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
codex_local_exec(task1)
codex_local_exec(task2)  // No caching

// ✅ Resume thread for caching
codex_local_exec(task1)  // Returns thread_abc123
codex_local_resume(thread_abc123, task2)  // 45-93% cache
```

**Solution 2: Be Specific**
```typescript
// ❌ Vague (large context needed)
task: "Fix the code"

// ✅ Specific (focused context)
task: "Fix null pointer in utils.ts line 42"
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
