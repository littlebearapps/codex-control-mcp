# npm link Setup Guide - Codex Control MCP

**Version**: 3.0.1
**Purpose**: Use npm link for seamless development and deployment
**Status**: ✅ Configured and Ready

---

## What is npm link?

npm link creates a **global symlink** to your local development package. This means:
- One source of truth (your development directory)
- Changes propagate automatically to all MCP configs
- No manual copying to production directories
- Standard npm tooling (prepares for npm publish)

---

## How It Works

### Symlink Chain

```
1. Global bin command:
   /opt/homebrew/bin/codex-control-mcp
   ↓ (symlink)
   /opt/homebrew/lib/node_modules/codex-control-mcp/dist/index.js

2. Global package directory:
   /opt/homebrew/lib/node_modules/codex-control-mcp
   ↓ (symlink)
   ~/claude-code-tools/lba/apps/mcp-servers/codex-control

3. MCP configs use:
   "command": "codex-control-mcp"
   ↓
   Runs the linked executable globally
```

**Result**: All MCP configs point to the same development directory!

---

## Initial Setup (Already Done! ✅)

### 1. Package Configuration

**package.json** (already configured):
```json
{
  "bin": {
    "codex-control-mcp": "./dist/index.js"
  }
}
```

**src/index.ts** (already has shebang):
```typescript
#!/usr/bin/env node
```

### 2. Create npm link

```bash
cd ~/claude-code-tools/lba/apps/mcp-servers/codex-control
./setup-npm-link.sh  # Already run!
```

**What happened**:
- ✅ Global symlink created at `/opt/homebrew/bin/codex-control-mcp`
- ✅ Points to development directory
- ✅ Command available globally: `which codex-control-mcp` works

### 3. MCP Profile Templates Updated

**All 3 profiles** now use the clean command:

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

**Updated profiles**:
- ✅ `~/claude-code-tools/mcp/profiles/lean.json`
- ✅ `~/claude-code-tools/mcp/profiles/research.json`
- ✅ `~/claude-code-tools/mcp/profiles/full.json`

---

## Development Workflow (New!)

### Making Changes

**Old workflow** (with /mcp/codex-control/):
1. Edit files in `lba/apps/mcp-servers/codex-control/src/`
2. `npm run build`
3. `cp -r dist/* ~/claude-code-tools/mcp/codex-control/dist/`
4. Restart Claude Code

**New workflow** (with npm link):
1. Edit files in `lba/apps/mcp-servers/codex-control/src/`
2. `npm run build`
3. **That's it!** Changes propagate automatically
4. Restart Claude Code to pick up changes

### Example Session

```bash
cd ~/claude-code-tools/lba/apps/mcp-servers/codex-control

# Make changes to src/tools/local_run.ts
vim src/tools/local_run.ts

# Build
npm run build

# Done! All MCP configs now use the updated code
# Just restart Claude Code in any project
```

---

## Rollout Plan (Next Steps)

### Phase 1: Test in Root Directory (Current Project)

**Status**: Ready to test!

1. **Update root MCP config** to use new command:
   ```bash
   # Copy lean profile to root .mcp.json
   cp ~/claude-code-tools/mcp/profiles/lean.json ~/.mcp.json
   ```

2. **Restart Claude Code** in root directory

3. **Test all primitives** work correctly

4. **Verify changes propagate**: Make a small change, rebuild, restart, test

### Phase 2: Regenerate All Project Configs

Once verified in root:

```bash
cd ~/claude-code-tools/mcp/profiles
./generate-all-profiles.sh
```

This will regenerate `.mcp.json` for all 18 projects + root using the updated templates.

### Phase 3: Test Across Projects

1. Open Claude Code in a few different projects
2. Verify `codex-control` tools accessible
3. Test async functionality still works

### Phase 4: Cleanup (Optional)

Once all projects use npm link:

```bash
# Old production directory no longer needed
rm -rf ~/claude-code-tools/mcp/codex-control/
```

**Note**: Keep this as backup until fully verified!

---

## Benefits of npm link

### Development
- ✅ **Instant propagation**: Build once, all projects updated
- ✅ **No manual copying**: Forget about deployment scripts
- ✅ **Single source of truth**: No version drift

### Portability
- ✅ **Clean configs**: No hard-coded absolute paths
- ✅ **Machine-independent**: Works on any machine (after npm link)
- ✅ **Team-ready**: Easy for collaborators to set up

### Maintenance
- ✅ **Standard tooling**: Uses npm conventions
- ✅ **Prepares for publish**: Just `npm publish` when ready
- ✅ **Version management**: Standard package versioning

---

## Troubleshooting

### Command not found after npm link

```bash
# Verify link exists
which codex-control-mcp
# Should show: /opt/homebrew/bin/codex-control-mcp

# If not, re-run setup
cd ~/claude-code-tools/lba/apps/mcp-servers/codex-control
./setup-npm-link.sh
```

### Changes not appearing

```bash
# Verify you rebuilt
npm run build

# Verify symlink still points to development dir
ls -la /opt/homebrew/lib/node_modules/codex-control-mcp
# Should show: -> ../../../../Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control

# Restart Claude Code
```

### MCP server not starting

```bash
# Test command manually
codex-control-mcp
# Should print MCP server info (Ctrl+C to exit)

# Check permissions
ls -la /opt/homebrew/bin/codex-control-mcp
# Should be executable

# Re-link if needed
cd ~/claude-code-tools/lba/apps/mcp-servers/codex-control
npm unlink -g codex-control-mcp
npm link
```

### Want to remove npm link

```bash
# Remove global link
npm unlink -g codex-control-mcp

# Verify removed
which codex-control-mcp
# Should return: not found
```

---

## Comparison: Before vs After

| Aspect | Before (/mcp/ directory) | After (npm link) |
|--------|--------------------------|------------------|
| **Command** | `node /Users/.../mcp/codex-control/dist/index.js` | `codex-control-mcp` |
| **Deployment** | Manual `cp -r dist/*` | Automatic (symlink) |
| **Portability** | Machine-specific paths | Portable command |
| **Updates** | 3 steps (build, copy, restart) | 2 steps (build, restart) |
| **Version drift** | Possible (two copies) | Impossible (one source) |
| **Cleanup** | Maintain two directories | Single directory |
| **npm publish** | Needs refactoring | Ready to publish |

---

## Future: Publishing to npm

When ready to officially release:

### 1. Update package.json
```json
{
  "name": "codex-control-mcp",
  "version": "3.0.1",
  "repository": {
    "type": "git",
    "url": "https://github.com/littlebearapps/codex-control-mcp"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

### 2. Publish
```bash
npm login  # If not already logged in
npm publish
```

### 3. Install globally
```bash
# Remove local link
npm unlink -g codex-control-mcp

# Install from npm
npm install -g codex-control-mcp
```

### 4. No config changes needed!

MCP configs already use `"command": "codex-control-mcp"`, so they work with both:
- ✅ Local npm link (development)
- ✅ Global npm install (production)

---

## Status: ✅ Ready for Testing

**Completed**:
- ✅ package.json bin entry added
- ✅ Shebang in src/index.ts (already present)
- ✅ TypeScript rebuilt
- ✅ npm link created successfully
- ✅ All 3 MCP profile templates updated
- ✅ Global command working: `which codex-control-mcp` → `/opt/homebrew/bin/codex-control-mcp`
- ✅ Symlink verified: Points to development directory

**Next Step**: Test in root directory, then roll out to all projects!
