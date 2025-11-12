# Changelog

All notable changes to Codex Control MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.1] - 2025-11-12

### Added

**Async/Non-Blocking Execution for All Tools** 🔥

All tools now support non-blocking async execution - Claude Code never freezes waiting for Codex!

- **CLI Tools Made Async-Capable**:
  - Added `async: true` parameter to `codex_cli_run`, `codex_cli_plan`, `codex_cli_apply`
  - Returns task ID immediately for background execution
  - Use `codex_local_status` and `codex_local_results` to check progress

- **SDK Tools Always Async** (Fixed Critical Thread ID Bug):
  - `codex_local_exec` now generates proper task IDs (was returning `null`)
  - Integrated with LocalTaskRegistry for task tracking
  - Background Promise execution with immediate task ID return
  - Thread ID captured during execution for use with `codex_local_resume`

- **CLI Tools Renamed for Clarity**:
  - `codex_run` → `codex_cli_run`
  - `codex_plan` → `codex_cli_plan`
  - `codex_apply` → `codex_cli_apply`
  - `codex_status` → `codex_cli_status`
  - Naming now clearly indicates execution mechanism (CLI vs SDK vs Cloud)

- **New Status & Results Tools**:
  - `codex_local_status` - Check status of local async tasks
  - `codex_local_results` - Retrieve results of completed tasks
  - LocalTaskRegistry persists tasks across MCP server restarts

- **Tool Count Updated**: 13 → 15 tools total

**Testing**: All async tools validated in production - see `ASYNC-TEST-RESULTS.md`

### Fixed

**Critical Bug Fixes - Mode Parameter and MCP Response Format**

Three critical bugs have been identified and fixed that prevented the MCP server from functioning correctly:

#### Bug #1: Mode Parameter Mismatch ✅
- **Issue**: Code used deprecated `full-auto` value, but Codex CLI v0.57.0 expects `workspace-write`
- **Symptom**: `invalid value 'full-auto' for '--sandbox <SANDBOX_MODE>'` errors
- **Fix**: Replaced all occurrences of `full-auto` with `workspace-write` in 6 source files
- **Files Updated**:
  - `src/tools/run.ts`
  - `src/tools/apply.ts`
  - `src/tools/local_exec.ts`
  - `src/tools/local_resume.ts`
  - `src/executor/process_manager.ts`
  - `src/security/input_validator.ts`
  - All documentation files (README.md, quickrefs/)

#### Bug #2: Misleading Tool Count ✅
- **Issue**: `codex_status` showed hardcoded list of 4 tools instead of all 13
- **Symptom**: Users reported "Only 4 tools available" when all 13 were actually registered
- **Fix**: Updated `src/tools/status.ts` to show categorized list of all 13 tools
- **Impact**: Status reporting now accurate and complete

#### Bug #3: SDK Tools Silent Failure ✅ (MOST CRITICAL)
- **Issue**: `codex_local_exec` and `codex_local_resume` returned raw objects instead of MCP-compatible format
- **Symptom**: "Tool ran without output or errors" - silent failures with no error messages
- **Root Cause**: Tools didn't wrap responses in `{ content: [{ type: 'text', text: '...' }] }` format required by MCP protocol
- **Fix**:
  - Added MCP-compatible response wrapper to both tools
  - Added extensive debug logging to stderr for troubleshooting
  - Changed return type from specific interfaces to `Promise<any>` for flexibility
- **Files Updated**:
  - `src/tools/local_exec.ts`
  - `src/tools/local_resume.ts`

#### Bug #4: Process Tracking Visibility ✅
- **Issue**: `codex_status` only showed ProcessManager-tracked processes, missing SDK-spawned processes
- **Symptom**: System shows running `codex exec` processes but `codex_status` reports 0 active processes
- **Root Cause**: SDK tools (`codex_local_exec`, `codex_local_resume`) spawn processes via `@openai/codex-sdk` which aren't registered with ProcessManager
- **Impact**: Users had no visibility into SDK-spawned processes, couldn't detect stuck/orphaned processes
- **Fix**:
  - Added system-wide process detection to `codex_status`
  - Now shows total processes, CLI-tracked vs SDK-spawned breakdown
  - Displays process details (PID, CPU, memory, start time) for all `codex exec` processes
  - Warns when SDK-spawned processes detected
