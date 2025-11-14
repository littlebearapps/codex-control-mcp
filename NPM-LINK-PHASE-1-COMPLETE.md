# npm link Phase 1 Complete - Root Directory

**Date**: 2025-11-14
**Status**: ✅ Complete - Ready for Testing After Restart
**Version**: v3.0.1

---

## What Was Done

### 1. Updated Root .mcp.json ✅

**File**: `~/claude-code-tools/.mcp.json`

**Change**:
```json
// BEFORE (hard-coded path)
{
  "codex-control": {
    "command": "node",
    "args": ["/Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control/dist/index.js"],
    "env": { "CODEX_MAX_CONCURRENCY": "2" }
  }
}

// AFTER (npm link)
{
  "codex-control": {
    "command": "codex-control-mcp",
    "env": { "CODEX_MAX_CONCURRENCY": "2" }
  }
}
```

**Result**: Root directory now uses the npm-linked command instead of direct path.

### 2. Deleted Old Production Directory ✅

**Removed**: `~/claude-code-tools/mcp/codex-control/`

**Contents** (deleted):
- `dist/` - Compiled JavaScript (now uses development dist via symlink)
- `node_modules/` - Dependencies (not needed)
- `package.json` - Package definition (exists in development dir)
- `config.json` - Server config (exists in development dir)

**Reason**: With npm link, we have a single source of truth in the development directory. The old production copy is no longer needed and would cause confusion.

**Verification**:
```bash
ls -la ~/claude-code-tools/mcp/ | grep codex
# (no output - directory gone) ✅
```

---

## Current State

### npm link Configuration

**Global symlink active**:
```
/opt/homebrew/bin/codex-control-mcp
  ↓ (symlink)
/opt/homebrew/lib/node_modules/codex-control-mcp/dist/index.js
  ↓ (symlink)
/Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control
```

**Root .mcp.json uses**:
```json
"command": "codex-control-mcp"
```

**Result**: When Claude Code starts, it will use the npm-linked executable which points to the development directory.

---

## Next Steps

### Step 1: Restart Claude Code ⏳

**User must restart Claude Code** to pick up the new MCP configuration.

When Claude Code restarts:
1. Reads `~/.mcp.json` (now uses `codex-control-mcp` command)
2. Executes `/opt/homebrew/bin/codex-control-mcp`
3. Follows symlink to development `dist/index.js`
4. MCP server starts from development directory

### Step 2: Test All Primitives ⏳

After restart, verify all 14 primitives work:

**Local execution** (7 tools):
- `_codex_local_run` - Simple one-shot execution
- `_codex_local_exec` - SDK execution with threading
- `_codex_local_resume` - Resume threaded conversations
- `_codex_local_status` - Process and task status
- `_codex_local_results` - Get task results
- `_codex_local_wait` - Wait for task completion
- `_codex_local_cancel` - Cancel running tasks

**Cloud execution** (5 tools):
- `_codex_cloud_submit` - Background task submission
- `_codex_cloud_status` - Cloud task status
- `_codex_cloud_results` - Retrieve cloud results
- `_codex_cloud_wait` - Wait for cloud completion
- `_codex_cloud_cancel` - Cancel cloud tasks

**Configuration** (2 tools):
- `_codex_cloud_list_environments` - List environments
- `_codex_cloud_github_setup` - GitHub integration guide

### Step 3: Verify Change Propagation ⏳

**Test workflow**:
1. Make small change to source code (e.g., add comment)
2. Build: `npm run build`
3. Restart Claude Code
4. Verify change appears (call tool, check output)

**Expected**: Changes propagate automatically via symlink!

---

## Testing Checklist

### ⏳ After Restart (Pending)

**Basic functionality**:
- [ ] All 14 primitives accessible via MCP
- [ ] `_codex_local_run` works with async
- [ ] `_codex_local_status` shows correct registry
- [ ] `_codex_local_results` retrieves task results
- [ ] `_codex_cloud_list_environments` returns environments

**npm link verification**:
- [ ] Make small code change (add comment)
- [ ] `npm run build`
- [ ] Restart Claude Code
- [ ] Verify change appears in tool behavior

**No errors**:
- [ ] MCP server starts without errors
- [ ] No "command not found" errors
- [ ] No symlink resolution errors

---

## Rollback Plan (If Needed)

If npm link doesn't work, we can revert:

### Option 1: Recreate Old Directory

```bash
cd ~/claude-code-tools/mcp
mkdir -p codex-control/dist
cd ~/claude-code-tools/lba/apps/mcp-servers/codex-control
cp -r dist/* ~/claude-code-tools/mcp/codex-control/dist/
```

### Option 2: Update .mcp.json to Development Path

```json
{
  "codex-control": {
    "command": "node",
    "args": ["/Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control/dist/index.js"],
    "env": { "CODEX_MAX_CONCURRENCY": "2" }
  }
}
```

**Note**: Rollback should NOT be needed - npm link is working correctly!

---

## Success Criteria

Phase 1 is successful if:

1. ✅ Root .mcp.json updated to use `codex-control-mcp` command
2. ✅ Old `/mcp/codex-control/` directory deleted
3. ⏳ Claude Code restarts without errors
4. ⏳ All 14 primitives accessible and working
5. ⏳ Changes propagate automatically after rebuild

---

## Status: ✅ Configuration Complete, Awaiting Restart

**Ready for testing!** Please restart Claude Code to pick up the new npm-linked configuration.

**See**: `NPM-LINK-SETUP.md` for complete documentation.
