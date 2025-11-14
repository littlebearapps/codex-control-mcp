# npm link Rollout Summary - v3.0.1

**Date**: 2025-11-14
**Status**: ✅ Configured and Ready for Testing
**Version**: v3.0.1

---

## What We Did

Converted codex-control MCP from manual deployment (`/mcp/codex-control/`) to **npm link** for seamless development.

---

## Changes Made

### 1. Package Configuration ✅

**package.json** - Added bin entry:
```json
{
  "bin": {
    "codex-control-mcp": "./dist/index.js"
  }
}
```

**src/index.ts** - Shebang already present:
```typescript
#!/usr/bin/env node
```

### 2. Setup Script Created ✅

**`setup-npm-link.sh`**:
- Validates package.json
- Ensures build exists
- Creates global npm link
- Provides testing instructions

**Execution**:
```bash
./setup-npm-link.sh
# ✅ Global symlink created successfully
# ✅ Command available: /opt/homebrew/bin/codex-control-mcp
```

### 3. MCP Profile Templates Updated ✅

Updated all 3 profiles to use portable command:

**Files Modified**:
- `~/claude-code-tools/mcp/profiles/lean.json`
- `~/claude-code-tools/mcp/profiles/research.json`
- `~/claude-code-tools/mcp/profiles/full.json`

**Before** (hard-coded paths):
```json
{
  "codex-control": {
    "command": "node",
    "args": ["/Users/nathanschram/claude-code-tools/mcp/codex-control/dist/index.js"],
    "env": { "CODEX_MAX_CONCURRENCY": "2" }
  }
}
```

**After** (portable, npm-linked):
```json
{
  "codex-control": {
    "command": "codex-control-mcp",
    "env": { "CODEX_MAX_CONCURRENCY": "2" }
  }
}
```

### 4. Global Symlink Verified ✅

**Symlink chain**:
```
/opt/homebrew/bin/codex-control-mcp
  ↓ (symlink)
/opt/homebrew/lib/node_modules/codex-control-mcp/dist/index.js
  ↓ (symlink)
/Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control
```

**Verification**:
```bash
which codex-control-mcp
# ✅ /opt/homebrew/bin/codex-control-mcp

ls -la /opt/homebrew/lib/node_modules/codex-control-mcp
# ✅ -> ../../../../Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control
```

### 5. Documentation Created ✅

**New files**:
- `NPM-LINK-SETUP.md` - Complete setup guide and troubleshooting
- `NPM-LINK-ROLLOUT-SUMMARY.md` - This file
- `setup-npm-link.sh` - Automated setup script

**Updated files**:
- `CLAUDE.md` - Production Deployment section
- `package.json` - Version 3.0.1 + bin entry

---

## What Changed for Development

### Old Workflow (Manual Deployment)

```bash
# 1. Edit source files
vim src/tools/local_run.ts

# 2. Build TypeScript
npm run build

# 3. Copy to production directory
cp -r dist/* ~/claude-code-tools/mcp/codex-control/dist/

# 4. Restart Claude Code
```

**Problems**:
- 3-step process (error-prone)
- Two copies of code (version drift risk)
- Hard-coded paths in configs (not portable)

### New Workflow (npm link)

```bash
# 1. Edit source files
vim src/tools/local_run.ts

# 2. Build TypeScript
npm run build

# 3. Restart Claude Code
```

**Benefits**:
- ✅ 2-step process (simpler)
- ✅ Single source of truth (no drift)
- ✅ Portable configs (works on any machine)
- ✅ Prepares for npm publish

---

## Rollout Plan

### Phase 1: Test in Root Directory (Next)

**Goal**: Verify npm link works correctly before rolling out to all 18 projects.

**Steps**:
1. ✅ npm link created (done)
2. ✅ Templates updated (done)
3. ⏳ Copy lean profile to root:
   ```bash
   cp ~/claude-code-tools/mcp/profiles/lean.json ~/.mcp.json
   ```