- **Files Updated**:
  - `src/tools/status.ts` - Added `detectSystemProcesses()` method using `ps aux`
- **Example Output**:
  ```
  **Total Codex Processes**: 1
    - CLI-tracked: 0
    - SDK-spawned: 1

  **System-Wide Process Details**:
  - PID 70565 | Started 4:29PM | CPU 0.5% | Mem 0.1%
    codex exec --experimental-json ...

  ⚠️ Detected 1 SDK-spawned process(es) - not tracked by ProcessManager
  💡 SDK processes are spawned by codex_local_exec and codex_local_resume
  ```

#### Bug #5: SDK Tools Async Streaming Returns Empty ✅ (CRITICAL - Production Testing)
- **Issue**: `codex_local_exec` and `codex_local_resume` spawn processes successfully but return empty output to Claude Code
- **Symptom**: "Tool ran without output or errors" - process visible in `codex_status` but no results returned via MCP
- **Discovery**: Found during production testing (2025-11-12 5:00 PM)
- **Root Cause**: Async event streaming loop (`for await (const event of events)`) was blocking MCP's request-response mechanism
  - MCP has 60-second timeout (confirmed via GitHub issue #245)
  - Event stream consumption wasn't explicitly completing before return
  - No logging to diagnose where async execution was failing
- **Fix**:
  - Added comprehensive execution logging throughout both tools
  - Added try-catch around event streaming loop with detailed error handling
  - Added event-by-event logging to track stream consumption
  - Explicit logging before return to verify response creation
  - Proper async stream completion handling
- **Files Updated**:
  - `src/tools/local_exec.ts` - Added 20+ log statements, improved error handling
  - `src/tools/local_resume.ts` - Added 20+ log statements, improved error handling
- **Test Results**:
  - ✅ `codex_local_exec`: Returns complete output with thread ID, all events, final response, usage stats
  - ✅ `codex_local_resume`: Returns complete output with 97% cache rate (11,008/11,365 tokens cached)
  - ✅ Thread persistence working: Follow-up tasks leverage cached context
  - ✅ Real-time event streaming visible in logs
  - ✅ Both tools tested successfully in production (codex-control directory)
- **Impact**: SDK tools now fully functional, enabling iterative development workflows with thread persistence

### Validated

**Testing Results** (2025-11-12):
- ✅ All 13 tools now discoverable via `codex_status`
- ✅ `codex_local_exec` working perfectly - Full output with thread ID, events, usage stats
- ✅ `codex_local_resume` working perfectly - 97% cache rate (11,008/11,365 tokens cached)
- ✅ Thread persistence verified - Follow-up tasks leverage cached context
- ✅ `codex_run` executes without mode parameter errors
- ✅ `codex_status` now detects SDK-spawned processes correctly (Bug #4 fix verified)
- ✅ Process tracking visibility fixed (tested in auditor-toolkit)
- ✅ 100% test success rate in codex-control directory
- ✅ Successfully tested in auditor-toolkit environment
- ✅ Bug #5 fix validated in production (codex-control directory, 2025-11-12 5:30 PM)

**Documentation Updated**:
- README.md: All mode parameter references updated
- quickrefs/tools.md: Tool examples updated
- quickrefs/workflows.md: Workflow examples updated
- quickrefs/security.md: Security validation updated
- quickrefs/architecture.md: Mode whitelist updated
- CLAUDE.md: Current focus section updated with bug fix status
- Test results: `TEST-RESULTS-CODEX-CONTROL-DIRECTORY.md` created
- **KNOWN-ISSUES.md**: Created new file documenting:
  - Issue #1: Python version mismatch in SDK tasks (workarounds included)
  - Issue #2: Process tracking visibility (fixed in v2.1.1)

## [2.1.0] - 2025-11-11

### Added

**Dual Execution Modes - Local SDK Integration with Real-Time Visibility**

Codex Control MCP now supports **dual execution modes**: local execution with real-time event streaming via TypeScript SDK, and background execution in Codex Cloud. This gives users complete flexibility in choosing between real-time visibility (local) and fire-and-forget background execution (cloud).

#### New Tools (4 added)

**1. `codex_local_exec` - Local Execution with SDK**

Execute Codex tasks locally with real-time event streaming, full status visibility, and thread management via `@openai/codex-sdk` TypeScript library.

**Key Features:**
- ✅ **Real-Time Event Streaming**: See exactly what Codex is doing as it happens
- ✅ **Thread Management**: Get thread ID for resumption across sessions
- ✅ **Token Tracking**: Monitor input/output/cached tokens in real-time
- ✅ **Full Event Log**: Access all turn events (`turn.started`, `item.completed`, `turn.completed`)
- ✅ **Structured Output**: JSON Schema validation for programmatic responses
- ✅ **Persistent Threads**: Threads stored in `~/.codex/sessions` for later resumption

**Parameters:**
- `task` (required): Task description for Codex
- `workingDir` (optional): Working directory (defaults to current)
- `mode` (optional): Execution mode (`read-only`, `workspace-write`, `danger-full-access`)
- `outputSchema` (optional): JSON Schema for structured output
- `skipGitRepoCheck` (optional): Skip Git repository check (default: false)
- `model` (optional): OpenAI model (`gpt-5-codex`, `gpt-5`, etc.)

**2. `codex_local_resume` - Thread Resumption**

Resume previous local thread with follow-up tasks and full conversation context preservation.

**Key Features:**
- ✅ **Context Preservation**: Full conversation history maintained across sessions
- ✅ **Iterative Development**: Break large tasks into multiple steps
- ✅ **Session Persistence**: Threads survive Claude Code restarts
- ✅ **Token Efficiency**: Previous context is cached for cost savings
- ✅ **Follow-Up Questions**: Continue conversations without repeating context

**Parameters:**
- `threadId` (required): Thread ID from previous `codex_local_exec` execution
- `task` (required): Follow-up task to execute
- `mode` (optional): Execution mode (defaults to previous thread's mode)
- `outputSchema` (optional): JSON Schema for structured output

**Use Cases:**
- Multi-step refactoring (analyze → plan → apply)
- Iterative bug fixes (find → fix → test)
- Code reviews with follow-ups (review → explain → suggest)
- Exploratory analysis (investigate → deeper dive → conclusions)

**3. `codex_cloud_check_reminder` - Pending Task Reminder**

Check for pending Codex Cloud tasks and get Web UI links for status checking. Addresses the limitation that Codex Cloud has no programmatic status polling API.

**Key Features:**
- ✅ **Organized Tracking**: See all pending tasks in one place
- ✅ **Direct Links**: Click to check status without searching Web UI
- ✅ **Time Context**: Know how long tasks have been running (minutes elapsed)
- ✅ **Persistent Registry**: Survives Claude Code restarts

**Use Cases:**
- Periodic checks during development
- Morning review of overnight tasks
- Before submitting new tasks (check queue)
- After long breaks (catch up on task status)

**Behind the Scenes:** Reads from `~/.config/codex-control/cloud-tasks.json` and filters for tasks with `status='submitted'`.

**4. `codex_list_environments` - Environment Registry**

List available Codex Cloud environments from local configuration. Addresses the limitation that Codex Cloud has no programmatic API for environment discovery.

**Key Features:**
- ✅ **Local Registry**: Track all your Codex Cloud environments
- ✅ **Quick Reference**: See environment IDs without Web UI
- ✅ **Metadata**: Store descriptions, repo URLs, and tech stacks
- ✅ **Discoverable**: Claude Code can see all available environments

**Configuration:** User-maintained file at `~/.config/codex-control/environments.json`

**Example:**
```json
{
  "seo-ads-expert-online": {
    "name": "SEO Ads Expert",
    "repoUrl": "https://github.com/littlebearapps/seo-ads-expert",
    "stack": "node",
    "description": "SEO and Google Ads automation tool"
  }
}
```

#### Execution Mode Comparison

Codex Control MCP now provides **three execution approaches**:

| Feature | Local CLI (Tools 1-4) | Local SDK (Tools 9-10) 🆕 | Cloud (Tools 5-8) |
|---------|---------------------|----------------------|------------------|
| **Real-Time Status** | ❌ Blocking | ✅ Event Streaming | ❌ Background |
| **Thread Resumption** | ❌ No | ✅ Yes | ❌ No |
| **Token Visibility** | ❌ No | ✅ Yes | ❌ No |
| **Session Persistence** | ❌ No | ✅ Yes | ✅ Yes |
| **Execution Location** | Local Mac | Local Mac | Cloud Containers |
| **Best For** | Quick tasks | Iterative development | Long-running tasks |
| **Max Duration** | ~5-10 minutes | No hard limit | Hours |
| **Context Preservation** | ❌ No | ✅ Full thread history | ❌ No |

**Recommendations:**

**Use Local SDK** when:
- You want real-time progress visibility
- You need to ask follow-up questions
- You're doing iterative development (analyze → fix → test)
- You want to track token usage and costs
- Tasks take 5-30 minutes with multiple steps

**Use Cloud** when:
- Tasks will take hours (full test suites, comprehensive refactoring)
- You want fire-and-forget execution
- You need sandboxed environment with specific dependencies
- You want to continue working on other tasks
- Tasks run overnight or across multiple sessions

### Changed

- **Tool Count**: 9 tools → 13 tools (4 new tools added)
- **Architecture**: Added Local SDK execution mode with TypeScript SDK integration
- **Documentation**: Comprehensive execution mode comparison guide added to README
- **Components**: Updated architecture diagrams to show dual execution modes

### Dependencies

- **Added**: `@openai/codex-sdk@^0.57.0` - TypeScript SDK for local execution with streaming

### Implementation

**New Files:**
- `src/tools/local_exec.ts` - Local execution with SDK
- `src/tools/local_resume.ts` - Thread resumption
- `src/tools/cloud_check_reminder.ts` - Pending task reminder
- `src/tools/list_environments.ts` - Environment registry

**Updated Files:**
- `src/index.ts` - Register 4 new tools, update server version to 2.1.0
- `package.json` - Add `@openai/codex-sdk` dependency, version 2.1.0
- `README.md` - Comprehensive documentation update (300+ lines added)
- `CHANGELOG.md` - This file

### Why Version 2.1.0?

This is a **minor version bump** (not 3.0.0) because:
- ✅ No breaking changes to existing tools
- ✅ All v2.0.x functionality preserved
- ✅ New tools are additive, not replacing anything
- ✅ Existing users can upgrade without changes
- ✅ Backward compatible with v2.0.0

**Feature Significance:**
- Major feature addition (dual execution modes)
- Addresses two known limitations (Cloud status polling, environment discovery)
- Enables new workflows (iterative development, thread resumption)
- TypeScript SDK integration expands capabilities significantly

### User Configuration

**New Optional Config:** `~/.config/codex-control/environments.json`

Create this file to enable `codex_list_environments` tool:

```json
{
  "env-id-1": {
    "name": "Project Name",
    "repoUrl": "https://github.com/user/repo",
    "stack": "node|python|go|rust",
    "description": "Optional description"
  }
}
```

### Migration

**From v2.0.0 to v2.1.0:**
- No migration required
- New tools are immediately available after upgrade
- Optionally create `~/.config/codex-control/environments.json` to use environment listing
- Existing workflows continue working unchanged

### Known Limitations

**Addressed in this release:**
- ✅ ~~No programmatic Cloud task status polling~~ - Now have `codex_cloud_check_reminder` with Web UI links
- ✅ ~~No programmatic environment discovery~~ - Now have `codex_list_environments` with local registry

**Still present:**
- Codex Cloud TUI is interactive-only (not scriptable yet)
- Environment configuration has NO programmatic API (web UI only)

**Workarounds:**
- Use Web UI links from `codex_cloud_check_reminder` to check Cloud task status
- Maintain local registry in `~/.config/codex-control/environments.json` for environment discovery

### See Also

- Enhancement Research: Previous conversation summary
- TypeScript SDK Docs: `@openai/codex-sdk` package
- README: Complete usage guide with all 13 tools

---

## [2.0.0] - 2025-11-11

### Added

**GitHub Setup Helper Tool - Complete Autonomous Workflow**

New interactive tool `codex_github_setup_guide` enables Claude Code to autonomously guide users through complete GitHub integration setup without external documentation.

**Tool Capabilities:**
- **Custom Setup Guides**: Generate repository-specific configuration instructions
- **Fine-Grained Token Instructions**: Step-by-step GitHub PAT creation with exact permissions
- **Pre-filled Scripts**: Setup and maintenance scripts customized for repository and tech stack
- **Test Task Generation**: Verification task with expected results
- **Troubleshooting Guide**: Common issues and solutions specific to the configuration
- **Technology Stack Support**: Node.js, Python, Go, Rust
- **Git Configuration**: Customizable user name and email for commits

**Interactive Workflow:**
1. User provides: repository URL, technology stack, optional git config
2. Tool generates: complete setup guide (8 sections, 400+ lines)
3. User follows: token creation, environment configuration, test task
4. Result: Fully configured autonomous GitHub PR workflow

**Tool Schema:**
```json
{
  "repoUrl": "https://github.com/user/my-project",
  "stack": "node",
  "gitUserName": "Codex Agent",
  "gitUserEmail": "codex@example.com"
}
```

**Generated Guide Includes:**
- **Step 1**: Create Fine-Grained GitHub Token (with exact permissions list)
- **Step 2**: Configure Codex Cloud Environment
  - Basic configuration (name, repo URL, branch)
  - Secrets (GITHUB_TOKEN)
  - Environment variables (GIT_USER_NAME, GIT_USER_EMAIL, stack-specific)
  - Setup script (pre-filled from template)
  - Maintenance script (pre-filled from template)
- **Step 3**: Test GitHub Integration (with test task JSON)
- **Troubleshooting**: 4 common issues with solutions
- **Next Steps**: Best practices and example workflows

**Implementation:**
- New file: `src/tools/github_setup.ts` (GitHubSetupTool class)
- Updated: `src/index.ts` (tool registration and handler)
- Tool name: `codex_github_setup_guide`
- Error handling: Repository URL validation, stack validation, template lookup

**Security:**
- No hardcoded credentials
- Token instructions emphasize fine-grained permissions
- Secrets vs environment variables clearly distinguished
- Repository-scoped access (not account-wide)

### Why Version 2.0.0?

This is a **major version bump** because:
- ✅ Complete autonomous workflow capability achieved (no external docs required)
- ✅ New tool adds significant user-facing functionality
- ✅ Phase 3 (final phase) of v2.0 enhancement plan complete
- ✅ Signals transformation from "tool wrapper" to "complete autonomous assistant"
- ✅ All three phases delivered: Enhanced Schemas (1.4.0) + Templates (1.5.0) + Setup Tool (2.0.0)

**Backward Compatibility:**
- No breaking changes to existing tools
- All v1.x functionality preserved
- New tool is additive, not replacing anything
- Existing users can upgrade without changes

### Documentation

**Updated:**
- `CHANGELOG.md`: v2.0.0 release notes
- `README.md`: Comprehensive usage guide with setup tool examples
- `CONTRIBUTING.md`: Already includes setup tool contribution guidelines

**See Also:**
- Enhancement Plan: `/docs/sdks/CODEX-CONTROL-V2-ENHANCEMENT-PLAN.md`
- Setup Tool: `src/tools/github_setup.ts`
- Tool Schema: Listed in `codex_github_setup_guide` tool definition

---

## [1.5.0] - 2025-11-11

### Added

**Environment Template System via MCP Resources**

Five pre-configured environment templates now available via MCP resources for streamlined Codex Cloud GitHub integration:

**Templates:**
- **github-node-typescript**: Node.js/TypeScript projects with GitHub PR workflow
- **github-python**: Python projects with GitHub PR workflow
- **github-go**: Go projects with GitHub PR workflow
- **github-rust**: Rust projects with GitHub PR workflow
- **basic-codex-cloud**: Basic environment without GitHub integration

**Template Features:**
- **4-Level Fallback Error Handling**: Graceful degradation when GitHub CLI installation fails
  - Level 1: Standard APT installation
  - Level 2: Direct binary download
  - Level 3: Graceful degradation (warn and continue)
  - Level 4: Clear manual installation instructions
- **Setup Scripts**: Automated git configuration, GitHub CLI installation, dependency installation
- **Maintenance Scripts**: Cached container dependency updates
- **Comprehensive Instructions**: Step-by-step setup guides with token creation, troubleshooting
- **Security**: Fine-grained token permissions, no hardcoded credentials, secrets validation

**MCP Resources:**
- `ListResourcesRequestSchema`: Discover available templates
- `ReadResourceRequestSchema`: Read full template configuration
- Templates exposed via `codex://environment-template/{name}` URIs

**Infrastructure:**
- New TypeScript interfaces in `src/types/template_types.ts`
- Template definitions in `src/resources/environment_templates.ts`
- Python validation script: `scripts/validate_templates.py`
- GitHub Actions CI workflow: `.github/workflows/validate-templates.yml`
- Comprehensive `CONTRIBUTING.md` with template development guidelines

**Quality Assurance:**
- Automated template validation (structure, secrets, scripts)
- CI checks for hardcoded credentials
- Required template verification
- 4-level fallback validation

### Why Version 1.5.0?

This is a minor version bump (not 2.0.0) because:
- No breaking changes to existing tool interfaces
- Adds new MCP resources capability (backward compatible)
- No new tools added yet (Phase 3 will add github_setup_guide)
- Existing users unaffected, new resources are opt-in

Version 2.0.0 will be released after Phase 3 (GitHub Setup Helper Tool) to signal the complete autonomous workflow capability.

### See Also

- Enhancement Plan: `/docs/sdks/CODEX-CONTROL-V2-ENHANCEMENT-PLAN.md`
- Template Development: `CONTRIBUTING.md`
- Validation Script: `scripts/validate_templates.py`

---

## [1.4.0] - 2025-11-11

### Added

**Enhanced Tool Schemas for Autonomous Understanding**

All Codex Cloud tool schemas have been enhanced with comprehensive structured descriptions that enable Claude Code to understand complete workflows autonomously without external documentation.

**Schema Enhancements:**
- **codex_cloud_submit**: Added PREREQUISITES, WORKFLOW, TASK DESCRIPTION BEST PRACTICES, GITHUB CAPABILITIES, and SETUP GITHUB sections
- **codex_cloud_status**: Added USAGE, WORKFLOW, STATUS VALUES, and WEB UI sections
- **codex_cloud_results**: Added USAGE, RESULTS INCLUDE, GITHUB PR WORKFLOW, and WEB UI sections
- **codex_cloud_list_tasks**: Added USAGE, FILTERING OPTIONS, TASK INFORMATION INCLUDES, USE CASES, and STATISTICS sections

**Token Budget:**
- Total schema descriptions: 1,051 tokens (35% of 3,000 token budget)
- Remaining headroom: 1,949 tokens (65%)
- Well under target for Phase 2 (Environment Templates) and Phase 3 (GitHub Setup Tool)

**Validation:**
- All schemas compile without errors
- All schemas pass structural validation
- Token count verified via automated script

### Technical Details

This release is the first phase of the v2.0 enhancement plan (autonomous GitHub workflows). Phase 1 focuses on making existing tools more discoverable and understandable through enhanced documentation.

**Why Version 1.4.0?**

This is a minor version bump (not 2.0.0) because:
- No breaking changes to existing tool interfaces
- No new tools added (that comes in Phase 3)
- Only enhanced documentation in tool schemas
- Fully backward compatible with v1.3.0

Version 2.0.0 will be released after Phase 3 (GitHub Setup Helper Tool) to signal the complete autonomous workflow capability.

### See Also

- Enhancement Plan: `/docs/sdks/CODEX-CONTROL-V2-ENHANCEMENT-PLAN.md`
- Token Analysis: `scripts/count-tokens.sh`
- Schema Validation: `scripts/validate-schemas.cjs`

---

## [1.3.0] - 2025-11-11

### Added

- Initial MCP server implementation
- Cloud task submission (`codex_cloud_submit`)
- Cloud task status checking (`codex_cloud_status`)
- Cloud task results retrieval (`codex_cloud_results`)
- Cloud task listing with filtering (`codex_cloud_list_tasks`)
- Persistent task tracking across Claude Code restarts
- Working directory-based task filtering
- Redaction system for sensitive data (secrets, tokens, API keys)

### Technical Details

- Built on MCP SDK 1.0.4
- Requires Node.js >= 20.0.0
- Uses Codex CLI (`codex` command) for all Codex Cloud interactions
- Task registry stored in `~/.codex-control-mcp/task-registry.json`

---

[1.4.0]: https://github.com/littlebearapps/codex-control-mcp/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/littlebearapps/codex-control-mcp/releases/tag/v1.3.0
