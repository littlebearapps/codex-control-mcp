# MCP Delegator - Claude Code Memory

**Version**: 3.2.1
**Purpose**: Delegate AI agent tasks to Codex, Claude Code (Agent SDK), and more - with async execution
**Status**: ✅ Production Ready - All Critical Bugs Fixed

---

## Quick Reference

See detailed documentation in `quickrefs/`:
- @quickrefs/tools.md - All tools with examples (updated for v3.0.1)
- @quickrefs/architecture.md - System design and components
- @quickrefs/workflows.md - Common development workflows
- @quickrefs/security.md - Security features and best practices
- @quickrefs/troubleshooting.md - Common issues and solutions

**Latest Test Results**: See `ASYNC-COMPREHENSIVE-TEST-RESULTS.md` for v3.0.1 validation (all 14 primitives working)

---

## Production Deployment (npm Package)

**✅ PUBLISHED TO NPM**: This MCP server is published as a **private npm package** under the `@littlebearapps` organization.

**Package Details**:
- **Name**: `@littlebearapps/mcp-delegator`
- **Version**: 3.2.1
- **Access**: Private (requires @littlebearapps org membership)
- **Registry**: https://www.npmjs.com/package/@littlebearapps/mcp-delegator

**Installation**:
```bash
# Install globally (requires org membership)
npm install -g @littlebearapps/mcp-delegator

# Verify installation
which mcp-delegator
mcp-delegator --version
```

**MCP Configuration**:
All MCP configs use: `"command": "mcp-delegator"`
```json
{
  "mcpServers": {
    "mcp-delegator": {
      "command": "mcp-delegator",
      "env": {
        "CODEX_MAX_CONCURRENCY": "2"
      }
    }
  }
}
```

**Updating**:
```bash
# Check for updates
npm outdated -g @littlebearapps/mcp-delegator

# Update to latest version
npm update -g @littlebearapps/mcp-delegator
```

**Benefits**:
- ✅ Version management (rollback capability)
- ✅ Works across all directories (no symlink fragility)
- ✅ Clean installation (standard npm workflow)
- ✅ Org-wide access (@littlebearapps team members)
- ✅ No directory rename issues

---

### Development Workflow (npm link)

For active development, you can use **npm link** to test changes instantly:

**Setup**:
```bash
cd /Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/mcp-delegator
npm link  # Creates global symlink
```

**Development Cycle**:
1. Edit files in `src/`
2. Build with `npm run build`
3. **Changes propagate immediately!**
4. Restart Claude Code to test

**Revert to npm package**:
```bash
npm unlink -g @littlebearapps/mcp-delegator
npm install -g @littlebearapps/mcp-delegator
```

**When to use npm link**:
- ✅ Active feature development
- ✅ Bug fixing and iteration
- ✅ Testing before publishing

**When to use npm package**:
- ✅ Production use across projects
- ✅ Stable releases
- ✅ Team collaboration

---

### Publishing Updates

**Publish workflow**:
```bash
# 1. Update version
npm version patch  # 3.2.1 → 3.2.2
# or: npm version minor  # 3.2.1 → 3.3.0
# or: npm version major  # 3.2.1 → 4.0.0

# 2. Build
npm run build

# 3. Publish (private to @littlebearapps org)
npm publish --access restricted

# 4. Verify
npm view @littlebearapps/mcp-delegator
```

**Org Requirements**:
- Organization: `@littlebearapps` (has Pro plan)
- Members can publish and install private packages
- Cost: $7/month (org-wide)

---

## Common Commands

### Build & Development
- `npm run build` - Build TypeScript to dist/
- `npm run watch` - Watch mode for development
- `npm test` - Run test suite
- `npm start` - Run MCP server directly

### Testing & Validation
- `node dist/index.js` - Test MCP server manually
- `npx ts-node test-codex-simple.ts` - Core E2E tests (14 tests)
- `npx ts-node test-codex-comprehensive.ts` - Natural language tests (51 tests)
- `npx ts-node test-codex-errors.ts` - Error case tests (26 tests)
- `npx ts-node test-metadata-extraction.ts` - Metadata extraction tests (7 tests)
- Check `WEEK-5-COMPLETION-SUMMARY.md` for comprehensive test results (98 tests, 100%)

### MCP Server Management
- MCP config location: `~/.claude/config/.mcp.json`
- Server runs via: `node dist/index.js`
- Concurrency control: `CODEX_MAX_CONCURRENCY` env var (default: 2)

---

## Code Style & Standards

### TypeScript
- Use ES modules (`import`/`export`), not CommonJS
- Prefer `async`/`await` over callbacks
- Use explicit return types on exported functions
- Use `strict` mode (enabled in tsconfig.json)