4. ⏳ Restart Claude Code in root directory
5. ⏳ Test all 14 primitives work correctly
6. ⏳ Verify changes propagate (make small change, rebuild, restart, test)

### Phase 2: Regenerate All Project Configs

Once verified in root:

```bash
cd ~/claude-code-tools/mcp/profiles
./generate-all-profiles.sh
```

This regenerates `.mcp.json` for all 18 projects using updated templates.

### Phase 3: Test Across Projects

1. Open Claude Code in 3-5 different projects
2. Verify codex-control tools accessible
3. Test async functionality
4. Verify changes propagate

### Phase 4: Cleanup (Optional)

Once fully verified:

```bash
# Old production directory no longer needed
rm -rf ~/claude-code-tools/mcp/codex-control/
```

**Recommendation**: Keep as backup for 1-2 weeks.

---

## Technical Details

### npm link Mechanics

**What `npm link` does**:
1. Creates symlink in global `node_modules`:
   ```
   /opt/homebrew/lib/node_modules/codex-control-mcp
   → ~/claude-code-tools/lba/apps/mcp-servers/codex-control
   ```

2. Creates executable in global bin:
   ```
   /opt/homebrew/bin/codex-control-mcp
   → ../lib/node_modules/codex-control-mcp/dist/index.js
   ```

3. Makes command available globally:
   ```bash
   which codex-control-mcp  # Works from any directory
   ```

### How Changes Propagate

```
Developer edits src/tools/local_run.ts
  ↓
npm run build
  ↓
dist/tools/local_run.js updated
  ↓
Global symlink points to updated dist/
  ↓
All MCP configs use "codex-control-mcp" command
  ↓
Restart Claude Code → picks up new code
```

**No copying needed!** Symlink ensures all projects see the same code.

---

## Benefits Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Deployment** | Manual `cp -r dist/*` | Automatic (symlink) |
| **Steps** | 3 (build, copy, restart) | 2 (build, restart) |
| **Version drift** | Possible (2 copies) | Impossible (1 source) |
| **Portability** | Machine-specific paths | Portable command |
| **Maintenance** | 2 directories | 1 directory |
| **npm publish** | Needs refactoring | Ready to publish |

---

## Testing Checklist

### ✅ Completed
- [x] package.json bin entry added
- [x] Shebang in src/index.ts verified
- [x] TypeScript rebuilt successfully
- [x] npm link created successfully
- [x] Global command available (`which codex-control-mcp`)
- [x] Symlink verified (points to dev directory)
- [x] All 3 MCP profile templates updated
- [x] Documentation created

### ⏳ Next Steps (Phase 1)
- [ ] Copy lean profile to root `.mcp.json`
- [ ] Restart Claude Code in root
- [ ] Test `_codex_local_run` with async
- [ ] Test `_codex_local_status`
- [ ] Test `_codex_local_results`
- [ ] Test `_codex_cloud_list_environments`
- [ ] Make small code change, rebuild, verify propagation

### ⏳ Next Steps (Phase 2-4)
- [ ] Regenerate all project configs with `generate-all-profiles.sh`
- [ ] Test in 3-5 different projects
- [ ] Verify async functionality across projects
- [ ] Optional: Remove old `/mcp/codex-control/` directory

---

## Troubleshooting Reference

### Command not found

```bash
# Re-run setup
cd ~/claude-code-tools/lba/apps/mcp-servers/codex-control
./setup-npm-link.sh
```

### Changes not appearing

```bash
# Verify build
npm run build

# Verify symlink
ls -la /opt/homebrew/lib/node_modules/codex-control-mcp

# Restart Claude Code
```

### MCP server not starting

```bash
# Test manually
codex-control-mcp  # Should print server info (Ctrl+C to exit)

# Check MCP config
cat ~/.mcp.json  # Should have "command": "codex-control-mcp"
```

---

## Status: ✅ Ready for Phase 1 Testing

**All setup complete!** Next step is to test in root directory before rolling out to all projects.

**See**: `NPM-LINK-SETUP.md` for complete guide and troubleshooting.
