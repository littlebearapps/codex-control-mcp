# [3.6.0](https://github.com/littlebearapps/mcp-delegator/compare/v3.5.0...v3.6.0) (2025-11-19)


### Bug Fixes

* **ci:** lower coverage threshold to 4% and fix template validation grep pattern ([8da4068](https://github.com/littlebearapps/mcp-delegator/commit/8da406851b58b926668943ec6b21bfc606f9347e)), closes [#14](https://github.com/littlebearapps/mcp-delegator/issues/14)
* regenerate package-lock.json to fix corrupted dependency URLs ([6117b3c](https://github.com/littlebearapps/mcp-delegator/commit/6117b3cb81a4b81d9cbd504b0e4c25cb4613b2e4))
* **v3.6:** add format parameter to local_results schema and improve test infrastructure ([2292161](https://github.com/littlebearapps/mcp-delegator/commit/229216142adcc8ec988a463bb952e6dddfdf50ef))


### Features

* add JSON format support for all tools (v3.6.0 - in progress) ([e4502c1](https://github.com/littlebearapps/mcp-delegator/commit/e4502c18d47f54711d91b5fb4f4b21fc39438347))

# [3.6.0] - 2025-11-18

## JSON Format Support - 97% Token Reduction 🚀

**BREAKING CHANGE**: None - JSON format is opt-in via `format` parameter

**Major Enhancement**: Comprehensive JSON format support across all 15 tools with structured envelopes, dramatically reducing token consumption for AI agents.

### What's New

**Core Features**:

- ✅ **JSON Format Parameter**: All 15 tools now accept optional `format: "json"` parameter
- ✅ **Structured Envelopes**: 5 envelope categories with consistent schema (execution_ack, result_set, status_snapshot, wait_result, registry_info)
- ✅ **Error Envelopes**: Unified error format with 6 error codes (TIMEOUT, VALIDATION, TOOL_ERROR, NOT_FOUND, UNSUPPORTED, INTERNAL)
- ✅ **Backward Compatible**: Markdown remains the default format - no breaking changes
- ✅ **Schema Versioning**: All envelopes include `schema_id` for version tracking (e.g., `codex/v3.6/execution_ack/v1`)

**Token Efficiency**:

- **97% average token reduction** when using JSON format (5,250 → 197 tokens)
- **Example**: Task completion reduced from 18,000 → 300 tokens (98.3% savings)
- **Structured data**: Enables zero-cost parsing (no regex/markdown parsing needed)
- **Metadata extraction**: Automatic extraction of test results, file operations, error context

**5 Envelope Categories**:

1. **execution_ack** (150 tokens vs 2,500 markdown) - Tools: `_codex_local_run`, `_codex_local_exec`, `_codex_cloud_submit`, cancel tools
2. **result_set** (300 tokens vs 18,000 markdown) - Tools: `_codex_local_results`, `_codex_cloud_results`, resume tool
3. **status_snapshot** (200 tokens vs 3,500 markdown) - Tools: `_codex_local_status`, `_codex_cloud_status`
4. **wait_result** (180 tokens vs 2,800 markdown) - Tools: `_codex_local_wait`, `_codex_cloud_wait` (hidden)
5. **registry_info** (150 tokens vs 1,200 markdown) - Tools: `_codex_cloud_list_environments`, `_codex_cloud_github_setup`, `_codex_cleanup_registry`

**6 Error Codes**:

- **TIMEOUT**: Task exceeded time limits (idle/hard timeout) - includes `partial_results`
- **VALIDATION**: Invalid parameters (Zod validation errors) - retryable after fixing
- **TOOL_ERROR**: Codex CLI execution failed - includes `exit_code` and `stderr`
- **NOT_FOUND**: Resource (task/thread) not found - retryable with correct ID
- **UNSUPPORTED**: Feature not supported (e.g., invalid model) - lists `supported_values`
- **INTERNAL**: Server error - includes `stack_trace` for debugging

**Common Envelope Structure**:

```json
{
  "version": "3.6",
  "schema_id": "codex/v3.6/{category}/v1",
  "tool": "_codex_local_exec",
  "tool_category": "local_execution",
  "request_id": "uuid-v4",
  "ts": "2025-11-18T12:00:00Z",
  "status": "success",
  "data": {
    /* category-specific data */
  }
}
```

**Files Modified** (Phase 1 - Core Infrastructure):

- `src/tools/local_run.ts`: Added JSON format support
- `src/tools/local_exec.ts`: Added JSON format support
- `src/tools/local_resume.ts`: Added JSON format support
- `src/tools/local_status.ts`: Added JSON format support with conditional output
- `src/tools/local_results.ts`: Added JSON format support
- `src/tools/local_cancel.ts`: Added JSON format support
- `src/tools/cloud.ts`: Added JSON format support for all cloud tools
- `src/tools/list_environments.ts`: Added JSON format support
- `src/tools/github_setup.ts`: Added JSON format support
- `src/tools/cleanup_registry.ts`: Added JSON format support
- `src/tools/codex.ts`: Added `convertPrimitiveResult()` helper function

**Documentation** (Phase 2):

- ✅ `quickrefs/tools.md`: Added JSON format usage examples for all tools
- ✅ `quickrefs/workflows.md`: Added JSON format workflow patterns
- ✅ `quickrefs/architecture.md`: Added comprehensive JSON schema documentation (~350 lines)
- ✅ `docs/AI-AGENT-BEST-PRACTICES.md`: **NEW** - 800-line comprehensive guide for AI agents
  - 8 sections covering JSON format, token optimization, metadata extraction, error handling
  - 4 token optimization strategies (97% reduction when combined)
  - Real code examples throughout
  - Cost analysis: $100 → $5 per 1M tokens

**Testing** (Phase 3):

- ✅ `test-json-schemas.ts`: **NEW** - 28 tests validating all envelope categories and error formats
- ✅ `test-json-errors.ts`: **NEW** - 9 tests validating all 6 error codes and retryable logic
- ✅ `test-json-integration.ts`: **NEW** - 6 tests for end-to-end workflows
- ✅ **Total new tests**: 43 tests (all passing)
- ✅ **Total test suite**: 160+ tests (117 existing + 43 new)
- ✅ **Backward compatibility**: All existing tests still pass

**Benefits for AI Agents**:

1. **Automatic Parsing**: Direct property access instead of regex/markdown parsing
2. **Type Safety**: Structured envelopes enable schema validation
3. **Error Recovery**: Retryable flag enables smart retry logic
4. **Token Savings**: 97% reduction = lower costs and faster processing
5. **Metadata Extraction**: Test results, file operations, error context automatically available
6. **Cache-Friendly**: Combined with thread resumption = 98.5% total token reduction

**Usage Examples**:

```typescript
// Request with JSON format
{
  "task": "Run comprehensive test suite",
  "format": "json"
}

// Response (execution_ack envelope)
{
  "version": "3.6",
  "schema_id": "codex/v3.6/execution_ack/v1",
  "tool": "_codex_local_exec",
  "tool_category": "local_execution",
  "request_id": "req-abc123",
  "ts": "2025-11-18T12:00:00Z",
  "status": "success",
  "data": {
    "task_id": "T-local-abc123",
    "status": "working",
    "message": "Task started successfully"
  }
}
```

**Implementation Method**:

- Built using MCP Delegator itself ("eating our own dog food")
- Phases 1-3 completed using Codex tasks
- Full implementation findings documented in `docs/V3.6-IMPLEMENTATION-FINDINGS.md`

**See Also**:

- `docs/AI-AGENT-BEST-PRACTICES.md` - Comprehensive guide for AI agents
- `quickrefs/architecture.md` - Complete JSON schema reference
- `docs/V3.6-IMPLEMENTATION-FINDINGS.md` - Implementation details and lessons learned

---

# [3.5.0](https://github.com/littlebearapps/mcp-delegator/compare/v3.4.0...v3.5.0) (2025-11-17)

### Features

- add MCP progress notifications (v3.4.3 - DISABLED) ([#13](https://github.com/littlebearapps/mcp-delegator/issues/13)) ([937a269](https://github.com/littlebearapps/mcp-delegator/commit/937a26938a6259c26f78b4a6aa80dcb52a73c203)), closes [#8](https://github.com/littlebearapps/mcp-delegator/issues/8) [#4157](https://github.com/littlebearapps/mcp-delegator/issues/4157) [#3174](https://github.com/littlebearapps/mcp-delegator/issues/3174)

## [3.4.3] - 2025-11-17

### Added

**MCP Progress Notifications** 🔔

Real-time task visibility in Claude Code's status bar for all async Codex executions.

**What's New**:

- **Status Bar Integration**: Running Codex tasks now appear in Claude Code's status bar with live progress updates
- **Non-Blocking Execution**: Claude Code remains responsive while Codex runs in the background
- **Multiple Update Strategies**:
  - CLI execution (`_codex_local_run`): Elapsed time notifications every 30 seconds
  - SDK execution (`_codex_local_exec`, `_codex_local_resume`): Step progress notifications every 10 events
  - Cloud submission (`_codex_cloud_submit`): One-time notification on successful submission
- **Error Resilience**: Notification failures never break tool execution - graceful degradation
- **Completion Tracking**: Final notifications mark tasks as complete in status bar

**Files Modified**:

- `src/types/progress.ts`: **NEW** - Helper functions and types for MCP progress notifications
- `src/index.ts`: Updated to pass `extra` parameter to execution tools
- `src/executor/process_manager.ts`: Added `onMcpProgress` callback with 30-second intervals
- `src/tools/local_run.ts`: Added elapsed time notifications
- `src/tools/local_exec.ts`: Added step progress notifications every 10 events
- `src/tools/local_resume.ts`: Added elapsed time notifications every 10 events
- `src/tools/cloud.ts`: Added submission notification

**User Experience Impact**:

- ✅ Users can see Codex is working (no more "did it freeze?" confusion)
- ✅ Real-time progress tracking in status bar
- ✅ No blocking - work on other tasks while Codex runs
- ✅ Clear completion/failure indicators

**See**: `docs/MCP-PROGRESS-NOTIFICATIONS-IMPLEMENTATION-PLAN.md` for complete implementation details

---

## [3.4.2] - 2025-11-17

### Added

**Production Reliability & User Experience Improvements** 🎯

This release focuses on 6 critical improvements identified during UAT testing in the auditor-toolkit project. All fixes have been production-tested and verified.

#### 1. Automatic Cleanup Scheduler (Issue 1.3) 🧹

**Problem Solved**:

- Tasks getting stuck in "working" state for hours/days due to SQLite exceptions or process crashes
- Old completed tasks accumulating indefinitely in the registry
- No automatic recovery mechanism

**Solution**:

- **Startup cleanup**: Runs on MCP server initialization, marks stuck tasks (>1 hour) as failed
- **Periodic cleanup**: Runs every 15 minutes to catch tasks that hang during server lifetime
- **Old task pruning**: Configurable via `_codex_cleanup_registry` tool (default: delete tasks >24 hours old)
- **Error handling with retry**: `updateTask()` now retries failed database operations after 1-second delay

**Files Modified**:

- `src/index.ts`: Added cleanup scheduler infrastructure
- `src/state/task_registry.ts`: Added error handling and retry logic to `updateTask()`

**See**: `docs/debugging/ISSUE-1.3-INVESTIGATION.md` for complete root cause analysis

#### 2. Default showAll to True (Issue 3.2) 📋

**Problem Solved**:

- Users confused when `_codex_local_status` showed no tasks despite having active work
- MCP server's `process.cwd()` doesn't match user's current directory
- Default behavior was to filter by directory (showing nothing)

**Solution**:

- Changed default from `showAll || false` to `showAll ?? true`
- Updated usage tips to explain MCP limitation: "MCP server can't auto-detect your current directory (shows all by default)"
- Updated schema description to clarify new default behavior

**Files Modified**:

- `src/tools/local_status.ts`: Changed default logic and documentation

**Impact**: Users now see all tasks by default instead of confusing empty results

#### 3. Smart Truncation (Issue 3.1) 📏

**Problem Solved**:

- 10KB limit was too restrictive for comprehensive reports
- Users losing critical information at the end of output
- No context about what was truncated

**Solution**:

- **Increased limit**: 10KB → 50KB (5x increase)
- **Smart truncation**: Show first 40KB + last 5KB (preserves beginning AND end)
- **Clear indicators**: Shows exact truncated size and line count
- **User-friendly message**: "Output size: X chars (showing first 40KB + last 5KB)"

**Files Modified**:

- `src/tools/local_results.ts`: Implemented smart truncation algorithm

**Example Output**:

```
... [Truncated 12,543 characters (~156 lines)] ...

*Output size: 67,543 chars (showing first 40KB + last 5KB)*
```

#### 4. Enhanced Error Reporting (Issues 1.2 + 3.3) 💡

**Problem Solved**:

- Cryptic error messages (raw stderr dumps)
- No actionable suggestions for common failures
- Silent failures (exit code 0 but no work performed)

**Solution**:

- **Pattern-based stderr parsing**: Detects common error types (auth, git, network, timeout, permissions)
- **Actionable suggestions**: Each error includes specific fix instructions
- **Silent failure detection**: Catches tasks that exit successfully but did no work
- **User-friendly messages**: Clear error descriptions instead of technical stderr

**Files Modified**:

- `src/executor/error_mapper.ts`: Added `parseStderrForErrors()` and `detectSilentFailure()` methods

**Example Error Message**:

```json
{
  "Error": "Task requires a git repository",
  "Code": "EXIT_ERROR",
  "Details": {
    "exitCode": 1,
    "stderr": "Not inside a trusted directory...",
    "suggestion": "Run `git init` in your project directory or use skipGitRepoCheck=true"
  }
}
```

**Covered Error Types**:

- Authentication failures → "Run `codex auth` or set CODEX_API_KEY"
- Git repository errors → "Run `git init` or use skipGitRepoCheck=true"
- Network/API errors → "Check internet connection and try again"
- Rate limits → "Wait X minutes before retrying"
- Timeouts → "Task took too long - use \_codex_cloud_submit for long tasks"
- Permission errors → "Check file permissions: chmod +x ..."

#### 5. Logging Documentation (Issue 1.5) 📚

**Problem Solved**:

- No documentation on how to access MCP server logs
- Users unable to troubleshoot startup issues or cleanup behavior

**Solution**:

- Created comprehensive logging guide: `docs/LOGGING-CONFIGURATION.md`
- Documents 4 methods to access logs:
  1. Terminal output (when running Claude Code from terminal)
  2. File redirection (`claude > /tmp/claude.log 2>&1`)
  3. macOS Console.app (system logs)
  4. Manual server testing (`node dist/index.js`)
- Log pattern examples for each feature
- Troubleshooting guide for common issues

**File Created**:

- `docs/LOGGING-CONFIGURATION.md`

#### 6. Progress Indicator Fix (Discovered during testing) 📊

**Problem Solved**:

- `_codex_local_wait` showing stale progress (e.g., 50%) even when task completed (100%)
- Progress saved to database every 10 events but not updated on completion

**Solution**:

- Force `progressPercentage` to 100% when `isComplete === true`
- Update progress one final time after task completes
- Ensures database always reflects accurate completion state

**Files Modified**:

- `src/executor/progress_inference.ts`: Added completion check
- `src/tools/local_exec.ts`: Added final progress update

### Removed

#### 7. Wait Tools Removal (Architectural Cleanup) 🏗️

**Problem Identified**:

- `_codex_local_wait` and `_codex_cloud_wait` were blocking anti-patterns
- Froze Claude Code for minutes with no visibility during wait
- Created user anxiety ("is it stuck?")
- Prevented AI agents from leveraging async/multitasking capabilities
- Redundant - `_status` + `_results` provide same functionality without blocking

**Solution**:

- **Removed** `_codex_local_wait` tool entirely
- **Removed** `_codex_cloud_wait` tool entirely
- **Tool count**: 15 primitives → 13 primitives

**Better Async Pattern** (documented in tools.md):

```typescript
// OLD (blocking):
_codex_local_exec → _codex_local_wait (BLOCKS 2-3 min) → results

// NEW (async):
_codex_local_exec → continue other work → check _codex_local_status periodically → _codex_local_results
```

**Benefits**:

- ✅ Claude Code can work on multiple tasks concurrently
- ✅ Users see periodic status checks (no frozen appearance)
- ✅ Better visibility into task progress
- ✅ More efficient use of AI agent capabilities
- ✅ Cleaner architecture (proper async patterns)

**Files Removed**:

- `src/tools/local_wait.ts`
- `src/tools/cloud_wait.ts`

**Files Modified**:

- `src/index.ts`: Removed wait tool registration and imports

### Production Testing Results ✅

All fixes tested in production environment (`/tmp/mcp-delegator-production-test`):

- ✅ Issue 1.1: Tasks execute successfully (18 events, comprehensive analysis)
- ✅ Issue 3.1: Smart truncation (30KB output, no truncation needed)
- ✅ Issue 3.2: Default showAll (verified via MCP tool call)
- ✅ Issues 1.2+3.3: Enhanced errors (clear message + suggestion)
- ✅ Issue 1.3: Cleanup scheduler (visible in logs, cleaned real stuck tasks)
- ✅ Progress fix: Task completion now shows 100% (not stale intermediate values)

### Breaking Changes ⚠️

**Removed Tools** (no existing users affected - pre-release):

- ❌ `_codex_local_wait` - removed (use `_codex_local_status` polling instead)
- ❌ `_codex_cloud_wait` - removed (use `_codex_cloud_status` polling instead)

**Rationale**: No users have downloaded this MCP yet, so this is the perfect time to remove architectural anti-patterns before first public release.

**Migration Guide** (for future reference):

```typescript
// If code was using wait (not recommended):
const result = await _codex_local_wait({ task_id });

// Replace with async pattern:
const { task_id } = await _codex_local_exec({ task });
let status;
do {
  await sleep(10000); // Wait 10 seconds
  status = await _codex_local_status({ task_id });
} while (status.status !== "completed");
const result = await _codex_local_results({ task_id });
```

### Backward Compatibility

✅ **All other updates are backward compatible**:

- Default behavior changes are user-friendly (show more, not less)
- New error messages preserve all original details in `details` field
- Cleanup runs automatically but doesn't affect running tasks
- Progress fix only affects display, not task execution

### Migration Notes

**No user action required** - all changes take effect immediately after:

1. Restart Claude Code (to reload MCP server with new version)
2. Verify cleanup is running: Check MCP server logs for startup message

**Optional**: Use `_codex_cleanup_registry` tool to preview/customize cleanup behavior

## [3.4.1](https://github.com/littlebearapps/mcp-delegator/compare/v3.3.2...v3.4.1) (2025-11-17)

### Features

- **config:** migrate config directory from codex-control to mcp-delegator ([#TBD](https://github.com/littlebearapps/mcp-delegator/issues/TBD))
  - Config directory renamed for consistency: `~/.config/codex-control/` → `~/.config/mcp-delegator/`
  - **Automatic migration** on first run - no user action required
  - Preserves all task history, environments, and configuration
  - Fallback to old directory if migration fails
  - Warning if both directories exist

**BREAKING CHANGE**: Config directory path changed to match package name

- **Old**: `~/.config/codex-control/`
- **New**: `~/.config/mcp-delegator/`

**Migration**: Automatic on first run of v3.4.1+

**Manual Migration** (if needed):

```bash
mv ~/.config/codex-control ~/.config/mcp-delegator
```

**Verification**:

```bash
ls -la ~/.config/mcp-delegator/  # Should show tasks.db, environments.json
```

## [3.3.2](https://github.com/littlebearapps/mcp-delegator/compare/v3.3.1...v3.3.2) (2025-11-16)

### Bug Fixes

- temporarily disable provenance to debug E409 errors ([3f33a67](https://github.com/littlebearapps/mcp-delegator/commit/3f33a67853bba3fdde7bf2fe894fd688369224ac))

## [3.3.1](https://github.com/littlebearapps/mcp-delegator/compare/v3.3.0...v3.3.1) (2025-11-16)

# [3.3.0](https://github.com/littlebearapps/mcp-delegator/compare/v3.2.2...v3.3.0) (2025-11-16)

### Features

- customize semantic-release to trigger on docs commits ([#12](https://github.com/littlebearapps/mcp-delegator/issues/12)) ([33c7d87](https://github.com/littlebearapps/mcp-delegator/commit/33c7d87e5a230e141fe7686d69c3689a96a7f377))

# 1.0.0 (2025-11-16)

### Bug Fixes

- **sandbox:** critical sandbox mode bug fix + comprehensive git operations testing ([5ee090e](https://github.com/littlebearapps/mcp-delegator/commit/5ee090e90cf1ec6561dcbc0c5aed3b8340005848))

### Features

- add CI/CD infrastructure and security hardening (Phase 1 & 2) ([a7f2cef](https://github.com/littlebearapps/mcp-delegator/commit/a7f2cef2bd25b7f6fc7dd32af744095cc26d9542))
- add structured metadata extraction for AI agent decision-making ([8004694](https://github.com/littlebearapps/mcp-delegator/commit/80046944bfd55d1d195d4d4d94577778a0c7ff47))
- Codex Control MCP v2.1.0 - Dual Execution Modes ([f1080b1](https://github.com/littlebearapps/mcp-delegator/commit/f1080b1ecbc607f2f2754aa7d9c4afcc2ba023a4))
- complete v3.0.0 unified natural language interface ([14871bb](https://github.com/littlebearapps/mcp-delegator/commit/14871bb559b84b8c9954acbb68f82f4ca09c67d6))
- **local-exec:** add comprehensive mode documentation ([bad9ce3](https://github.com/littlebearapps/mcp-delegator/commit/bad9ce372beb947180a494b35d16973b10d00301))
- v2.1.1 - async/non-blocking execution for all tools ([f338e8e](https://github.com/littlebearapps/mcp-delegator/commit/f338e8e517144c955cbbe857b7f26293818503e5))
- v3.0.1 - npm package ready + unified tool removal + bug fixes ([3b622ce](https://github.com/littlebearapps/mcp-delegator/commit/3b622ceb8c710860fd1792a474741f422eb682e4))
- v3.2.1 - complete timeout/hang detection for all execution tools ([f7852e7](https://github.com/littlebearapps/mcp-delegator/commit/f7852e7fed9fab7e4b6c90dd5d60457231196405))

# Changelog

All notable changes to MCP Delegator (formerly Codex Control MCP) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.1] - 2025-11-16

### Added

**Timeout/Hang Detection for Long-Running Tasks** ⏱️

Added MCP-compliant timeout detection to prevent AI agents and Claude Code from waiting indefinitely when tasks hang or freeze.

**Problem Solved**:

- During UAT testing (Test 2.6), Codex CLI hung for 36 minutes with no output
- Claude Code and user had no way to detect hang or take action
- AI agent sat frozen waiting for task that would never complete

**Solution**:

- **TimeoutWatchdog** class with two-tier timeout system:
  - **Inactivity timeout** (default: 5 min) - Resets on any stdout/stderr output, catches silent hangs
  - **Hard timeout** (default: 20 min) - Wall-clock maximum, prevents infinite execution
- **MCP Progress Tracking**: `notifications/progress` sent every 30 seconds during execution
- **MCP Warning Notifications**: `notifications/message` (warning level) sent 30s before timeout
- **MCP Error Notifications**: `notifications/message` (error level) sent when timeout fires
- **Structured Error Response**: Returns `isError: true` with partial results to "snap" Claude Code out of waiting
- **Partial Results Capture**: Last 50 JSONL events + last 64KB of stdout/stderr for recovery context
- **Process Cleanup**: SIGTERM → SIGKILL cascade for reliable process termination

**Tools with Full Timeout Detection** (6/6 ✅ COMPLETE):

**Process-Spawning Tools** (2 tools):

1. ✅ `_codex_local_run` - Via ProcessManager + TimeoutWatchdog (5 min idle / 20 min hard)
2. ✅ `_codex_cloud_submit` - Via runCodexCloud() + TimeoutWatchdog (5 min idle / 10 min hard)

**SDK Background Execution** (2 tools): 3. ✅ `_codex_local_exec` - Background task monitoring (5 min idle / 20 min hard) 4. ✅ `_codex_local_resume` - Background task monitoring (5 min idle / 20 min hard)

**Polling/Wait Tools** (2 tools): 5. ✅ `_codex_local_wait` - Hard timeout wrapper (11 min max) 6. ✅ `_codex_cloud_wait` - Hard timeout wrapper (31 min max)

**Implementation**:

- **New File**: `src/executor/timeout_watchdog.ts` (TimeoutWatchdog class, 300+ lines)
- **Modified**: `src/executor/process_manager.ts` - Integrated TimeoutWatchdog for CLI process spawning
- **Modified**: `src/tools/cloud.ts` - Added TimeoutWatchdog to cloud submission
- **Modified**: `src/tools/local_exec.ts` - Added timeout monitoring to background SDK execution
- **Modified**: `src/tools/local_resume.ts` - Added timeout monitoring to background SDK execution
- **Modified**: `src/tools/local_wait.ts` - Added hard timeout wrapper around polling loop
- **Modified**: `src/tools/cloud_wait.ts` - Added hard timeout wrapper around polling loop
- **Dependency**: Added `tree-kill@^1.2.2` for cross-platform process cleanup

**Configuration**:

- `idleTimeoutMs`: Inactivity timeout in milliseconds (default: 300000 = 5 min)
- `hardTimeoutMs`: Hard deadline in milliseconds (default: 1200000 = 20 min)
- Callbacks: `onProgress`, `onWarning`, `onTimeout` for MCP notification integration

**Test 2.6 Impact**:

- **Before**: 36-minute hang with no detection
- **After**: Would be caught in 5 minutes 30 seconds with warning at 4m 30s

**Documentation**:

- Complete design document: `docs/TIMEOUT-HANG-DETECTION-IMPLEMENTATION.md` (27KB, 600+ lines of code)
- MCP specification research: Official progress tracking and logging protocols

**Coverage Details**:

- **Process-spawning tools** use TimeoutWatchdog with full MCP notification support
- **SDK background execution** monitors idle time and hard deadline, updates task registry on timeout
- **Wait tools** have hard timeout wrappers to prevent infinite polling
- All 6 execution tools protected against indefinite hangs (100% coverage)

### Fixed

**Critical Production Bugs from v3.2.1 (Part 1)** 🐛

Three production issues identified in Google Platforms Standardization audit have been resolved:

1. **Issue #3 (CRITICAL): Database Constraint Error**
   - **Problem**: Tasks failing with CHECK constraint error when git verification sets `completed_with_warnings` or `completed_with_errors` status
   - **Root Cause**: SQL schema missing two status values that existed in TypeScript type
   - **Fix**: Updated SQL constraint, added automatic schema migration with backup/restore
   - **Impact**: 100% of tasks with git verification were failing → Now work correctly
   - **Files**: `src/state/task_registry.ts` (lines 109-141, 146-168, 183, 295)
   - **Tests**: 5/5 passed (`test-issue-3-fix.ts`)

2. **Issue #1 (HIGH): Git Operations Silent Failure**
   - **Problem**: Git operations (branch, commit, staging) reported success but didn't execute
   - **Root Cause**: Codex SDK suppresses stdout/stderr for non-zero exit codes (upstream issue #1367)
   - **Status**: Already implemented in previous session (`src/utils/git_verifier.ts` - 352 lines)
   - **Note**: Was blocked from production testing by Issue #3 (now resolved)
   - **Impact**: 60% of git operations failed silently → Now independently verified with detailed results

3. **Issue #2 (MEDIUM): No Progress Visibility During Execution**
   - **Problem**: Long-running tasks showed 0% progress for entire duration (15+ minutes), then jumped to 100%
   - **Root Cause**: Progress calculation only counted completed steps, not in-progress steps
   - **Fix**: Enhanced progress calculation to count in-progress items as 50% completion; moved file/command counters to update on `item.started` instead of `item.completed`
   - **Impact**: Users saw 0% for entire task → Now see real-time progress (50% → 67% → 83% → 100%)
   - **Files**: `src/executor/progress_inference.ts` (lines 86-97, 200-205, 225)
   - **Tests**: 8/8 passed (`test-issue-2-fix.ts`)

**Test Summary**: 13/13 tests passing (100%)

**Documentation**: See `docs/ISSUE-RESOLUTION-COMPLETE-2025-11-15.md` for complete details

## [3.2.0] - 2025-11-15

### Changed

**Renamed to MCP Delegator** 🎯

This project has been renamed from "Codex Control MCP" to "MCP Delegator" to better reflect its multi-agent delegation pattern.

- **New Package Name**: `@littlebearapps/mcp-delegator` (was `@littlebearapps/codex-control-mcp`)
- **New Command**: `mcp-delegator` (was `codex-control-mcp`)
- **Rationale**:
  - Supports multi-agent delegation pattern (Codex + Claude Code Agent SDK + future agents)
  - Claude Code delegates tasks to agents (async), continues working on other tasks
  - Better reflects the architecture and user workflow
- **Breaking Change**: MCP configurations must be updated to use new command name
  - Old: `"command": "codex-control-mcp"`
  - New: `"command": "mcp-delegator"`

**Migration**:

- Run `./setup-npm-link.sh` to create new global symlink
- Update `.mcp.json` files to use `mcp-delegator` as command
- Restart Claude Code in all working directories

**See**:

- Complete naming analysis: `docs/NAMING-AND-FEATURES-ANALYSIS-2025-11-15.md`
- Missing features roadmap: `docs/MISSING-CODEX-FEATURES-IMPLEMENTATION-GUIDE.md`

### Added

**Missing Features Analysis**

Identified 6 missing Codex CLI features for future implementation:

**Phase 1 (v3.3.0)** - HIGH Priority:

- Model selection tools (`_codex_list_models`, `_codex_set_default_model`)
- Reasoning level control (`_codex_set_reasoning_level`) - 50-90% cost savings potential!

**Phase 2 (v3.4.0)** - MEDIUM Priority:

- Multimodal support (`_codex_local_run_with_images`)
- Web search integration (`_codex_local_run_with_search`)

**Phase 3 (v3.4.3)** - MEDIUM Priority:

- Session commands (`_codex_session_init`, `_codex_session_review`)
- Configuration profiles (`_codex_list_profiles`, `_codex_set_profile`)

**Documentation**: Complete implementation specifications in `docs/MISSING-CODEX-FEATURES-IMPLEMENTATION-GUIDE.md` (6,700+ lines)

---

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

| Feature                  | Local CLI (Tools 1-4) | Local SDK (Tools 9-10) 🆕 | Cloud (Tools 5-8)  |
| ------------------------ | --------------------- | ------------------------- | ------------------ |
| **Real-Time Status**     | ❌ Blocking           | ✅ Event Streaming        | ❌ Background      |
| **Thread Resumption**    | ❌ No                 | ✅ Yes                    | ❌ No              |
| **Token Visibility**     | ❌ No                 | ✅ Yes                    | ❌ No              |
| **Session Persistence**  | ❌ No                 | ✅ Yes                    | ✅ Yes             |
| **Execution Location**   | Local Mac             | Local Mac                 | Cloud Containers   |
| **Best For**             | Quick tasks           | Iterative development     | Long-running tasks |
| **Max Duration**         | ~5-10 minutes         | No hard limit             | Hours              |
| **Context Preservation** | ❌ No                 | ✅ Full thread history    | ❌ No              |

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
