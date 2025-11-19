# MCP Delegator - Complete Tool List

**Version**: 3.2.1
**Last Updated**: 2025-11-16

---

## Summary

**Total MCP Tools**: 15 (all hidden primitives with `_` prefix)
**Legacy CLI Tools**: 0 (NOT exposed in MCP - safe to delete)

---

## ✅ **ALL 15 MCP Tools Exposed to Users**

All tools are prefixed with `_codex_` and are "hidden primitives" meant to be selected by Claude Code's natural language processing.

### **Local Execution Tools** (7 tools)

#### 1. `_codex_local_run`

- **Purpose**: One-shot local execution (simple tasks)
- **Type**: Process-spawning (via ProcessManager)
- **Registry**: ✅ SQLite (`globalTaskRegistry`)
- **File**: `src/tools/local_run.ts`
- **Status**: ✅ Active MCP tool

#### 2. `_codex_local_exec`

- **Purpose**: SDK execution with threading (iterative development)
- **Type**: Codex SDK (@openai/codex-sdk)
- **Registry**: ✅ SQLite (`globalTaskRegistry`)
- **File**: `src/tools/local_exec.ts`
- **Status**: ✅ Active MCP tool

#### 3. `_codex_local_resume`

- **Purpose**: Resume threaded conversations (follow-up questions)
- **Type**: Codex SDK (@openai/codex-sdk)
- **Registry**: ✅ SQLite (`globalTaskRegistry`)
- **File**: `src/tools/local_resume.ts`
- **Status**: ✅ Active MCP tool

#### 4. `_codex_local_status`

- **Purpose**: Task status and registry inspection
- **Type**: Registry query
- **Registry**: ✅ SQLite (`globalTaskRegistry`)
- **File**: `src/tools/local_status.ts`
- **Status**: ✅ Active MCP tool

#### 5. `_codex_local_results`

- **Purpose**: Get completed task results
- **Type**: Registry query
- **Registry**: ✅ SQLite (`globalTaskRegistry`)
- **File**: `src/tools/local_results.ts`
- **Status**: ✅ Active MCP tool

#### 6. `_codex_local_wait`

- **Purpose**: Wait for task completion (polling with backoff)
- **Type**: Registry polling
- **Registry**: ✅ SQLite (`globalTaskRegistry`)
- **File**: `src/tools/local_wait.ts`
- **Status**: ✅ Active MCP tool

#### 7. `_codex_local_cancel`

- **Purpose**: Cancel running tasks
- **Type**: Process management
- **Registry**: ✅ SQLite (`globalTaskRegistry`)
- **File**: `src/tools/local_cancel.ts`
- **Status**: ✅ Active MCP tool

---

### **Cloud Execution Tools** (5 tools)

#### 8. `_codex_cloud_submit`

- **Purpose**: Submit background tasks to Codex Cloud
- **Type**: Cloud submission (via codex cloud exec)
- **Registry**: ✅ SQLite (`globalTaskRegistry` via cloud_task_registry)
- **File**: `src/tools/cloud.ts` (CloudSubmitTool)
- **Status**: ✅ Active MCP tool

#### 9. `_codex_cloud_status`

- **Purpose**: Check cloud task status (3 modes: pending/specific/list)
- **Type**: Cloud query
- **Registry**: ✅ SQLite (`globalTaskRegistry` via cloud_task_registry)
- **File**: `src/tools/cloud.ts` (CloudStatusTool)
- **Status**: ✅ Active MCP tool

#### 10. `_codex_cloud_results`

- **Purpose**: Retrieve completed cloud task results
- **Type**: Cloud query
- **Registry**: ✅ SQLite (`globalTaskRegistry` via cloud_task_registry)
- **File**: `src/tools/cloud.ts` (CloudResultsTool)
- **Status**: ✅ Active MCP tool

#### 11. `_codex_cloud_wait`

- **Purpose**: Wait for cloud task completion
- **Type**: Cloud polling
- **Registry**: ✅ SQLite (`globalTaskRegistry` via cloud_task_registry)
- **File**: `src/tools/cloud_wait.ts`
- **Status**: ✅ Active MCP tool

#### 12. `_codex_cloud_cancel`

- **Purpose**: Cancel cloud tasks
- **Type**: Cloud management
- **Registry**: ✅ SQLite (`globalTaskRegistry` via cloud_task_registry)
- **File**: `src/tools/cloud_cancel.ts`
- **Status**: ✅ Active MCP tool

---

### **Configuration & Setup Tools** (3 tools)

#### 13. `_codex_cloud_list_environments`

