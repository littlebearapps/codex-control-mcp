# MCP Servers - Little Bear Apps

**Purpose**: Custom MCP server implementations for Claude Code
**Location**: `/Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/`

---

## Overview

This directory contains custom-built MCP (Model Context Protocol) servers that extend Claude Code's capabilities across all Little Bear Apps projects.

**MCP Servers Available**:

1. **Codex Control** - Programmatic control of OpenAI Codex for build/test/debug/review workflows

---

## Codex Control MCP Server

**Version**: 2.0.0
**Status**: ✅ Production Ready - Complete Autonomous GitHub Workflow
**Location**: `codex-control/`

### Quick Start

1. **Build the server**:

   ```bash
   cd codex-control
   npm install
   npm run build
   ```

2. **Add to project's `.mcp.json`**:

   ```json
   {
     "mcpServers": {
       "codex-control": {
         "command": "node",
         "args": [
           "/Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control/dist/index.js"
         ],
         "env": {
           "CODEX_MAX_CONCURRENCY": "2"
         }
       }
     }
   }
   ```

3. **Test in Claude Code**:

   ```
   # Start Claude Code in any project with the MCP configuration
   # The server will auto-connect

   # Use tools:
   - codex_run - Execute read-only tasks
   - codex_plan - Preview changes
   - codex_apply - Apply modifications (requires confirmation)
   - codex_status - Check server status
   ```

### Features

**Core Capabilities**:

- ✅ Execute Codex tasks (code analysis, tests, reviews)
- ✅ Preview changes before applying (dry-run mode)
- ✅ Apply file modifications with explicit confirmation
- ✅ Pass environment variables securely to Codex Cloud
- ✅ Multi-instance support (all projects simultaneously)
- ✅ Full macOS Keychain integration

**Security**:

- ✅ Input validation (prevents injection, path traversal)
- ✅ Secret redaction (15+ patterns automatically scrubbed)
- ✅ Mutation gating (requires `confirm=true` for file changes)
- ✅ Environment variable policy (inherit-none/all/allow-list)
- ✅ Concurrency control (max 2-4 parallel processes)

**Environment Variable Policy**:

- `inherit-none` (default) - No env vars passed (most secure)
- `inherit-all` - All env vars passed (convenient, less secure)
- `allow-list` - Only specified vars passed (recommended)

### Documentation

**Server Documentation**:

- README: `codex-control/README.md`
- Phase 1 Report: `/Users/nathanschram/claude-code-tools/docs/sdk-implementation/CODEX-CONTROL-PHASE-1-COMPLETION-REPORT.md`
- v1.1.0 Report: `/Users/nathanschram/claude-code-tools/docs/sdk-implementation/CODEX-CONTROL-V1.1.0-COMPLETION-REPORT.md`
- Integration Guide: `/Users/nathanschram/claude-code-tools/docs/sdks/CODEX-CONTROL-MCP.md`
- Keychain Integration: `/Users/nathanschram/claude-code-tools/docs/sdk-implementation/CODEX-KEYCHAIN-INTEGRATION-GUIDE.md`

**Related Systems**:

- Keychain Secrets: `/Users/nathanschram/claude-code-tools/keychain/KEYCHAIN-QUICK-REFERENCE.md`
- MCP Configuration: `/Users/nathanschram/claude-code-tools/mcp/CLAUDE.md`

### Usage Examples

**Example 1: Code Analysis** (No Secrets Needed):

```json
{
  "task": "Analyze main.py for security vulnerabilities and performance issues"
}
```

**Example 2: Integration Tests** (With Secrets):

```json
{
  "task": "Run integration tests against staging API",
  "mode": "read-only",
  "envPolicy": "allow-list",
  "envAllowList": ["DATABASE_URL", "API_KEY", "RUNPOD_API_KEY"]
}
```

**Example 3: Apply Changes** (Two-Step Confirmation):

```json
// Step 1: Request (gets confirmation warning)
{
  "task": "Add error handling to all API endpoints",
  "confirm": false
}

// Step 2: Confirm and proceed
{
  "task": "Add error handling to all API endpoints",
  "confirm": true
}
```