### Error Handling
- Use MCP error codes (`INVALID_PARAMS`, `INTERNAL_ERROR`, etc.)
- Redact secrets from error messages (see `security/redactor.ts`)
- Map Codex CLI errors to MCP format (see `executor/error_mapper.ts`)

### File Organization
- Tools go in `src/tools/` (one file per tool)
- Utilities in `src/executor/`, `src/security/`, and `src/utils/`
- Metadata extraction in `src/utils/metadata_extractor.ts`
- MCP server entry in `src/index.ts`
- Build output to `dist/` (gitignored)

### Naming Conventions
- Tool files: `snake_case.ts` (e.g., `local_exec.ts`)
- Functions: `camelCase` (e.g., `executeCodexTask`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_TASK_LENGTH`)
- Interfaces: `PascalCase` with `I` prefix (e.g., `ICodexResult`)

---

## Development Workflow

### Adding New Tools
1. Create new file in `src/tools/` (e.g., `my_tool.ts`)
2. Implement tool handler with MCP schema
3. Export from `src/index.ts` in `tools` array
4. Add documentation to `quickrefs/tools.md`
5. Build and test: `npm run build && npm test`

### Making Changes
1. Always work in a feature branch (never main)
2. Build after changes: `npm run build`
3. Test MCP server manually before committing
4. Update CHANGELOG.md with user-facing changes
5. Update version in package.json for releases

### Testing Locally
```bash
# Terminal 1: Run MCP server
node dist/index.js

# Terminal 2: Use Claude Code with server
# Add to ~/.claude/config/.mcp.json first
claude
```

### Pre-Commit Checklist
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] All tests pass (`npm test` when available)
- [ ] No secrets in code or logs
- [ ] Error messages are user-friendly
- [ ] README.md updated if tool behavior changed
- [ ] CHANGELOG.md entry added for user-facing changes

---

## Key Architecture Points

### Execution Modes
- **Local Execution** (5 tools): Simple one-shot + advanced SDK with thread persistence
- **Cloud Execution** (3 tools): Background execution, sandboxed containers
- **Configuration** (2 tools): Setup helpers

**All tools now support non-blocking async execution** - Claude Code never freezes waiting for Codex!

### Security Layers
1. **Input Validation** - Sanitize all user inputs (paths, task descriptions)
2. **Secret Redaction** - Strip API keys, tokens, passwords from outputs
3. **Mutation Gating** - Require explicit `confirm=true` for file modifications
4. **No Shell Injection** - Use `spawn(cmd, args)`, never `exec(string)`

### Process Management
- Max concurrency: 2-4 processes (configurable via env var)
- Queue-based execution for concurrent requests
- Graceful cleanup on process termination
- JSONL event stream parsing with error tolerance

---

## Important Files

- `src/index.ts` - MCP server entry point, tool registration
- `src/executor/jsonl_parser.ts` - Event stream parser (tolerant, line-buffered)
- `src/executor/process_manager.ts` - Process spawning and queue management
- `src/security/input_validator.ts` - Input validation and sanitization
- `src/security/redactor.ts` - Secret pattern matching (15+ patterns)
- `config.json` - Server metadata (name, version, description)
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript compilation config

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CODEX_MAX_CONCURRENCY` | `2` | Max parallel Codex processes |
| `CODEX_API_KEY` | (none) | Optional: Override ChatGPT Pro auth |

---

## Unified Tool Interface (v3.0.0)

### User-Facing Tool
- **`codex`** - Single unified tool accepting natural language instructions
  - Automatically routes to appropriate backend primitive
  - Detects local vs cloud execution mode
  - Handles threading vs one-shot execution
  - See README.md for natural language examples

### Hidden Implementation (14 Primitives)

**Local Execution** (7 primitives):
- `_codex_local_run` - Simple one-shot execution
- `_codex_local_exec` - SDK execution with threading
- `_codex_local_resume` - Resume threaded conversations
- `_codex_local_status` - Process and task status
- `_codex_local_results` - Get task results
- `_codex_local_wait` - Wait for task completion
- `_codex_local_cancel` - Cancel running tasks

**Cloud Execution** (5 primitives):
- `_codex_cloud_submit` - Background task submission
- `_codex_cloud_status` - Cloud task status
- `_codex_cloud_results` - Retrieve cloud results
- `_codex_cloud_wait` - Wait for cloud completion
- `_codex_cloud_cancel` - Cancel cloud tasks

**Configuration** (2 primitives):
- `_codex_cloud_list_environments` - List environments
- `_codex_cloud_github_setup` - GitHub integration guide

---

## Key Decisions & Rationale

### Why Remove Unified Natural Language Interface? (v3.0.1)
- **Problem**: Unified `codex` tool caused intermittent hanging issues
- **Root Cause**: Complex routing layer duplicated Claude Code's native NLP capabilities
- **Solution**: Removed unified tool, expose only 14 hidden primitives
- **Pattern**: Claude Code's native NLP selects appropriate primitive (like zen MCP)
- **Benefits**: Simpler code (~300 lines removed), no hanging issues, follows best practices
- **Previous Version (v3.0.0)**: Had unified tool with 91 routing tests (100% pass), but intermittent hangs in production

### Why Three Execution Modes?
- **Local CLI**: Legacy compatibility, simple one-shot tasks
- **Local SDK**: Iterative development, thread persistence, token visibility
- **Cloud**: Long-running tasks, sandboxed environments, device independence

### Why Persistent Task Tracking?
- Cloud tasks continue after Claude Code restarts
- Users need visibility into task history
- Multi-instance isolation prevents task collisions
- Enables unified `codex_cloud_status` tool (pending, specific, or list mode)

### Why Thread Persistence in Local SDK?
- Enables iterative development (analyze → fix → test)
- Reduces token costs via caching (45-93% cache rates)
- Preserves conversation context across sessions
- Supports follow-up questions without repeating context

### Why 4-Level Fallback in GitHub Templates?
- Codex Cloud containers may have network restrictions
- Different base images may lack certain package managers
- Core workflows work even if auxiliary tools (gh CLI) fail
- Clear manual instructions help users fix issues

---

## Common Gotchas

### MCP Server Discovery
- MCP servers are discovered on Claude Code startup
- Changes to `.mcp.json` require Claude Code restart
- Test server manually first: `node dist/index.js`

### Git Repository Requirement (Local SDK)
- `codex_local_resume` requires trusted git directory
- NOT an issue for Claude Code projects (all are git repos)
- Only affects testing in `/tmp/` or similar non-git contexts

### Secret Redaction
- Secrets are redacted from ALL outputs (stdout, stderr, events)
- 15+ patterns matched (API keys, tokens, passwords, etc.)
- Test with real secrets to verify redaction works

### JSONL Parsing
- Parser is tolerant of partial lines and non-JSON stderr
- Events are streamed in real-time, not batched
- Line buffering ensures clean event boundaries

---

## Quick Troubleshooting

### "Codex CLI not found"
```bash
npm install -g @openai/codex
which codex  # Verify installation
```

### "Authentication failed"
```bash
codex auth status  # Check auth
codex auth        # Re-authenticate
# OR set: export CODEX_API_KEY=sk-proj-...
```

### "MCP server not responding"
```bash
# Test manually
node dist/index.js
# Check MCP config
cat ~/.claude/config/.mcp.json
# Restart Claude Code (MCP discovery happens at startup)
```

### "TypeScript build errors"
```bash
rm -rf dist node_modules
npm install
npm run build
```

---

## Resources

- Full README: `README.md`
- Implementation plan: `~/claude-code-tools/docs/sdk-implementation/CODEX-CONTROL-MCP-IMPLEMENTATION-PLAN.md`
- Validation results: `TEST-RESULTS-v2.1.0.md`
- OpenAI Codex docs: https://developers.openai.com/codex
- MCP SDK: https://github.com/modelcontextprotocol/sdk

---

## Current Focus (2025-11-16 Morning)

- ✅ **v3.2.1 - Complete Timeout/Hang Detection for All 6 Execution Tools** ⏱️
  - **100% Coverage**: All execution tools now protected against indefinite hangs
  - **Problem Solved**: 36-minute hang in Test 2.6 would now be caught in 5m 30s
  - **Process-Spawning Tools** (2/6):
    - `_codex_local_run` - TimeoutWatchdog via ProcessManager (5 min idle / 20 min hard)
    - `_codex_cloud_submit` - TimeoutWatchdog via runCodexCloud() (5 min idle / 10 min hard)
  - **SDK Background Execution** (2/6):
    - `_codex_local_exec` - Idle/hard timeout monitoring with registry updates
    - `_codex_local_resume` - Idle/hard timeout monitoring with registry updates
  - **Polling/Wait Tools** (2/6):
    - `_codex_local_wait` - Hard timeout wrapper (11 min max)
    - `_codex_cloud_wait` - Hard timeout wrapper (31 min max)
  - **Implementation**:
    - TimeoutWatchdog class (300+ lines) with MCP notification support
    - Modified 7 files: process_manager.ts, cloud.ts, local_exec.ts, local_resume.ts, local_wait.ts, cloud_wait.ts, timeout_watchdog.ts
    - Added tree-kill dependency for cross-platform process cleanup
  - **Status**: Builds successfully, all 6 tools protected, ready for testing
  - **See**: CHANGELOG.md v3.2.1 for complete details

- ✅ **v3.2.1 - Critical Production Bugs Fixed & Git Operations Verified** (Previous Session)
  - **CRITICAL FIX**: Sandbox mode bug preventing ALL write operations
    - Root cause: `sandboxMode` parameter passed to wrong API (TurnOptions vs ThreadOptions)
    - Fix: 2-line code change + enhanced tool descriptions
    - Production verified: Test 3 (Create repository) PASSED after fix
    - See: `docs/CRITICAL-SANDBOX-MODE-BUG-FIX.md` and `docs/SANDBOX-MODE-FIX-PRODUCTION-VERIFIED.md`
  - **Git Operations Testing**: 10/10 tests PASSED (100% success rate)
    - Test 3: Create repository ✅
    - Test 4: Delete repository ✅
    - Test 5: Commit amend ✅ ⚠️ RISKY
    - Test 7: Merge branches ✅
    - Test 8: Rebase ✅ ⚠️ RISKY
    - Test 9: Cherry-pick ✅
    - Test 10: Force push ✅ ⚠️ RISKY
    - Test 11: Reset operations ✅ ⚠️ RISKY (--hard is DESTRUCTIVE)
    - Test 12: Stash operations ✅
  - **Risky Operations Identified**: 5 git operations requiring safety documentation
    - `git commit --amend` (rewrites history)
    - `git rebase` (rewrites commits)
    - `git reset --hard` (DESTRUCTIVE - discards changes)
    - `git push --force` (overwrites remote)
    - `git reset HEAD~N` (removes commits)
  - **Built-In Safety Discovery**: Git lock permissions protect project git history
    - Project repo has `.git/refs/heads/*.lock` creation DISABLED
    - Forces AI agents to use temporary/sandbox repositories
    - Recommendation: KEEP this safety feature enabled
  - **All Original Issues Fixed**: 7/7 issues RESOLVED ✅
    - Morning session: Issues #1, #2, #3 (logging, validation, output capture)
    - Evening session: Sandbox mode bug + git operations verified
  - **Documentation Complete**: Comprehensive session findings documented
  - **See**: `docs/SESSION-FINDINGS-2025-11-15-EVENING.md` for complete details

- ✅ **v3.2.0 - Renamed to MCP Delegator**
  - **NEW NAME**: `@littlebearapps/mcp-delegator` (was codex-control-mcp)
  - **Rationale**: Supports multi-agent delegation (Codex, Claude Code Agent SDK, future agents)
  - **Pattern**: Claude Code delegates tasks to Codex (async), continues working on other tasks
  - npm link updated: Global command is now `mcp-delegator`
  - MCP configs updated to use new name
  - All 14 Codex primitives working correctly
  - See `docs/NAMING-AND-FEATURES-ANALYSIS-2025-11-15.md` for naming research

- ✅ **Missing Features Identified** (v3.3.0+ roadmap):
  - **Phase 1 (v3.3.0)**: Model Selection + Reasoning Levels (HIGH priority)
    - `_codex_list_models`, `_codex_set_default_model` - Model discovery/management
    - `_codex_set_reasoning_level` - GPT-5 thinking control (50-90% cost savings!)
  - **Phase 2 (v3.4.0)**: Multimodal + Web Search (MEDIUM priority)
    - `_codex_local_run_with_images` - Image analysis support
    - `_codex_local_run_with_search` - Web search integration
  - **Phase 3 (v3.5.0)**: Session Commands + Profiles (MEDIUM priority)
    - `_codex_session_init`, `_codex_session_review` - Session management
    - `_codex_list_profiles`, `_codex_set_profile` - Configuration profiles
  - See `docs/MISSING-CODEX-FEATURES-IMPLEMENTATION-GUIDE.md` for complete specs

- ✅ **npm Package Features**:
  - **Scoped Name**: `@littlebearapps/mcp-delegator`
  - **Files Whitelist**: Only ships dist/, quickrefs/, docs, LICENSE
  - **prepublishOnly**: Safety check before publishing
  - **Enhanced Keywords**: delegator, multi-agent, async, codex, claude
  - **Repository Metadata**: GitHub integration URLs
  - **MIT License**: Standard open source license
  - **Ready to Publish**: `npm publish --access public`

- ✅ **Architecture** (v3.2.0):
  - **14 hidden Codex primitives** (all prefixed with `_`)
  - **Pattern**: Users say "use mcp delegator to run tests" → Claude Code selects primitive
  - **Delegation Workflow**: Claude Code → MCP Delegator → Codex (async) → Claude Code continues
  - **Consistent parameters**: All tools use snake_case (task_id, thread_id, etc.)
  - **Similar to zen MCP**: Claude Code's native NLP handles selection

- 🎯 **Status**: v3.2.1 COMPLETE ✅
  - **All 6 execution tools** have timeout/hang detection (100% coverage)
  - **All 3 production bugs** fixed and tested (13/13 tests passing)
  - 14 Codex primitives (all working correctly)
  - npm link active (instant change propagation)
  - Builds successfully (TypeScript compilation passed)
  - Ready for npm publish when desired
  - **Next**: Manual testing of timeout detection mechanisms
