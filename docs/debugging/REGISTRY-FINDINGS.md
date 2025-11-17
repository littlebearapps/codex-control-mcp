# MCP Delegator Registry Findings

**Date**: 2025-11-17
**Investigator**: Claude (Sonnet 4.5)
**Status**: ✅ Registry Located and Documented

---

## Executive Summary

Successfully located and analyzed the MCP Delegator task registry. Found **60 total tasks** with **9 stuck in "working" state for 25+ hours**, confirming Issue 1.3 from auditor-toolkit testing.

**Critical Finding**: Config directory uses old name `codex-control` instead of `mcp-delegator`, causing naming inconsistency.

---

## Registry Location

### Primary Registry (SQLite)
```
Path: ~/.config/codex-control/tasks.db
Size: 5.2 MB
Format: SQLite database
Permissions: -rw-r--r-- (user read/write)
```

### Legacy Files (Still Present)
```
~/.config/codex-control/
├── tasks.db                    (5.2 MB) ← PRIMARY (SQLite)
├── cloud-tasks.json           (488 B)  ← Legacy cloud registry
├── local-tasks.json.backup    (108 KB) ← Backup from migration
├── task-registry.db           (0 B)    ← Empty placeholder?
└── environments.json          (378 B)  ← Codex Cloud environments
```

---

## Registry Schema

### Table: `tasks`

```sql
CREATE TABLE tasks (
  -- Core fields
  id TEXT PRIMARY KEY,              -- T-local-abc123 or T-cloud-def456
  external_id TEXT,                 -- Cloud task ID or local PID
  alias TEXT,                       -- Human-friendly name
  origin TEXT NOT NULL CHECK(origin IN ('local', 'cloud')),
  status TEXT NOT NULL CHECK(status IN (
    'pending', 'working', 'completed',
    'completed_with_warnings', 'completed_with_errors',
    'failed', 'canceled', 'unknown'
  )),
  instruction TEXT NOT NULL,        -- Original task description

  -- Context
  working_dir TEXT,
  env_id TEXT,                      -- For cloud tasks
  mode TEXT,                        -- read-only, workspace-write, etc.
  model TEXT,                       -- OpenAI model

  -- Timestamps (Unix ms)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  last_event_at INTEGER,

  -- Progress tracking (v3.0+)
  progress_steps TEXT,              -- JSON-encoded ProgressSummary
  poll_frequency_ms INTEGER,
  keep_alive_until INTEGER,

  -- Threading (local SDK)
  thread_id TEXT,                   -- Codex SDK thread ID
  user_id TEXT,                     -- Future multi-user support

  -- Results
  result TEXT,                      -- JSON-encoded result
  error TEXT,                       -- Error message if failed

  -- Metadata
  metadata TEXT                     -- JSON-encoded additional context
);
```

### Indexes

```sql
CREATE INDEX idx_status_updated ON tasks(status, updated_at DESC);
CREATE INDEX idx_origin_status ON tasks(origin, status, updated_at DESC);
CREATE INDEX idx_working_dir ON tasks(working_dir, updated_at DESC);
CREATE INDEX idx_user_thread ON tasks(user_id, thread_id, updated_at DESC);
CREATE INDEX idx_created_at ON tasks(created_at DESC);
```

---

## Registry Contents (Current State)

### Task Count Summary

| Origin | Status | Count | Notes |
|--------|--------|-------|-------|
| local | completed | 35 | ✅ Successful tasks |
| local | completed_with_warnings | 11 | ⚠️ Partial success |
| local | completed_with_errors | 4 | ⚠️ Errors but finished |
| local | working | **9** | ❌ **STUCK** (25+ hours) |
| local | failed | 1 | ❌ Critical failure |
| **TOTAL** | | **60** | |

### Stuck Tasks Analysis (Issue 1.3 Confirmed)

**9 tasks stuck in "working" state for 25+ hours**:

```sql
SELECT id, instruction, elapsed_hours
FROM (
  SELECT id, instruction,
    ROUND((julianday('now') - julianday(created_at/1000, 'unixepoch')) * 24, 1) as elapsed_hours
  FROM tasks
  WHERE status = 'working'
)
ORDER BY elapsed_hours DESC;
```