### Multi-Project Deployment

**Codex Control works across all Claude Code projects simultaneously**:

```bash
# All projects can use the same MCP server
# Just add to each project's .mcp.json

# Supported projects (18 + root):
- Brand Copilot (instA)
- Auditor Toolkit (instB)
- Homeless Hounds (instC)
- NoteBridge (instD)
- Palette Kit (instE)
- Convert My File (instF)
- Little Bear Apps Website (instG)
- Illustrations (instR)
- ... and all other projects
```

**No conflicts**:

- ✅ Each instance has independent process queue
- ✅ Shared secrets via Keychain
- ✅ Concurrency control per instance
- ✅ Project-specific configuration

### Keychain Integration

**How It Works**:

1. Secrets stored in macOS Keychain (T2/SEP chip encryption)
2. `direnv` auto-loads secrets when entering project directory (via `.envrc`)
3. Claude Code inherits all secrets from shell
4. MCP server inherits all secrets from Claude Code
5. Environment policy controls what goes to Codex Cloud

**Example - Integration Testing**:

```json
{
  "task": "Run Runpod endpoint integration tests",
  "envPolicy": "allow-list",
  "envAllowList": [
    "RUNPOD_API_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY"
  ]
}
```

**Security Best Practices**:

- Use `inherit-none` for code analysis (default)
- Use `allow-list` for integration tests (recommended)
- Use `inherit-all` only for trusted tasks (with caution)
- Always review what secrets are loaded: `env | grep -i key`

---

## Future MCP Servers (Planned)

### GitHub MCP Server

**Purpose**: GitHub API operations (issues, PRs, workflows)
**Status**: Planned
**Features**:

- Create/update issues and PRs
- Trigger workflows
- Manage labels and milestones

### Cloudflare MCP Server

**Purpose**: Cloudflare API operations (Workers, Pages, D1)
**Status**: Under Development (external MCP server exists)
**Features**:

- Deploy Workers
- Manage D1 databases
- KV operations

### Linear MCP Server

**Purpose**: Linear project management
**Status**: External MCP server available
**Features**:

- Issue management
- Project tracking
- Team collaboration

---

## Development Guidelines

### Creating New MCP Servers

1. **Directory Structure**:

   ```
   your-server-name/
   ├── package.json
   ├── tsconfig.json
   ├── src/
   │   ├── index.ts        # MCP server entry point
   │   ├── tools/          # Tool implementations
   │   ├── security/       # Input validation, redaction
   │   └── executor/       # Business logic
   ├── dist/               # Compiled output
   └── README.md           # Server documentation
   ```

2. **Required Files**:
   - `package.json` - Dependencies (@modelcontextprotocol/sdk)
   - `tsconfig.json` - TypeScript configuration
   - `README.md` - Server documentation
   - `src/index.ts` - MCP server implementation

3. **Security Requirements**:
   - Input validation for all parameters
   - Secret redaction in logs
   - No shell injection (use `spawn` not `exec`)
   - Path traversal prevention

4. **Documentation Requirements**:
   - Tool descriptions and parameters
   - Usage examples
   - Security considerations
   - Troubleshooting guide

### Testing MCP Servers

```bash
# Build server
cd your-server-name
npm install
npm run build

# Test manually (stdio mode)
node dist/index.js

# Add to .mcp.json and test in Claude Code
# MCP servers auto-connect on Claude Code startup
```

---

## Related Documentation

**Global Documentation**:

- SDK Documentation: `/Users/nathanschram/claude-code-tools/docs/sdks/`
- MCP Configuration: `/Users/nathanschram/claude-code-tools/mcp/CLAUDE.md`
- Keychain Secrets: `/Users/nathanschram/claude-code-tools/keychain/KEYCHAIN-QUICK-REFERENCE.md`

**Per-Server Documentation**:

- Codex Control: `codex-control/README.md`
- Future servers: `{server-name}/README.md`

---

**Last Updated**: 2025-11-11
**Maintained By**: Little Bear Apps Development Team
