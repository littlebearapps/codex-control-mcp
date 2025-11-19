# Config Directory Migration Plan

**Date**: 2025-11-17
**Priority**: P1 (High - affects all users)
**Status**: 🟡 Ready to implement

---

## Problem Statement

The MCP Delegator package was renamed from `codex-control` to `mcp-delegator`, but the config directory still uses the old name:

**Current State**:

- ✅ Package: `@littlebearapps/mcp-delegator`
- ✅ Command: `mcp-delegator`
- ❌ Config Dir: `~/.config/codex-control/` ← **INCONSISTENT**

**Target State**:

- ✅ Package: `@littlebearapps/mcp-delegator`
- ✅ Command: `mcp-delegator`
- ✅ Config Dir: `~/.config/mcp-delegator/` ← **CONSISTENT**

---

## Impact Analysis

### Files Affected

```
~/.config/codex-control/          ← OLD (current)
├── tasks.db (5.2 MB)            → SQLite registry
├── cloud-tasks.json (488 B)     → Legacy cloud registry
├── environments.json (378 B)    → Codex Cloud environments
├── local-tasks.json.backup      → Migration backup
└── task-registry.db (0 B)       → Empty placeholder

~/.config/mcp-delegator/          ← NEW (target)
└── (same files after migration)
```

### User Impact

**Existing Users** (have v3.2.1 or earlier):

- Config directory: `~/.config/codex-control/`
- Task history: 60 tasks (in our case)
- Environments: Custom Codex Cloud environments

**New Users** (install v3.4.1+):

- Config directory: `~/.config/mcp-delegator/`
- Clean slate

**Upgrade Scenario**:

- Automatic migration on first run of v3.4.1
- No data loss
- No user action required

---

## Implementation Plan

### Phase 1: Code Changes (30 min)

**File**: `src/state/task_registry.ts`

**Current** (line 93):

```typescript
const configDir = path.join(os.homedir(), ".config", "codex-control");
```

**New** (with migration logic):

```typescript
// Migration from old directory name
const oldConfigDir = path.join(os.homedir(), ".config", "codex-control");
const newConfigDir = path.join(os.homedir(), ".config", "mcp-delegator");

// Auto-migrate if old exists and new doesn't
let configDir = newConfigDir;
if (fs.existsSync(oldConfigDir) && !fs.existsSync(newConfigDir)) {
  try {
    console.error(
      "[TaskRegistry] Migrating config from codex-control to mcp-delegator...",
    );
    fs.renameSync(oldConfigDir, newConfigDir);
    console.error(
      "[TaskRegistry] Migration complete! Config now at:",
      newConfigDir,
    );
  } catch (error) {
    console.error("[TaskRegistry] Migration failed:", error);
    console.error("[TaskRegistry] Falling back to old directory for safety");
    configDir = oldConfigDir; // Fallback to old directory
  }
}

// Ensure config directory exists
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

this.dbPath = dbPath || path.join(configDir, "tasks.db");
```

**Similar Changes**:

- Check `src/state/cloud_task_registry.ts` for hardcoded paths
- Check any other files with `'codex-control'` references

### Phase 2: Search and Replace (15 min)

**Find all references**:

```bash
cd /Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/mcp-delegator
grep -r "codex-control" src/
grep -r "\.config/codex" src/
grep -r "codex-control" docs/
grep -r "codex-control" README.md
```

**Expected Files**:

- `src/state/task_registry.ts` - Config path
- `src/state/cloud_task_registry.ts` - Environment path (if any)
- Documentation files - Path references

### Phase 3: Update Documentation (30 min)

**Files to Update**:

1. **CHANGELOG.md** - Add breaking change notice:

   ````markdown
   ## [3.5.0] - 2025-11-XX

   ### BREAKING CHANGE: Config Directory Migration

   Config directory renamed for consistency with package name:

   - **Old**: `~/.config/codex-control/`
   - **New**: `~/.config/mcp-delegator/`

   **Automatic Migration**:

   - First run of v3.4.1+ automatically migrates old directory
   - All task history, environments, and config preserved
   - No user action required

   **Manual Migration** (if automatic migration fails):

   ```bash
   mv ~/.config/codex-control ~/.config/mcp-delegator
   ```
   ````

   **Verification**:

   ```bash
   ls -la ~/.config/mcp-delegator/  # Should show tasks.db, environments.json
   ```

   ```

   ```

2. **README.md** - Update all path references:
   - Search for `codex-control`
   - Replace with `mcp-delegator`
   - Update registry location examples

3. **quickrefs/\*.md** - Update references:
   - `quickrefs/troubleshooting.md` - Registry location
   - `quickrefs/architecture.md` - Config paths
   - Any other files with hardcoded paths

4. **CLAUDE.md** - Update version and note migration

### Phase 4: Testing (30 min)

**Test Cases**:

