# Codex Control MCP Server - Fix Summary

**Date**: 2025-11-12
**Version**: 2.1.0 (patched)

## Issues Fixed

### 1. ✅ Mode Parameter Bug (CRITICAL)

**Problem**: MCP server used `full-auto` but Codex CLI v0.57.0 expects `workspace-write`

**Error Encountered**:

```
invalid value 'full-auto' for '--sandbox <SANDBOX_MODE>'
```

**Root Cause**:

- Codex CLI v0.57.0 changed parameter name from `--mode` to `--sandbox`
- Valid values: `read-only`, `workspace-write`, `danger-full-access`
- MCP server was using outdated `full-auto` parameter

**Files Fixed** (6 total):

1. `src/tools/run.ts` - TypeScript interface + JSON schema
2. `src/tools/apply.ts` - TypeScript interface + JSON schema + default value
3. `src/tools/local_exec.ts` - Zod schema + descriptions + examples (4 locations)
4. `src/tools/local_resume.ts` - Zod schema
5. `src/executor/process_manager.ts` - TypeScript interface
6. `src/security/input_validator.ts` - Validation array + confirmation check

**Changes Made**:

- All `'full-auto'` → `'workspace-write'` globally
- Updated type definitions, schemas, descriptions, and examples
- Fixed validation logic to accept new parameter name

---

### 2. ✅ Hardcoded Tool List in codex_status (CRITICAL)

**Problem**: `codex_status` tool showed hardcoded list of only 4 tools instead of all 13

**Impact**: Users thought only 4 tools were available, but all 13 were actually registered!

**File Fixed**:

- `src/tools/status.ts` - Updated to show all 13 tools with categorization

**Changes Made**:

- Replaced hardcoded 4-tool list with complete 13-tool list
- Added categorization (CLI, SDK, Cloud, Configuration)
- Made it clear this is the tool list, not MCP discovery results

### 3. ✅ MCP Profile Configuration (IMPORTANT)

**Problem**: codex-control only configured in default `.mcp.json`, missing from other profiles

**Impact**: Users switching to lean/full/research profiles would lose codex-control entirely

**Files Fixed** (3 total):

1. `/lba/tools/auditor-toolkit/main/.mcp.lean.json`
2. `/lba/tools/auditor-toolkit/main/.mcp.full.json`
3. `/lba/tools/auditor-toolkit/main/.mcp.research.json`

**Changes Made**:

- Added codex-control MCP server configuration to all 3 profiles
- Ensures consistent availability regardless of active profile

---

## Testing Results

### Build Verification

```bash
$ npm run build
✅ SUCCESS - No TypeScript errors

$ node dist/index.js
✅ [CodexControl] Server started successfully
✅ [CodexControl] Tools: codex_run, codex_plan, codex_apply, codex_status,
   codex_cloud_submit, codex_cloud_status, codex_cloud_results, codex_cloud_list_tasks,
   codex_github_setup_guide, codex_local_exec, codex_local_resume,
   codex_cloud_check_reminder, codex_list_environments
✅ All 13 tools registered
```

### Mode Parameter Validation

```bash
$ codex exec --help | grep sandbox
✅ [possible values: read-only, workspace-write, danger-full-access]
```

---

## User Testing Required

### Prerequisites

1. ✅ MCP server rebuilt with fixes
2. ✅ Auditor-toolkit MCP profiles updated
3. ⏳ **Restart Claude Code session** (required to reload MCP servers)

### Test Plan

#### Test 1: Tool Discovery

```
# In auditor-toolkit Claude Code session
/mcp

Expected: Should show codex-control with all 13 tools
```

#### Test 2: Mode Parameter

```
# Use any codex tool with workspace-write mode
mcp__codex-control__codex_run with mode='workspace-write'

Expected: No "invalid value" errors
```

#### Test 3: Simple Task Execution

```
# Try a simple read-only task first
Task: "List all TODO comments in this codebase"
Mode: read-only

Expected: Task completes successfully
```

#### Test 4: Workspace Write Mode

```
# Try a file modification task
Task: "Add a console.log statement to utils.ts"
Mode: workspace-write
Confirm: true

Expected: Task completes and modifies file
```

---

## Rollout Plan

### Phase 1: Auditor Toolkit (Current)

- ✅ Fix applied
- ⏳ **User testing required**
- Status: Ready for testing

### Phase 2: Other Projects (After successful test)

Apply same fixes to all 18 projects:

1. Root (instH)
2. Brand Copilot (instA)
3. NoteBridge (instD)
4. Palette Kit (instE)
5. Convert My File (instF)
6. Little Bear Apps (instG)
7. CloakPipe (instI)
8. Homeostat (instJ)
9. Gatekeeper (instK)
10. Marketing (instL)
11. Platform (instM)
12. Tester (instN)
13. WP Navigator Pro (instO)
14. Focus Calendar (instP)
15. MCP Keychain (instQ)
16. Illustrations (instR)
17. Homeless Hounds (instC)
18. Auditor Toolkit (instB) ← **Currently testing**

**Rollout Method**:

- Update all `.mcp.json`, `.mcp.lean.json`, `.mcp.full.json`, `.mcp.research.json` files
- Add codex-control configuration block to each profile
- No rebuild needed (server is centralized)

---

## Additional Findings (From Expert Analysis)

### Documentation Update Needed

⚠️ **README.md still uses outdated 'full-auto' in examples**

**Files to Update**:

- `README.md` (multiple locations: lines 195-199, 289-296, 311-332, 743-751, 768-771, 801-804)
- `quickrefs/tools.md`
- `quickrefs/workflows.md`

**Action**: Update documentation to use `workspace-write` consistently

### Silent Failure Investigation (Medium Priority)

Expert analysis suggests investigating ProcessManager spawn error handling:

- Add explicit child_process 'error' event handlers
- Log spawn attempts and failures
- Verify PATH includes Codex CLI location
- Surface ENOENT errors more clearly

**Current Status**: Deferred (not blocking current functionality)

---

## Summary

**What Was Broken**:

1. Mode parameter mismatch causing CLI errors
2. Missing MCP profile configurations limiting availability

**What Was Fixed**:

1. All 6 source files updated to use `workspace-write`
2. All 3 auditor-toolkit MCP profiles now include codex-control
3. Server rebuilt and verified working

**What's Next**:

1. User tests with auditor-toolkit
2. If successful, roll out to all 18 projects
3. Update documentation (README.md and quickrefs)
4. Consider adding ProcessManager error surfacing

---

## Git Commit Message (When Ready)

```
fix(codex-control): replace deprecated 'full-auto' with 'workspace-write'

BREAKING CHANGE: Mode parameter 'full-auto' replaced with 'workspace-write'
to match Codex CLI v0.57.0 specification.

- Update all tool schemas and validation to use 'workspace-write'
- Add codex-control to all auditor-toolkit MCP profiles (lean/full/research)
- Fix mode parameter in 6 source files
- Rebuild dist/ with corrected parameters

Affects: run, apply, local_exec, local_resume, process_manager, input_validator

Closes: #[issue-number]
```

---

## Contact

Issues or questions? Check:

- `quickrefs/troubleshooting.md` for common problems
- `TEST-RESULTS-v2.1.0.md` for validation results
- `README.md` for tool documentation
