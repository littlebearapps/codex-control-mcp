# MCP Server Naming & Missing Features Analysis

**Date**: 2025-11-15
**Current Name**: codex-control-mcp (v3.0.1)
**Future Scope**: Multi-agent MCP (Codex + Claude Code + future agents)
**Analysis By**: Claude Code + zen thinkdeep + GPT-5 expert analysis

---

## Executive Summary

### Naming Recommendation: **`mcp-delegator`** ✅

**Rationale**:

- User's primary workflow: Claude Code delegates tasks to Codex (and future agents)
- Async execution allows Claude Code + user to continue working while agents process delegated tasks
- "Delegator" pattern perfectly describes this multi-agent coordination model
- Follows MCP ecosystem conventions (`mcp-<function>`)

### Missing Codex Features: **6 Critical Capabilities**

Currently unexposed in MCP:

1. **Multimodal (Images)** - `--image` flag
2. **Model Selection** - gpt-5-codex vs gpt-5 vs gpt-5.1-codex
3. **Reasoning Levels** - GPT-5 thinking (low/medium/high)
4. **Web Search** - `--search` flag
5. **Session Commands** - `/init`, `/review`, `/status`, `/approvals`
6. **Configuration Profiles** - `--profile` flag

---

## Part 1: Naming Analysis

### User Workflow Context (Key Insight!)

```
User ←→ Claude Code (PRIMARY AI agent)
              ↓
         DELEGATES tasks via MCP
              ↓
         Codex (SECONDARY agent - async background work)
              ↓
         Returns results
              ↓
         Claude Code (receives results, continues)
```

**Critical Pattern**: Claude Code is the leader, MCP is the **delegation mechanism**, not the orchestrator.

### Why "Delegator" Over "Conductor"

| Aspect            | Conductor               | Delegator                     |
| ----------------- | ----------------------- | ----------------------------- |
| **Metaphor**      | MCP leads the orchestra | MCP facilitates delegation    |
| **Hierarchy**     | MCP is the boss ❌      | Claude Code is the boss ✅    |
| **User workflow** | Doesn't match           | Perfect match ✅              |
| **Async pattern** | Implied coordination    | Explicit delegation ✅        |
| **Scalability**   | Multiple equal agents   | Primary + delegated agents ✅ |

### Recommended Names (In Order)

#### 1. **`mcp-delegator`** ⭐⭐⭐⭐⭐ (RECOMMENDED)

**Pros**:

- ✅ Follows MCP ecosystem convention (`mcp-<function>`)
- ✅ Discoverable (sorts with other MCP servers)
- ✅ Clear delegation pattern
- ✅ Professional and memorable
- ✅ Scales to multiple agents
- ✅ Available on npm/GitHub (verified - no conflicts)

**Package Structure**:

```json
{
  "name": "@littlebearapps/mcp-delegator",
  "description": "Delegate AI agent tasks from Claude Code to Codex, Claude Code (Agent SDK), and more - with async execution",
  "keywords": [
    "mcp",
    "delegator",
    "multi-agent",
    "codex",
    "claude",
    "async",
    "orchestration"
  ]
}
```

**Branding**:

- Package: `mcp-delegator`
- Product: "Delegator (MCP)" or "MCP Delegator"
- CLI command: `mcp-delegator`
- GitHub: `github.com/littlebearapps/mcp-delegator`

#### 2. **`agent-delegator-mcp`** ⭐⭐⭐⭐

**Pros**:

- ✅ Very descriptive ("agent" + "delegator")
- ✅ User's original suggestion
- ✅ Available (verified - no conflicts)

**Cons**:

- ⚠️ Doesn't follow `mcp-<function>` convention
- ⚠️ Less discoverable in MCP ecosystem

#### 3. **`delegator-mcp`** ⭐⭐⭐

**Pros**:

- ✅ Simple, clean
- ✅ Available (verified - no conflicts)

**Cons**:

- ⚠️ Doesn't start with "mcp-" (less discoverable)

### Final Recommendation

**Use `mcp-delegator`** for:

- Better ecosystem discoverability
- Consistent with MCP naming conventions
- Professional and scalable

**Migration Path** (from codex-control-mcp):

1. Create new package `@littlebearapps/mcp-delegator`
2. Deprecate `codex-control-mcp` with migration notice
3. Or use npm "alias" to maintain backward compatibility

---

## Part 2: Missing Codex CLI Features

### Research Sources

- ✅ OpenAI Codex CLI documentation
- ✅ Codex CLI reference (developers.openai.com/codex/cli/reference)
- ✅ GitHub issues (openai/codex)
- ✅ Community blogs and guides

### Feature Gap Analysis

#### 1. **Multimodal Support (Images)** - HIGH PRIORITY 🔴

**Codex CLI Capability**:

```bash
codex --image file.png "Analyze this UI mockup and suggest improvements"
codex -i diagram.jpg,screenshot.png "Compare these two designs"
```

**Current MCP Status**: ❌ NOT EXPOSED

**Impact**:

- Cannot analyze UI mockups, diagrams, screenshots
- Cannot do visual code review
- Cannot debug visual issues
- Critical for modern development workflows

**Recommended New Tool**:

```typescript
{
  name: '_codex_local_run_with_images',
  description: 'Execute Codex task with image attachments (multimodal)',
  inputSchema: {
    task: string,
    images: string[], // Array of file paths or URLs
    mode: 'read-only' | 'workspace-write' | 'danger-full-access',
    model?: string // Must be vision-capable (gpt-4o, gpt-5)
  }
}
```

**Implementation Notes**:

- Validate image paths exist
- Support local files, URLs, and base64 data URIs
- Ensure model supports vision (gpt-4o, gpt-5, claude-3.5-sonnet)
- Return structured error if model doesn't support images

---

#### 2. **Model Selection** - HIGH PRIORITY 🔴

**Codex CLI Capability**:

```bash
# Interactive session
/model  # Opens model selector

# CLI flag
codex --model gpt-5-codex "Optimize this code"
codex --model gpt-5 "Deep analysis of architecture"
```

**Available Models**:

- `gpt-5-codex` (default) - Optimized for coding tasks
- `gpt-5` - General purpose with deeper reasoning
- `gpt-5.1-codex` - Latest version
- `gpt-5.1-codex-mini` - Faster, smaller
- `o3-mini` - Cloud-only reasoning model

**Current MCP Status**: ⚠️ PARTIALLY EXPOSED

- We have `model` parameter in tools
- But no dedicated model selection/listing tool

**Impact**:

- Users can't discover available models
- Can't optimize cost/performance by choosing right model
- Can't switch models mid-workflow

**Recommended New Tools**:

```typescript
{
  name: '_codex_list_models',
  description: 'List available Codex models with capabilities',
  returns: {
    models: [
      {
        id: 'gpt-5-codex',
        provider: 'openai',
        capabilities: ['text', 'vision', 'code'],
        maxTokens: 200000,
        description: 'Optimized for coding tasks'
      },
      // ...
    ]
  }
}

{
  name: '_codex_set_default_model',
  description: 'Set default model for session',
  inputSchema: {
    model: string, // e.g., 'gpt-5-codex', 'gpt-5'
  }
}
```

---

#### 3. **Reasoning Levels (GPT-5 Thinking)** - HIGH PRIORITY 🔴

**Codex CLI Capability**:

```bash
# Interactive session
/model  # Select GPT-5, then choose reasoning level

# In prompts (implicit)
codex "Think deeply about the security implications..."
```

**Reasoning Levels**:

- **Low**: Fast, simple tasks (~0.5% of model max thinking budget)
- **Medium**: Balanced (default) (~33% of model max)
- **High**: Deep analysis (~67% of model max)
- **Max**: Maximum reasoning (~100% of model max)