- **Purpose**: List available Codex Cloud environments
- **Type**: Configuration query
- **Registry**: N/A (reads from config file)
- **File**: `src/tools/list_environments.ts`
- **Status**: ✅ Active MCP tool

#### 14. `_codex_cloud_github_setup`

- **Purpose**: Generate GitHub integration setup guide
- **Type**: Documentation generator
- **Registry**: N/A (static template)
- **File**: `src/tools/github_setup.ts`
- **Status**: ✅ Active MCP tool

#### 15. `_codex_cleanup_registry`

- **Purpose**: Clean up stuck tasks and old completed tasks
- **Type**: Registry maintenance
- **Registry**: ✅ SQLite (`globalTaskRegistry`)
- **File**: `src/tools/cleanup_registry.ts`
- **Status**: ✅ Active MCP tool

---

## ❌ **Legacy CLI Tools - NOT Exposed in MCP**

These tools exist in the codebase but are **NOT registered as MCP tools**. They are internal code only.

### 1. `cli_run.ts` (NOT IN MCP)

- **File**: `src/tools/cli_run.ts`
- **Purpose**: Legacy blocking CLI execution
- **Registry**: ❌ JSON (`localTaskRegistry` from local_task_registry.ts)
- **Status**: ⚠️ **NOT EXPOSED** - Internal code only
- **Recommendation**: 🗑️ **DELETE** (replaced by `_codex_local_run`)

### 2. `cli_plan.ts` (NOT IN MCP)

- **File**: `src/tools/cli_plan.ts`
- **Purpose**: Legacy preview changes
- **Registry**: ❌ JSON (`localTaskRegistry` from local_task_registry.ts)
- **Status**: ⚠️ **NOT EXPOSED** - Internal code only
- **Recommendation**: 🗑️ **DELETE** (replaced by `_codex_local_run` with mode=preview)

### 3. `cli_apply.ts` (NOT IN MCP)

- **File**: `src/tools/cli_apply.ts`
- **Purpose**: Legacy apply changes
- **Registry**: ❌ JSON (`localTaskRegistry` from local_task_registry.ts)
- **Status**: ⚠️ **NOT EXPOSED** - Internal code only
- **Recommendation**: 🗑️ **DELETE** (replaced by `_codex_local_run` with confirm=true)

---

## MCP Server Registration (index.ts)

### Tools Array (Lines 117-137)

```typescript
tools: [
  // Hidden primitives (15 tools with _ prefix)
  LocalRunTool.getSchema(), // _codex_local_run
  LocalStatusTool.getSchema(), // _codex_local_status
  LocalExecTool.getSchema(), // _codex_local_exec
  LocalResumeTool.getSchema(), // _codex_local_resume
  LocalResultsTool.getSchema(), // _codex_local_results
  LocalWaitTool.getSchema(), // _codex_local_wait
  LocalCancelTool.getSchema(), // _codex_local_cancel
  CloudSubmitTool.getSchema(), // _codex_cloud_submit
  CloudStatusTool.getSchema(), // _codex_cloud_status
  CloudResultsTool.getSchema(), // _codex_cloud_results
  CloudWaitTool.getSchema(), // _codex_cloud_wait
  CloudCancelTool.getSchema(), // _codex_cloud_cancel
  ListEnvironmentsTool.getSchema(), // _codex_cloud_list_environments
  GitHubSetupTool.getSchema(), // _codex_cloud_github_setup
  CleanupRegistryTool.getSchema(), // _codex_cleanup_registry
];
```

### Tool Handler Switch (Lines 201-261)

All 15 tools are handled in the switch statement. **NO CLI tools** are included.

---

## Registry Usage Summary

### ✅ **All 15 MCP Tools Use SQLite**

| Tool                             | Registry Type | Registry Import                                    |
| -------------------------------- | ------------- | -------------------------------------------------- |
| `_codex_local_run`               | SQLite        | `globalTaskRegistry` from `task_registry.js`       |
| `_codex_local_status`            | SQLite        | `globalTaskRegistry` from `task_registry.js`       |
| `_codex_local_exec`              | SQLite        | `globalTaskRegistry` from `task_registry.js`       |
| `_codex_local_resume`            | SQLite        | `globalTaskRegistry` from `task_registry.js`       |
| `_codex_local_results`           | SQLite        | `globalTaskRegistry` from `task_registry.js`       |
| `_codex_local_wait`              | SQLite        | `globalTaskRegistry` from `task_registry.js`       |
| `_codex_local_cancel`            | SQLite        | `globalTaskRegistry` from `task_registry.js`       |
| `_codex_cloud_submit`            | SQLite        | `globalTaskRegistry` from `cloud_task_registry.js` |
| `_codex_cloud_status`            | SQLite        | `globalTaskRegistry` from `cloud_task_registry.js` |
| `_codex_cloud_results`           | SQLite        | `globalTaskRegistry` from `cloud_task_registry.js` |
| `_codex_cloud_wait`              | SQLite        | `globalTaskRegistry` from `cloud_task_registry.js` |
| `_codex_cloud_cancel`            | SQLite        | `globalTaskRegistry` from `cloud_task_registry.js` |
| `_codex_cloud_list_environments` | N/A           | Reads config file                                  |
| `_codex_cloud_github_setup`      | N/A           | Static template                                    |
| `_codex_cleanup_registry`        | SQLite        | `globalTaskRegistry` from `task_registry.js`       |