**Results**:

| Task ID | Instruction | Elapsed (hours) | Working Dir |
|---------|-------------|-----------------|-------------|
| T-local-mi11zt6ku9ilj7 | Rebase current branch onto main | 25.6 | /tmp/git-safety-test |
| T-local-mi1206eenm3nb3 | Rebase current branch onto main | 25.6 | /tmp/git-safety-test |
| T-local-mi120fyptzj88g | Show git log --oneline | 25.6 | /tmp/git-safety-test |
| T-local-mi125ln8deph68 | Rebase current branch onto main | 25.5 | /tmp/git-safety-test |
| T-local-mi125xxpuu9hdy | Show git log --online | 25.5 | /tmp/git-safety-test |
| T-local-mi1266lchz7y10 | Rebase current branch onto main | 25.5 | /tmp/git-safety-test |
| T-local-mi126oy3ov0pwv | Show git log --oneline | 25.5 | /tmp/git-safety-test |
| T-local-mi126umnoks0g4 | Rebase current branch onto main | 25.5 | /tmp/git-safety-test |
| T-local-mi127ad04c1cnm | Show git log --oneline | 25.5 | /tmp/git-safety-test |

**Observations**:
- ✅ All from test directory `/tmp/git-safety-test`
- ✅ All git operations (log, rebase)
- ✅ All created around same time (likely single test session)
- ❌ Never marked as completed/failed/canceled
- ❌ No cleanup has run in 25+ hours

**Root Cause**: Confirms cleanup logic is NOT running or NOT effective.

---

## Naming Inconsistency Issues

### Current State (v3.4.0)

**Package**: `@littlebearapps/mcp-delegator` v3.4.0
**Command**: `mcp-delegator`
**Config Directory**: `~/.config/codex-control/` ← ❌ **INCONSISTENT**

### Issues

1. **Old directory name**: Should be `~/.config/mcp-delegator/`
2. **Installed version**: v3.2.1 (not v3.4.0)
3. **User confusion**: "codex-control" vs "mcp-delegator"
4. **Migration needed**: Existing users have data in old directory

### Impact

| Component | Current Name | Should Be | Status |
|-----------|-------------|-----------|--------|
| npm package | `@littlebearapps/mcp-delegator` | ✅ Correct | ✅ OK |
| CLI command | `mcp-delegator` | ✅ Correct | ✅ OK |
| Config directory | `~/.config/codex-control/` | ❌ Wrong | ❌ NEEDS FIX |
| SQLite database | `~/.config/codex-control/tasks.db` | ❌ Wrong path | ❌ NEEDS FIX |
| Environment file | `~/.config/codex-control/environments.json` | ❌ Wrong path | ❌ NEEDS FIX |

---

## Migration Requirements

### Phase 1: Code Changes

**Files to Update** (config path constant):
- `src/state/task_registry.ts:93` - Change `'codex-control'` → `'mcp-delegator'`
- `src/state/cloud_task_registry.ts` - Check for hardcoded paths
- Any other files with config directory references

**Search Command**:
```bash
grep -r "codex-control" src/
grep -r "\.config/codex" src/
```

### Phase 2: Migration Logic

**Backward Compatibility Approach**:
```typescript
// In task_registry.ts constructor:
const oldConfigDir = path.join(os.homedir(), '.config', 'codex-control');
const newConfigDir = path.join(os.homedir(), '.config', 'mcp-delegator');

// If old directory exists and new doesn't, migrate
if (fs.existsSync(oldConfigDir) && !fs.existsSync(newConfigDir)) {
  console.log('Migrating config from codex-control to mcp-delegator...');
  fs.renameSync(oldConfigDir, newConfigDir);
  console.log('Migration complete!');
}

// Use new directory
this.dbPath = dbPath || path.join(newConfigDir, 'tasks.db');
```