**Current MCP Status**: ❌ NOT EXPOSED

**Impact**:

- Can't optimize cost/latency for simple tasks (should use low reasoning)
- Can't request deep analysis for complex problems (should use high reasoning)
- Missing 50-90% cost optimization opportunity!

**Recommended New Tool**:

```typescript
{
  name: '_codex_set_reasoning_level',
  description: 'Set GPT-5 reasoning level (low/medium/high/max)',
  inputSchema: {
    level: 'low' | 'medium' | 'high' | 'max',
    model?: string // Only applies to GPT-5 family
  }
}
```

**Implementation Notes**:

- Only applies to GPT-5 models (gpt-5, gpt-5.1)
- Map to OpenAI reasoning API parameters
- For non-reasoning models, approximate with temperature/top_p
- Return capability warning if model doesn't support reasoning

---

#### 4. **Web Search** - MEDIUM PRIORITY 🟡

**Codex CLI Capability**:

```bash
codex --search "Research latest React best practices and update our components"
codex exec --search "Find security vulnerabilities in dependencies and fix"
```

**Current MCP Status**: ❌ NOT EXPOSED

**Impact**:

- Can't access current documentation during execution
- Can't research latest best practices
- Can't check for known vulnerabilities
- Limited to training data cutoff

**Recommended New Tool**:

```typescript
{
  name: '_codex_local_run_with_search',
  description: 'Execute Codex task with web search enabled',
  inputSchema: {
    task: string,
    mode: 'read-only' | 'workspace-write' | 'danger-full-access',
    searchDomains?: string[] // Optional: restrict to specific domains
  }
}
```

**Implementation Notes**:

- Maps to `--search` flag in Codex CLI
- Search results are cached and referenced in execution
- Consider rate limiting and domain allowlists for safety

---

#### 5. **Session Commands (/init, /review, /status)** - MEDIUM PRIORITY 🟡

**Codex CLI Interactive Commands**:

```bash
/init       # Create AGENTS.md file with instructions
/review     # Review changes and find issues
/status     # Show current session configuration
/approvals  # Choose what Codex can do without approval
/model      # Choose model and reasoning level (covered above)
```

**Current MCP Status**: ❌ NOT EXPOSED

**Impact**:

- Can't initialize project context automatically
- Can't trigger automated code review
- Can't check session status programmatically
- Missing quality assurance workflows

**Recommended New Tools**:

```typescript
{
  name: '_codex_session_init',
  description: 'Initialize Codex session with AGENTS.md',
  inputSchema: {
    workingDir: string,
    objective?: string, // Optional: project objective
    constraints?: string[] // Optional: constraints/guidelines
  }
}

{
  name: '_codex_session_review',
  description: 'Review recent changes and find issues',
  inputSchema: {
    scope?: 'uncommitted' | 'last-commit' | 'branch' | 'all',
    focus?: string[] // e.g., ['security', 'performance', 'style']
  }
}

{
  name: '_codex_session_status',
  description: 'Get current session configuration',
  returns: {
    model: string,
    reasoningLevel?: string,
    approvalMode: string,
    sandboxMode: string,
    activeProfile?: string
  }
}
```

---

#### 6. **Configuration Profiles** - MEDIUM PRIORITY 🟡

**Codex CLI Capability**:

```bash
codex --profile security "Audit codebase for vulnerabilities"
codex --profile fast "Quick syntax check"
codex -p production "Deploy to production"
```

**Profile Examples**:

- `security`: Strict sandbox, high reasoning, security-focused prompts
- `fast`: Low reasoning, read-only, quick tasks
- `production`: Full access, high reasoning, deployment workflows

**Current MCP Status**: ❌ NOT EXPOSED

**Impact**:

- Can't switch between different security/performance modes
- Can't save preferred configurations
- Can't enforce organization-wide policies

**Recommended New Tools**:

```typescript
{
  name: '_codex_list_profiles',
  description: 'List available configuration profiles',
  returns: {
    profiles: [
      {
        name: 'security',
        model: 'gpt-5',
        reasoning: 'high',
        sandbox: 'read-only',
        description: 'Security audit mode'
      },
      // ...
    ]
  }
}

{
  name: '_codex_set_profile',
  description: 'Set active configuration profile',
  inputSchema: {
    profileName: string
  }
}

{
  name: '_codex_create_profile',
  description: 'Create custom configuration profile',
  inputSchema: {
    name: string,
    config: {
      model?: string,
      reasoning?: 'low' | 'medium' | 'high',
      sandbox?: string,
      approvals?: string
    }
  }
}
```

---

## Part 3: Implementation Recommendations

### Priority Roadmap

#### Phase 1: Foundation (v3.2.0)

**Timeline**: 1-2 weeks
**Focus**: Rename + Model Selection + Reasoning Levels

1. **Rename to `mcp-delegator`**
   - Update package.json name
   - Update all documentation
   - Create npm alias for backward compatibility
   - Announce deprecation timeline for `codex-control-mcp`

2. **Implement Model Selection**
   - `_codex_list_models` tool
   - `_codex_set_default_model` tool
   - Model capability registry

3. **Implement Reasoning Levels**
   - `_codex_set_reasoning_level` tool
   - Map to OpenAI reasoning API
   - Document cost optimization strategies

**Deliverables**:

- ✅ New package name active
- ✅ 2 new tools (model selection, reasoning)
- ✅ Documentation updated
- ✅ Backward compatibility maintained

#### Phase 2: Multimodal + Search (v3.3.0)

**Timeline**: 2-3 weeks
**Focus**: Images + Web Search

4. **Implement Multimodal Support**
   - `_codex_local_run_with_images` tool
   - `_codex_local_exec_with_images` tool
   - Image path validation
   - Vision model capability checks

5. **Implement Web Search**
   - `_codex_local_run_with_search` tool
   - Rate limiting and domain allowlists
   - Search result caching

**Deliverables**:

- ✅ 3 new tools (images + search)
- ✅ Image handling infrastructure
- ✅ Search safety guardrails

#### Phase 3: Session Management (v3.4.0)

**Timeline**: 1-2 weeks
**Focus**: Session commands + Profiles

6. **Implement Session Commands**
   - `_codex_session_init` tool
   - `_codex_session_review` tool
   - `_codex_session_status` tool
   - AGENTS.md generation

7. **Implement Configuration Profiles**
   - `_codex_list_profiles` tool
   - `_codex_set_profile` tool
   - `_codex_create_profile` tool
   - Profile persistence (YAML/JSON)

**Deliverables**:

- ✅ 6 new tools (3 session + 3 profile)
- ✅ Profile system architecture
- ✅ Session management infrastructure

#### Phase 4: Claude Code Agent (v4.0.0)

**Timeline**: 3-4 weeks
**Focus**: Add second agent via Anthropic Agent SDK

8. **Integrate Claude Code Agent**
   - Research Anthropic Agent SDK
   - Design delegation interface
   - Implement Claude Code tools
   - Test multi-agent workflows

**Deliverables**:

- ✅ Claude Code agent support
- ✅ Multi-agent delegation working
- ✅ "Delegator" pattern fully realized

### Architecture Considerations

#### Model Capability Registry

```typescript
interface ModelCapability {
  id: string;
  provider: "openai" | "anthropic" | "vertex" | "azure";
  capabilities: ("text" | "vision" | "reasoning" | "audio")[];
  maxTokens: number;
  costPer1kTokens: { input: number; output: number };
  description: string;
  reasoningSupport?: {
    levels: ("low" | "medium" | "high" | "max")[];
    default: string;
  };
}

const MODEL_REGISTRY: ModelCapability[] = [
  {
    id: "gpt-5-codex",
    provider: "openai",
    capabilities: ["text", "vision", "code"],
    maxTokens: 200000,
    costPer1kTokens: { input: 0.003, output: 0.012 },
    description: "Optimized for coding tasks",
  },
  {
    id: "gpt-5",
    provider: "openai",
    capabilities: ["text", "vision", "reasoning"],
    maxTokens: 200000,
    costPer1kTokens: { input: 0.003, output: 0.012 },
    description: "General purpose with deep reasoning",
    reasoningSupport: {
      levels: ["low", "medium", "high", "max"],
      default: "medium",
    },
  },
  // Add more models as they become available
];
```

