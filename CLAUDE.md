# Codex Control MCP Server - Claude Code Memory

**Version**: 2.1.1
**Purpose**: Dual-mode Codex execution (local SDK + cloud) via MCP with async/non-blocking support
**Status**: Production Ready

---

## Quick Reference

See detailed documentation in `quickrefs/`:
- @quickrefs/tools.md - All 15 tools with examples
- @quickrefs/architecture.md - System design and components
- @quickrefs/workflows.md - Common development workflows
- @quickrefs/security.md - Security features and best practices
- @quickrefs/troubleshooting.md - Common issues and solutions

**Latest Test Results**: See `ASYNC-TEST-RESULTS.md` for comprehensive async validation

---

## Common Commands

### Build & Development
- `npm run build` - Build TypeScript to dist/
- `npm run watch` - Watch mode for development
- `npm test` - Run test suite
- `npm start` - Run MCP server directly

### Testing & Validation
- `node dist/index.js` - Test MCP server manually
- `ts-node test-v2.1.0.ts` - Run validation suite
- Check `TEST-RESULTS-v2.1.0.md` for latest validation results

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
- Utilities in `src/executor/` and `src/security/`
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
- **Local CLI** (Tools 1-4): Async-capable CLI-based execution with task tracking
- **Local SDK** (Tools 5-6): Always async, thread persistence, token tracking
- **Cloud** (Tools 7-11): Background execution, sandboxed containers

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

## Tool Categories (15 Tools)

### Local CLI Execution (4 tools)
- `codex_cli_run` - Read-only analysis, tests (async-capable)
- `codex_cli_plan` - Preview changes without executing (async-capable)
- `codex_cli_apply` - Apply mutations with confirmation (async-capable)
- `codex_cli_status` - Server status and queue info

### Local SDK Execution (4 tools) 🔥 Always Async
- `codex_local_exec` - Async execution with task tracking
- `codex_local_resume` - Resume threads with context preservation
- `codex_local_status` - Check local task status
- `codex_local_results` - Get local task results

### Cloud Execution (5 tools)
- `codex_cloud_submit` - Background task submission
- `codex_cloud_status` - Task status checking
- `codex_cloud_results` - Retrieve task results
- `codex_cloud_list_tasks` - Persistent task registry
- `codex_cloud_check_reminder` - Pending task reminder

### Configuration & Setup (2 tools)
- `codex_list_environments` - Local environment registry
- `codex_github_setup_guide` - GitHub integration helper

---

## Key Decisions & Rationale

### Why Three Execution Modes?
- **Local CLI**: Legacy compatibility, simple one-shot tasks
- **Local SDK**: Iterative development, thread persistence, token visibility
- **Cloud**: Long-running tasks, sandboxed environments, device independence

### Why Persistent Task Tracking?
- Cloud tasks continue after Claude Code restarts
- Users need visibility into task history
- Multi-instance isolation prevents task collisions
- Enables `codex_cloud_check_reminder` tool

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

## Current Focus (2025-11-12)

- ✅ **v2.1.1 - Async Implementation Complete**
  - All tools now support non-blocking async execution
  - CLI tools renamed to `codex_cli_*` for clarity
  - SDK tools always async with proper task ID tracking
  - No more blocking behavior - Claude Code stays responsive!

- ✅ **Bug Fixes Completed**:
  - Fixed SDK thread ID null bug (now returns proper task IDs)
  - CLI tools renamed: `codex_run` → `codex_cli_run`, etc.
  - Updated all tool routing and registrations
  - Fixed LocalTaskRegistry integration for SDK tools

- ✅ **Production Testing Completed**:
  - Local SDK execution: ✅ Returns task ID immediately
  - Local CLI execution: ✅ Returns task ID immediately (async mode)
  - Status tracking: ✅ Shows running/completed tasks correctly
  - Results retrieval: ✅ Full output captured and retrievable
  - See `ASYNC-TEST-RESULTS.md` for complete validation

- ✅ **Documentation Updated**:
  - CLAUDE.md updated with async details (15 tools)
  - All quickrefs updated with new tool names
  - Async workflow examples added
  - Test results documented

- 🎯 **Ready for Deployment**: All 15 tools production-ready across all projects