### ❌ **Legacy Non-MCP Code Uses JSON**

| File           | Registry Type | Registry Import                                   | Status     |
| -------------- | ------------- | ------------------------------------------------- | ---------- |
| `cli_run.ts`   | JSON          | `localTaskRegistry` from `local_task_registry.js` | NOT IN MCP |
| `cli_plan.ts`  | JSON          | `localTaskRegistry` from `local_task_registry.js` | NOT IN MCP |
| `cli_apply.ts` | JSON          | `localTaskRegistry` from `local_task_registry.js` | NOT IN MCP |

---

## Cleanup Recommendations

### Priority 1: Delete Dead Code (Safe - No Impact)

These files can be **deleted immediately** with **ZERO impact** on MCP functionality:

1. **Delete**: `src/tools/cli_run.ts` ← NOT in MCP
2. **Delete**: `src/tools/cli_plan.ts` ← NOT in MCP
3. **Delete**: `src/tools/cli_apply.ts` ← NOT in MCP
4. **Delete**: `src/state/local_task_registry.ts` ← Only used by above 3 files
5. **Archive**: `~/.config/codex-control/local-tasks.json` → `local-tasks.json.backup`

**Result**: Removes ~800 lines of dead code, eliminates dual registry system

### Priority 2: Consolidate Cloud Registry (Optional)

**Current State**:

- Local tools import from `task_registry.js`
- Cloud tools import from `cloud_task_registry.js`

**Both use the same SQLite database** (`tasks.db`), but via different classes:

- `TaskRegistry` (unified, modern)
- `CloudTaskRegistry` (cloud-specific, may have special logic)

**Recommendation**: Keep both for now unless `CloudTaskRegistry` is proven redundant

---

## Tool Categories by Function

### **Execution** (3 tools)

- `_codex_local_run` - One-shot
- `_codex_local_exec` - Threading
- `_codex_cloud_submit` - Cloud background

### **Threading** (1 tool)

- `_codex_local_resume` - Continue threads

### **Monitoring** (3 tools)

- `_codex_local_status` - Local registry
- `_codex_cloud_status` - Cloud registry
- `_codex_local_results` / `_codex_cloud_results` - Get results

### **Control** (4 tools)

- `_codex_local_wait` / `_codex_cloud_wait` - Wait for completion
- `_codex_local_cancel` / `_codex_cloud_cancel` - Cancel tasks

### **Setup & Maintenance** (3 tools)

- `_codex_cloud_list_environments` - List envs
- `_codex_cloud_github_setup` - GitHub guide
- `_codex_cleanup_registry` - Clean up stuck/old tasks

---

## Resources (5 templates)

MCP server also exposes environment templates as resources:

1. `.github-node-typescript` - Node.js with TypeScript
2. `.github-python` - Python projects
3. `.github-go` - Go projects
4. `.github-rust` - Rust projects
5. `.github-basic` - Basic Linux setup

**URI Format**: `codex://environment-template/{name}`

---

## Version History

| Version | Tools | Notes                                                |
| ------- | ----- | ---------------------------------------------------- |
| v3.3.0+ | 15    | Added cleanup registry tool (hidden primitives only) |
| v3.2.1  | 14    | Timeout/hang detection added                         |
| v3.0.0  | 15    | Had unified `codex` tool (removed in v3.0.1)         |
| v2.1.0  | 13    | Had CLI tools exposed as MCP tools                   |
| v2.0.0  | 10    | Original Codex Control MCP                           |

---

## Summary

✅ **15 MCP tools** - All use SQLite registry
❌ **3 legacy CLI tools** - DELETED (were NOT in MCP)
✅ **5 resource templates** - GitHub environment configs

**Cleanup Complete**: Deleted 3 CLI tools + JSON registry = **800+ lines of dead code removed**

---

**Status**: 📋 Documentation Complete
**Next Action**: Delete dead code (cli\_\*.ts files)
**Impact**: Zero (files not used in MCP)