#### Profile System Architecture

```typescript
interface Profile {
  name: string;
  model: string;
  reasoning?: "low" | "medium" | "high" | "max";
  sandbox: "read-only" | "workspace-write" | "danger-full-access";
  approvals: "untrusted" | "on-failure" | "on-request" | "never";
  tools?: {
    webSearch?: boolean;
    images?: boolean;
  };
  limits?: {
    maxOutputTokens?: number;
    dailyCostUsd?: number;
  };
}

// Example profiles
const DEFAULT_PROFILES: Profile[] = [
  {
    name: "security",
    model: "gpt-5",
    reasoning: "high",
    sandbox: "read-only",
    approvals: "untrusted",
  },
  {
    name: "fast",
    model: "gpt-5-codex",
    reasoning: "low",
    sandbox: "read-only",
    approvals: "on-failure",
  },
  {
    name: "production",
    model: "gpt-5",
    reasoning: "high",
    sandbox: "workspace-write",
    approvals: "on-request",
  },
];
```

### Testing Strategy

#### Unit Tests

- ✅ Model capability validation
- ✅ Reasoning level mapping
- ✅ Profile loading/merging
- ✅ Image path validation
- ✅ Search domain allowlist

#### Integration Tests

- ✅ Model switching mid-session
- ✅ Profile application end-to-end
- ✅ Multimodal with vision models
- ✅ Web search with rate limiting

#### Production Validation

- ✅ Test each new tool in Auditor Toolkit
- ✅ Verify cost optimization with reasoning levels
- ✅ Validate multimodal with real UI mockups

---

## Part 4: Expert Analysis Summary (GPT-5)

### Key Recommendations from Expert Analysis

1. **Naming**: Use `mcp-delegator` (not `conductor-mcp`)
   - Follows MCP ecosystem conventions
   - Better discoverability
   - Consistent with delegation pattern

2. **Avoid Netflix Conductor Confusion**:
   - Always include "MCP" in tagline
   - Use "Delegator (MCP)" in branding
   - Emphasize AI delegation, not workflow engines

3. **Minimal Architecture**:
   - Don't over-engineer
   - Start with model registry + profiles
   - Add features incrementally
   - Keep session state simple (in-memory + JSON persistence)

4. **Safety First**:
   - Input validation on all tools
   - URL/domain allowlists for web search
   - Size limits for images
   - Structured errors with actionable messages

5. **Cost Control**:
   - Expose token usage in all tools
   - Daily/session budgets in profiles
   - Cost estimation per model
   - Surface in session_status tool

6. **Incremental Rollout**:
   - M0: Name + skeleton
   - M1: Profiles + model selection
   - M2: Reasoning levels
   - M3: Web search/fetch
   - M4: Multimodal (images)
   - M5: Session commands
   - M6: Hardening + tests

---

## Part 5: Migration Guide

### From `codex-control-mcp` to `mcp-delegator`

#### Package.json Updates

**Before**:

```json
{
  "name": "@littlebearapps/codex-control-mcp",
  "version": "3.0.1",
  "description": "MCP server for OpenAI Codex operations"
}
```

**After**:

```json
{
  "name": "@littlebearapps/mcp-delegator",
  "version": "3.2.0",
  "description": "Delegate AI agent tasks from Claude Code to Codex, Claude Code (Agent SDK), and more - with async execution",
  "keywords": ["mcp", "delegator", "multi-agent", "codex", "claude", "async"]
}
```

