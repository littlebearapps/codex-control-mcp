# Codex Control MCP Server - Claude Code Memory

**Version**: 3.0.1
**Purpose**: Hidden primitives for OpenAI Codex operations (local + cloud)
**Status**: ✅ Production Ready - All 14 primitives working

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

## Production Deployment (npm link)

**✅ PRODUCTION READY**: This MCP server uses **npm link** for seamless development and deployment across all Claude Code working directories.

**How It Works**:
- Global symlink: `/opt/homebrew/bin/codex-control-mcp`
- Points to: `/Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control/dist/index.js`
- All MCP configs use: `"command": "codex-control-mcp"`
- Changes propagate automatically after rebuild!

**Development Workflow**:
1. Edit files in `src/`
2. Build with `npm run build`
3. **That's it!** Changes propagate to all projects
4. Restart Claude Code to pick up changes

**Setup** (Already Done! ✅):
```bash
./setup-npm-link.sh  # Creates global symlink
```

**Benefits**:
- ✅ No manual copying needed
- ✅ Single source of truth (no version drift)
- ✅ Portable MCP configs (no hard-coded paths)
- ✅ Prepares for npm publish (when ready)

**See**: `NPM-LINK-SETUP.md` for complete documentation

### npm Package (Publish-Ready)

**Package Name**: `@littlebearapps/codex-control-mcp`
**Status**: ✅ Ready for npm publish (when desired)

**Improvements**:
- ✅ Scoped package name (@littlebearapps/codex-control-mcp)
- ✅ Files whitelist (only ships dist/, docs/, LICENSE)
- ✅ prepublishOnly script (safety check before publish)
- ✅ Enhanced keywords for npm discoverability
- ✅ Repository URLs for GitHub integration
- ✅ MIT License file included
- ✅ .npmignore to exclude development files

**Publishing**:
```bash
npm publish --access public
```

**Note**: Scoped packages default to private access. Use `--access public` for free accounts.

**See**: `NPM-PACKAGE-IMPROVEMENTS.md` for complete details

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

## Current Focus (2025-11-14)

- ✅ **v3.0.1 - npm Package Ready + Bug Fixes**
  - Scoped package name: `@littlebearapps/codex-control-mcp`
  - npm link deployment: Global symlink for instant change propagation
  - Publishing safety: Files whitelist, prepublishOnly, .npmignore
  - Fixed critical bug: `_codex_local_results` parameter consistency
  - Removed unified tool (was causing intermittent hangs)
  - All 14 primitives working correctly
  - See `NPM-PACKAGE-IMPROVEMENTS.md`, `NPM-LINK-SETUP.md`

- ✅ **npm Package Features**:
  - **Scoped Name**: `@littlebearapps/codex-control-mcp`
  - **Files Whitelist**: Only ships dist/, quickrefs/, docs, LICENSE
  - **prepublishOnly**: Safety check before publishing
  - **Enhanced Keywords**: Better npm discoverability (12 keywords)
  - **Repository Metadata**: GitHub integration URLs
  - **MIT License**: Standard open source license
  - **Ready to Publish**: `npm publish --access public`

- ✅ **Architecture** (v3.0.1):
  - **14 hidden primitives** (all prefixed with `_`)
  - **Pattern**: Users say "use codex control to run tests" → Claude Code selects primitive
  - **No unified tool**: Removed in v3.0.1 (was causing intermittent hangs)
  - **Consistent parameters**: All tools use snake_case (task_id, thread_id, etc.)
  - **Similar to zen MCP**: Claude Code's native NLP handles selection

- ✅ **Comprehensive Testing**:
  - All 14 primitives tested and verified ✅
  - npm link deployment validated ✅
  - Async workflow validated ✅
  - Parameter bug fix confirmed ✅
  - Change propagation verified ✅
  - Documentation: `ASYNC-COMPREHENSIVE-TEST-RESULTS.md`, `NPM-LINK-VERIFICATION-COMPLETE.md`

- 🎯 **Status**: Production-ready, publish-ready npm package
  - 14 hidden primitives (all working correctly)
  - npm link active (instant change propagation)
  - Ready for npm publish when desired
  - Claude Code's native NLP handles tool selection