**Migration Checklist**:
- [ ] Detect old config directory
- [ ] Rename `~/.config/codex-control/` → `~/.config/mcp-delegator/`
- [ ] Verify all files migrated (tasks.db, environments.json, etc.)
- [ ] Log migration success
- [ ] Handle edge cases (permissions, partial migration, etc.)

### Phase 3: User Communication

**CHANGELOG Entry**:
```markdown
### v3.4.3 - Config Directory Migration

**BREAKING CHANGE**: Config directory renamed for consistency

- **Old**: `~/.config/codex-control/`
- **New**: `~/.config/mcp-delegator/`

**What Happens**:
- First run after upgrade automatically migrates old directory
- All task history, environments preserved
- No action required from users

**Manual Migration** (if needed):
```bash
mv ~/.config/codex-control ~/.config/mcp-delegator
```
```

**README Update**:
- Document new config path
- Add troubleshooting section for migration
- Update all path references

---

## Recommendations

### Immediate (P0)

1. **Update npm package globally**:
   ```bash
   npm update -g @littlebearapps/mcp-delegator
   # Should install v3.4.0 (currently v3.2.1)
   ```

2. **Clean up stuck tasks**:
   ```bash
   # Manual cleanup for now
   sqlite3 ~/.config/codex-control/tasks.db
   UPDATE tasks SET status = 'canceled', error = 'Stuck for 25+ hours, manually canceled'
   WHERE status = 'working' AND (julianday('now') - julianday(created_at/1000, 'unixepoch')) * 86400 > 28800;
   ```

3. **Test cleanup_registry tool**:
   ```typescript
   // Via MCP
   mcp__mcp-delegator___codex_cleanup_registry({
     dryRun: true,
     olderThanHours: 24
   })
   ```

### Short-term (P1)

1. **Implement config directory migration** (code changes above)
2. **Add automatic cleanup** (on status check or background timer)
3. **Fix stuck task detection** (update status on timeout)

### Medium-term (P2)

1. **Add registry health monitoring**
2. **Document registry maintenance**
3. **Create admin tools** (vacuum, integrity check, manual cleanup)

---

## Success Criteria

### Task 1.4 (Registry Investigation) ✅

- [x] Registry file located (`~/.config/codex-control/tasks.db`)
- [x] Format identified (SQLite)
- [x] Schema documented (CREATE TABLE + 5 indexes)
- [x] Permissions verified (user read/write)
- [x] Stuck tasks confirmed (9 tasks, 25+ hours)
- [x] Naming inconsistency identified

### Next Steps

1. ✅ Mark Task 1.4 as completed
2. 🔄 Add migration tasks to todo list
3. 🔄 Continue with Issue 1.3 investigation (stuck tasks cleanup)

---

## Appendix: Registry Queries

### Count tasks by status
```sql
SELECT status, COUNT(*) as count
FROM tasks
GROUP BY status
ORDER BY count DESC;
```

### Find stuck tasks (running > 2 hours)
```sql
SELECT id, instruction,
  ROUND((julianday('now') - julianday(created_at/1000, 'unixepoch')) * 24, 1) as hours
FROM tasks
WHERE status = 'working'
  AND (julianday('now') - julianday(created_at/1000, 'unixepoch')) * 86400 > 7200
ORDER BY hours DESC;
```

### Find tasks by working directory
```sql
SELECT id, instruction, status
FROM tasks
WHERE working_dir LIKE '%auditor-toolkit%'
ORDER BY created_at DESC
LIMIT 10;
```

### Recent task activity
```sql
SELECT id, instruction, status,
  datetime(created_at/1000, 'unixepoch') as created
FROM tasks
ORDER BY created_at DESC
LIMIT 20;
```

### Database size analysis
```sql
SELECT
  COUNT(*) as total_tasks,
  SUM(LENGTH(result)) as total_result_bytes,
  SUM(LENGTH(error)) as total_error_bytes,
  SUM(LENGTH(metadata)) as total_metadata_bytes
FROM tasks;
```

---

**Status**: ✅ Investigation Complete
**Next**: Implement config directory migration
**Priority**: P1 (High - affects all users)