#### npm Link Setup

```bash
# Remove old link
npm unlink -g @littlebearapps/codex-control-mcp

# Update package.json (see above)

# Create new link
npm link

# Verify
which mcp-delegator
# Should point to: /opt/homebrew/bin/mcp-delegator
```

#### MCP Configuration Updates

**All projects** (Auditor Toolkit, Root, etc.):

**Before** (`.mcp.json`):

```json
{
  "mcpServers": {
    "codex-control": {
      "command": "codex-control-mcp"
    }
  }
}
```

**After** (`.mcp.json`):

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

#### Backward Compatibility

**Option 1**: npm package alias (recommended)

```bash
# Publish deprecated package that forwards to new one
# codex-control-mcp/package.json
{
  "name": "@littlebearapps/codex-control-mcp",
  "version": "3.1.0",
  "deprecated": "This package has been renamed to @littlebearapps/mcp-delegator",
  "dependencies": {
    "@littlebearapps/mcp-delegator": "^3.2.0"
  }
}
```

**Option 2**: Maintain both names temporarily

```bash
# Create symlink
ln -s mcp-delegator codex-control-mcp
```

---

## Part 6: Next Actions

### Immediate (This Week)

1. **Decide on final name**
   - ✅ `mcp-delegator` recommended
   - ⏳ User confirmation needed

2. **Verify availability**
   - ✅ npm: AVAILABLE (no search results)
   - ✅ GitHub: AVAILABLE (no conflicts found)
   - ⏳ Check Docker Hub (if needed later)

3. **Plan Phase 1**
   - ⏳ Design model registry schema
   - ⏳ Design reasoning level API
   - ⏳ Create migration checklist

### Short Term (Next 2 Weeks)

4. **Implement Phase 1** (v3.2.0)
   - ⏳ Rename package to `mcp-delegator`
   - ⏳ Implement model selection tools
   - ⏳ Implement reasoning level tool
   - ⏳ Update all documentation
   - ⏳ Test in Auditor Toolkit

5. **Plan Phase 2**
   - ⏳ Research image handling best practices
   - ⏳ Design web search safety guardrails
   - ⏳ Draft multimodal tool schemas

### Medium Term (Next Month)

6. **Implement Phase 2** (v3.3.0)
   - ⏳ Multimodal support
   - ⏳ Web search integration

7. **Implement Phase 3** (v3.4.0)
   - ⏳ Session commands
   - ⏳ Configuration profiles

### Long Term (2-3 Months)

8. **Implement Phase 4** (v4.0.0)
   - ⏳ Research Anthropic Agent SDK
   - ⏳ Add Claude Code agent support
   - ⏳ Multi-agent delegation workflows

---

## Appendix: Research References

### External Documentation

- Codex CLI: https://developers.openai.com/codex/cli/
- Codex CLI Reference: https://developers.openai.com/codex/cli/reference/
- MCP Specification: https://modelcontextprotocol.io/specification
- MCP Naming Conventions: https://zazencodes.com/blog/mcp-server-naming-conventions
- Anthropic Agent SDK: https://docs.anthropic.com/agent-sdk (future)

### GitHub Issues Referenced

- openai/codex#3641: Support slash commands in codex exec mode
- openai/codex#4311: Auto invocation of slash commands
- openai/codex#1367: Non-zero exit code output suppression (Issue #1 root cause)

### Community Resources

- Multi-Agent Orchestration Patterns: https://collabnix.com/multi-agent-orchestration-patterns-and-best-practices-for-2024/
- MCP Agent Workflows: https://github.com/lastmile-ai/mcp-agent
- Codex CLI Approval Modes: https://vladimirsiedykh.com/blog/codex-cli-approval-modes-2025

---

**Last Updated**: 2025-11-15
**Status**: Analysis complete, ready for implementation
**Next Review**: After Phase 1 completion (v3.2.0)