1. **Fresh Install** (no existing config):

   ```bash
   # Simulate fresh install
   rm -rf ~/.config/mcp-delegator ~/.config/codex-control

   # Run mcp-delegator
   # Expected: Creates ~/.config/mcp-delegator/
   ```

2. **Migration from Old Directory**:

   ```bash
   # Create old directory with dummy data
   mkdir -p ~/.config/codex-control
   echo '{"test": "data"}' > ~/.config/codex-control/environments.json

   # Run mcp-delegator (after code changes)
   # Expected: Directory renamed, data preserved

   # Verify
   ls -la ~/.config/mcp-delegator/
   cat ~/.config/mcp-delegator/environments.json
   ```

3. **Both Directories Exist** (edge case):

   ```bash
   # Create both directories
   mkdir -p ~/.config/codex-control ~/.config/mcp-delegator

   # Run mcp-delegator
   # Expected: Uses new directory, leaves old alone
   ```

4. **Permission Issues**:

   ```bash
   # Make old directory read-only
   chmod 555 ~/.config/codex-control

   # Run mcp-delegator
   # Expected: Fallback to old directory with warning
   ```

### Phase 5: Build and Publish (15 min)

```bash
# Build
npm run build

# Test locally with npm link
npm link
mcp-delegator --version  # Should show v3.4.1

# Verify migration works
# (Test cases from Phase 4)

# Commit changes
git add -A
git commit -m "feat: migrate config directory from codex-control to mcp-delegator

BREAKING CHANGE: Config directory renamed for naming consistency
- Old: ~/.config/codex-control/
- New: ~/.config/mcp-delegator/
- Automatic migration on first run
- Fallback to old directory if migration fails
"

# Publish (semantic-release will handle versioning)
git push origin main
```

---

## Rollback Plan

If migration causes issues:

1. **Immediate**: Code can fallback to old directory (built into migration logic)
2. **Short-term**: Users can manually revert:
   ```bash
   mv ~/.config/mcp-delegator ~/.config/codex-control
   npm install -g @littlebearapps/mcp-delegator@3.4.0
   ```
3. **Long-term**: Fix migration bugs, publish hotfix

---

## User Communication

### Pre-Release (GitHub Discussions)

Post migration announcement:

````markdown
**Upcoming Change in v3.4.1: Config Directory Migration**

We're renaming the config directory for consistency:

- **Old**: `~/.config/codex-control/`
- **New**: `~/.config/mcp-delegator/`

**What You Need to Know**:

- ✅ Automatic migration on first run of v3.4.1
- ✅ All your task history and environments preserved
- ✅ No action required from you
- ✅ Fallback to old directory if migration fails

**Manual Migration** (optional, for early adopters):

```bash
mv ~/.config/codex-control ~/.config/mcp-delegator
```
````

**Questions?** Reply to this thread!

````

### Post-Release (npm Package Description)

Update package.json:
```json
{
  "description": "Delegate AI agent tasks to Codex, Claude Code Agent SDK, and more - with async execution. Config migrated to ~/.config/mcp-delegator/ in v3.4.1+",
  "keywords": [
    "mcp",
    "delegator",
    "codex",
    "claude-code",
    "async",
    "config-migration"
  ]
}
````

---

## Success Criteria

- [ ] Code changes complete (task_registry.ts migration logic)
- [ ] All references updated (src/, docs/, README)
- [ ] CHANGELOG updated with breaking change notice
- [ ] Test cases passing (fresh install, migration, edge cases)
- [ ] npm package updated to v3.4.1
- [ ] User communication posted (GitHub, npm)
- [ ] Migration verified on Nathan's machine (this one!)

---

## Estimated Timeline

| Phase                     | Duration    | Owner         |
| ------------------------- | ----------- | ------------- |
| Phase 1: Code Changes     | 30 min      | Claude/Nathan |
| Phase 2: Search & Replace | 15 min      | Claude/Nathan |
| Phase 3: Documentation    | 30 min      | Claude/Nathan |
| Phase 4: Testing          | 30 min      | Nathan        |
| Phase 5: Build & Publish  | 15 min      | Nathan        |
| **TOTAL**                 | **2 hours** |               |

---

## Current Machine Status

**Your MacBook** (as of 2025-11-17):

- **Installed Version**: v3.2.1 (needs update!)
- **Current Config**: `~/.config/codex-control/` (will migrate)
- **Tasks in Registry**: 60 tasks (will preserve)
- **Environments**: `environments.json` (will preserve)

**After Migration**:

- **Version**: v3.4.1
- **Config**: `~/.config/mcp-delegator/`
- **Tasks**: 60 tasks (preserved)
- **Environments**: All environments (preserved)

---

**Status**: 🟡 Ready for implementation
**Next Step**: Implement Phase 1 (code changes)
**Priority**: P1 (should do before releasing other fixes)
**Blocking**: None (can implement anytime)
