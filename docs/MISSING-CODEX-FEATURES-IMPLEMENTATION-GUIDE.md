# Missing Codex Features - Implementation Guide

**Date**: 2025-11-15
**Target Version**: v3.2.0 - v3.4.0
**Status**: Ready for Implementation
**Purpose**: Detailed specifications for 6 missing Codex CLI capabilities

---

## Overview

This document provides complete implementation specifications for 6 Codex CLI features that are currently NOT exposed in the MCP server:

1. **Multimodal Support (Images)** - HIGH PRIORITY 🔴
2. **Model Selection** - HIGH PRIORITY 🔴
3. **Reasoning Levels** - HIGH PRIORITY 🔴
4. **Web Search** - MEDIUM PRIORITY 🟡
5. **Session Commands** - MEDIUM PRIORITY 🟡
6. **Configuration Profiles** - MEDIUM PRIORITY 🟡

Each feature includes:
- ✅ Tool specification with MCP schema
- ✅ Input/output examples
- ✅ Implementation notes
- ✅ Error handling
- ✅ Testing criteria

---

## Feature 1: Multimodal Support (Images)

### Priority: 🔴 HIGH

### Current Gap

**Codex CLI capability**:
```bash
codex --image diagram.png "Analyze this architecture diagram"
codex -i ui-mockup.jpg,screenshot.png "Compare these two UI designs"
```

**MCP Status**: ❌ NOT EXPOSED

### Use Cases

- Analyze UI mockups and design diagrams
- Debug visual issues from screenshots
- Review architectural diagrams
- Extract text from images (OCR)
- Compare visual designs
- Analyze error screenshots

### New Tools Required

#### Tool 1: `_codex_local_run_with_images`

**Description**: Execute Codex task with image attachments (multimodal support)

**MCP Schema**:
```typescript
{
  name: '_codex_local_run_with_images',
  description: 'Execute Codex task with image attachments for visual analysis. Supports local files, URLs, and base64 data. Requires vision-capable model (gpt-4o, gpt-5).',
  inputSchema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'The task to execute with image context'
      },
      images: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of image paths (local files), URLs (http/https), or base64 data URIs'
      },
      mode: {
        type: 'string',
        enum: ['read-only', 'workspace-write', 'danger-full-access'],
        default: 'read-only',
        description: 'Execution mode'
      },
      model: {
        type: 'string',
        description: 'Model to use (must support vision: gpt-4o, gpt-5)',
        default: 'gpt-5'
      },
      workingDir: {
        type: 'string',
        description: 'Working directory (defaults to current directory)'
      }
    },
    required: ['task', 'images']
  }
}
```

**Input Example**:
```typescript
{
  task: "Analyze this UI mockup and suggest improvements for accessibility",
  images: [
    "/Users/nathanschram/Desktop/mockup.png",
    "https://example.com/design.jpg"
  ],
  mode: "read-only",
  model: "gpt-5"
}
```

**Output Example**:
```typescript
{
  success: true,
  taskId: "T-local-abc123",
  result: {
    analysis: "The UI mockup shows a dashboard with...",
    suggestions: [
      "Increase color contrast for WCAG AA compliance",
      "Add alt text to all images",
      "Improve button spacing for touch targets"
    ]
  },
  imagesProcessed: 2,
  model: "gpt-5"
}
```

**Implementation Notes**:

1. **Image Validation**:
   ```typescript
   async function validateImages(images: string[]): Promise<void> {
     for (const image of images) {
       // Check if local file exists
       if (!image.startsWith('http') && !image.startsWith('data:')) {
         if (!fs.existsSync(image)) {
           throw new Error(`Image not found: ${image}`);
         }
       }

       // Validate file extensions
       const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
       const ext = path.extname(image).toLowerCase();
       if (!validExtensions.includes(ext) && !image.startsWith('http') && !image.startsWith('data:')) {
         throw new Error(`Invalid image format: ${ext}. Supported: ${validExtensions.join(', ')}`);
       }
     }
   }
   ```

2. **Model Capability Check**:
   ```typescript
   const VISION_CAPABLE_MODELS = [
     'gpt-4o',
     'gpt-4o-mini',
     'gpt-5',
     'claude-3-5-sonnet-20241022',
     'claude-3-opus-20240229'
   ];

   function validateVisionModel(model: string): void {
     if (!VISION_CAPABLE_MODELS.includes(model)) {
       throw new Error(
         `Model ${model} does not support vision. Use one of: ${VISION_CAPABLE_MODELS.join(', ')}`
       );
     }
   }
   ```

3. **Codex CLI Integration**:
   ```typescript
   const args = [
     'exec',
     '--json',
     '--mode', mode,
     '--model', model,
   ];

   // Add each image with --image flag
   for (const image of images) {
     args.push('--image', image);
   }

   args.push(task);

   const process = spawn('codex', args, { cwd: workingDir });
   ```

4. **Error Handling**:
   ```typescript
   try {
     await validateImages(images);
     await validateVisionModel(model);
     // Execute task...
   } catch (error) {
     return {
       success: false,
       error: error.message,
       recommendation: 'Use vision-capable model (gpt-4o, gpt-5) and valid image paths'
     };
   }
   ```

**Testing Criteria**:
- ✅ Accepts local file paths
- ✅ Accepts HTTP/HTTPS URLs
- ✅ Accepts base64 data URIs
- ✅ Validates image file exists (local files)
- ✅ Validates model supports vision
- ✅ Returns structured error if model doesn't support images
- ✅ Passes multiple images correctly
- ✅ Works with read-only mode
- ✅ Works with workspace-write mode

---

#### Tool 2: `_codex_local_exec_with_images`

**Description**: SDK execution with image attachments and thread persistence

**MCP Schema**:
```typescript
{
  name: '_codex_local_exec_with_images',
  description: 'Advanced local execution with images and thread persistence. Returns thread ID for resumption.',
  inputSchema: {
    type: 'object',
    properties: {
      task: { type: 'string' },
      images: {
        type: 'array',
        items: { type: 'string' }
      },
      mode: {
        type: 'string',
        enum: ['read-only', 'workspace-write', 'danger-full-access'],
        default: 'read-only'
      },
      model: { type: 'string', default: 'gpt-5' },
      workingDir: { type: 'string' }
    },
    required: ['task', 'images']
  }
}
```

**Implementation**: Similar to `_codex_local_exec` but with image support via SDK.

---

## Feature 2: Model Selection

### Priority: 🔴 HIGH

### Current Gap

**Codex CLI capability**:
```bash
codex --model gpt-5-codex "Optimize this function"
codex --model gpt-5 "Deep architectural analysis"

# Interactive session
/model  # Opens model selector
```

**MCP Status**: ⚠️ PARTIALLY EXPOSED (model parameter exists but no discovery/management)

### Use Cases

- Optimize cost by choosing faster models for simple tasks
- Use specialized models for specific tasks (coding vs analysis)
- Switch models based on task complexity
- Discover available models and their capabilities

### New Tools Required

#### Tool 1: `_codex_list_models`

**Description**: List all available Codex models with capabilities and metadata

**MCP Schema**:
```typescript
{
  name: '_codex_list_models',
  description: 'List available Codex models with capabilities, pricing, and context limits',
  inputSchema: {
    type: 'object',
    properties: {
      provider: {
        type: 'string',
        enum: ['openai', 'all'],
        default: 'all',
        description: 'Filter by provider'
      },
      capability: {
        type: 'string',
        enum: ['text', 'vision', 'reasoning', 'code'],
        description: 'Filter by capability'
      }
    }
  }
}
```

**Output Example**:
```typescript
{
  models: [
    {
      id: 'gpt-5-codex',
      provider: 'openai',
      name: 'GPT-5 Codex',
      description: 'Optimized for coding tasks with fast execution',
      capabilities: ['text', 'vision', 'code'],
      contextWindow: 200000,
      maxOutputTokens: 16000,
      pricing: {
        inputPer1k: 0.003,
        outputPer1k: 0.012,
        cachedInputPer1k: 0.0015
      },
      supportsReasoning: false,
      default: true
    },
    {
      id: 'gpt-5',
      provider: 'openai',
      name: 'GPT-5',
      description: 'General purpose model with deep reasoning capabilities',
      capabilities: ['text', 'vision', 'reasoning'],
      contextWindow: 200000,
      maxOutputTokens: 16000,
      pricing: {
        inputPer1k: 0.003,
        outputPer1k: 0.012,
        cachedInputPer1k: 0.0015
      },
      supportsReasoning: true,
      reasoningLevels: ['low', 'medium', 'high', 'max'],
      defaultReasoningLevel: 'medium'
    },
    {
      id: 'gpt-5.1-codex',
      provider: 'openai',
      name: 'GPT-5.1 Codex',
      description: 'Latest Codex with improved performance',
      capabilities: ['text', 'vision', 'code'],
      contextWindow: 200000,
      maxOutputTokens: 16000,
      pricing: {
        inputPer1k: 0.0035,
        outputPer1k: 0.014,
        cachedInputPer1k: 0.00175
      },
      supportsReasoning: false
    },
    {
      id: 'o3-mini',
      provider: 'openai',
      name: 'O3 Mini',
      description: 'Reasoning model (cloud-only)',
      capabilities: ['text', 'reasoning'],
      contextWindow: 128000,
      maxOutputTokens: 8000,
      pricing: {
        inputPer1k: 0.002,
        outputPer1k: 0.008
      },
      supportsReasoning: true,
      reasoningLevels: ['low', 'medium', 'high'],
      cloudOnly: true
    }
  ]
}
```

**Implementation**:
```typescript
const MODEL_REGISTRY: ModelMetadata[] = [
  {
    id: 'gpt-5-codex',
    provider: 'openai',
    name: 'GPT-5 Codex',
    description: 'Optimized for coding tasks with fast execution',
    capabilities: ['text', 'vision', 'code'],
    contextWindow: 200000,
    maxOutputTokens: 16000,
    pricing: {
      inputPer1k: 0.003,
      outputPer1k: 0.012,
      cachedInputPer1k: 0.0015,
    },
    supportsReasoning: false,
    default: true,
  },
  // Add more models...
];

export async function listModels(input: { provider?: string; capability?: string }) {
  let models = MODEL_REGISTRY;

  // Filter by provider
  if (input.provider && input.provider !== 'all') {
    models = models.filter(m => m.provider === input.provider);
  }

  // Filter by capability
  if (input.capability) {
    models = models.filter(m => m.capabilities.includes(input.capability));
  }

  return { models };
}
```

**Testing Criteria**:
- ✅ Returns all models by default
- ✅ Filters by provider correctly
- ✅ Filters by capability correctly
- ✅ Includes pricing information
- ✅ Indicates reasoning support
- ✅ Shows context window limits

---

#### Tool 2: `_codex_set_default_model`

**Description**: Set default model for current session

**MCP Schema**:
```typescript
{
  name: '_codex_set_default_model',
  description: 'Set default model for all subsequent Codex operations in this session',
  inputSchema: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: 'Model ID (e.g., gpt-5-codex, gpt-5, o3-mini)'
      }
    },
    required: ['model']
  }
}
```

**Implementation**:
```typescript
// In-memory session state
const sessionState = {
  defaultModel: 'gpt-5-codex',
  defaultReasoningLevel: 'medium',
  defaultProfile: null,
};

export async function setDefaultModel(input: { model: string }) {
  // Validate model exists
  const model = MODEL_REGISTRY.find(m => m.id === input.model);
  if (!model) {
    throw new Error(
      `Unknown model: ${input.model}. Use _codex_list_models to see available models.`
    );
  }

  // Update session state
  sessionState.defaultModel = input.model;

  return {
    success: true,
    model: input.model,
    message: `Default model set to ${model.name}`,
    capabilities: model.capabilities,
    supportsReasoning: model.supportsReasoning,
  };
}
```

**Testing Criteria**:
- ✅ Validates model ID exists
- ✅ Updates session state
- ✅ Returns model capabilities
- ✅ Subsequent tasks use new default model

---

#### Tool 3: `_codex_get_active_model`

**Description**: Get current active model configuration

**MCP Schema**:
```typescript
{
  name: '_codex_get_active_model',
  description: 'Get currently active model and its configuration',
  inputSchema: { type: 'object', properties: {} }
}
```

**Output Example**:
```typescript
{
  model: 'gpt-5-codex',
  name: 'GPT-5 Codex',
  capabilities: ['text', 'vision', 'code'],
  reasoningLevel: null,
  contextWindow: 200000,
  pricing: {
    inputPer1k: 0.003,
    outputPer1k: 0.012
  }
}
```

---

## Feature 3: Reasoning Levels

### Priority: 🔴 HIGH (MAJOR COST OPTIMIZATION!)

### Current Gap

**Codex CLI capability**:
```bash
# Interactive session
/model  # Select GPT-5, then choose reasoning level (low/medium/high)

# In prompts (implicit)
codex "Think deeply about security implications..." # Uses higher reasoning
```

**MCP Status**: ❌ NOT EXPOSED

### Cost Impact Example

```
Simple task: "Fix syntax error in line 42"

With LOW reasoning:
- Input: 5,000 tokens, Output: 500 tokens
- Cost: $0.015 + $0.006 = $0.021

With MEDIUM reasoning (default):
- Input: 15,000 tokens, Output: 1,000 tokens
- Cost: $0.045 + $0.012 = $0.057

With HIGH reasoning:
- Input: 30,000 tokens, Output: 2,000 tokens
- Cost: $0.090 + $0.024 = $0.114

SAVINGS: 81% cheaper with LOW vs HIGH for simple tasks!
```

### Reasoning Levels Explained

| Level | Thinking Budget | Use Case | Cost |
|-------|----------------|----------|------|
| **Low** | ~0.5% of max | Simple tasks, syntax fixes, quick queries | 💰 Cheapest |
| **Medium** | ~33% of max | Standard coding tasks, moderate complexity | 💰💰 Default |
| **High** | ~67% of max | Complex refactoring, architectural decisions | 💰💰💰 Expensive |
| **Max** | ~100% of max | Extremely complex problems, full analysis | 💰💰💰💰 Most expensive |

### New Tools Required

#### Tool 1: `_codex_set_reasoning_level`

**Description**: Set GPT-5 reasoning level for cost/performance optimization

**MCP Schema**:
```typescript
{
  name: '_codex_set_reasoning_level',
  description: 'Set GPT-5 reasoning level (low/medium/high/max) for cost/performance optimization. Only applies to GPT-5 models.',
  inputSchema: {
    type: 'object',
    properties: {
      level: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'max'],
        description: 'Reasoning level: low (fast, cheap), medium (balanced), high (deep), max (maximum reasoning)'
      },
      model: {
        type: 'string',
        description: 'Optional: Override model (must support reasoning)'
      }
    },
    required: ['level']
  }
}
```

**Input Example**:
```typescript
{
  level: "low"  // For simple tasks
}
```

**Output Example**:
```typescript
{
  success: true,
  level: 'low',
  model: 'gpt-5',
  supportsReasoning: true,
  estimatedCostSavings: '~67% vs medium reasoning',
  message: 'Reasoning level set to low. Best for: simple tasks, syntax fixes, quick queries.'
}
```

**Implementation**:
```typescript
const REASONING_LEVELS = {
  low: {
    description: 'Fast and cheap - for simple tasks',
    useCases: ['Syntax fixes', 'Quick queries', 'Simple refactoring'],
    estimatedThinkingTokens: '~1000',
    costMultiplier: 0.3,
  },
  medium: {
    description: 'Balanced - default for most tasks',
    useCases: ['Standard coding', 'Moderate complexity', 'Code review'],
    estimatedThinkingTokens: '~3000',
    costMultiplier: 1.0,
  },
  high: {
    description: 'Deep reasoning - for complex problems',
    useCases: ['Complex refactoring', 'Architectural decisions', 'Security analysis'],
    estimatedThinkingTokens: '~6000',
    costMultiplier: 2.0,
  },
  max: {
    description: 'Maximum reasoning - for extremely complex tasks',
    useCases: ['Full system analysis', 'Complex algorithms', 'Critical decisions'],
    estimatedThinkingTokens: '~10000',
    costMultiplier: 3.5,
  },
};

export async function setReasoningLevel(input: { level: string; model?: string }) {
  const targetModel = input.model || sessionState.defaultModel;

  // Validate model supports reasoning
  const model = MODEL_REGISTRY.find(m => m.id === targetModel);
  if (!model?.supportsReasoning) {
    return {
      success: false,
      error: `Model ${targetModel} does not support reasoning levels`,
      supportsReasoning: false,
      recommendation: 'Use gpt-5, gpt-5.1, or o3-mini for reasoning support',
    };
  }

  // Update session state
  sessionState.defaultReasoningLevel = input.level;

  const levelInfo = REASONING_LEVELS[input.level];
  return {
    success: true,
    level: input.level,
    model: targetModel,
    supportsReasoning: true,
    ...levelInfo,
    message: `Reasoning level set to ${input.level}. ${levelInfo.description}`,
  };
}
```

**Codex CLI Integration**:
```typescript
// When executing with reasoning level
const args = ['exec', '--json', '--model', 'gpt-5'];

// Map reasoning level to Codex CLI parameters
// Note: Exact parameter name depends on Codex CLI version
// Check with: codex exec --help
if (sessionState.defaultReasoningLevel) {
  args.push('--reasoning', sessionState.defaultReasoningLevel);
  // OR (depending on CLI version):
  // args.push('--thinking-level', sessionState.defaultReasoningLevel);
}

args.push(task);
const process = spawn('codex', args);
```

**Testing Criteria**:
- ✅ Validates model supports reasoning
- ✅ Returns error if model doesn't support reasoning
- ✅ Updates session state
- ✅ Provides cost savings estimate
- ✅ Includes use case recommendations
- ✅ Subsequent tasks use new reasoning level

---

#### Tool 2: `_codex_get_reasoning_level`

**Description**: Get current reasoning level configuration

**MCP Schema**:
```typescript
{
  name: '_codex_get_reasoning_level',
  description: 'Get current reasoning level and configuration',
  inputSchema: { type: 'object', properties: {} }
}
```

**Output Example**:
```typescript
{
  level: 'medium',
  model: 'gpt-5',
  supportsReasoning: true,
  description: 'Balanced - default for most tasks',
  useCases: ['Standard coding', 'Moderate complexity', 'Code review'],
  costMultiplier: 1.0
}
```

---

## Feature 4: Web Search

### Priority: 🟡 MEDIUM

### Current Gap

**Codex CLI capability**:
```bash
codex --search "Research latest React best practices and update components"
codex exec --search "Find security vulnerabilities in dependencies"
```

**MCP Status**: ❌ NOT EXPOSED

### Use Cases

- Access current documentation during execution
- Research latest best practices
- Check for known vulnerabilities
- Get up-to-date API references

### New Tools Required

#### Tool 1: `_codex_local_run_with_search`

**Description**: Execute Codex task with web search enabled

**MCP Schema**:
```typescript
{
  name: '_codex_local_run_with_search',
  description: 'Execute Codex task with web search enabled for accessing current documentation and best practices',
  inputSchema: {
    type: 'object',
    properties: {
      task: { type: 'string' },
      mode: {
        type: 'string',
        enum: ['read-only', 'workspace-write', 'danger-full-access'],
        default: 'read-only'
      },
      searchDomains: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: Restrict search to specific domains (e.g., ["docs.python.org", "stackoverflow.com"])'
      },
      maxSearchResults: {
        type: 'number',
        default: 5,
        description: 'Maximum search results to include'
      },
      model: { type: 'string' },
      workingDir: { type: 'string' }
    },
    required: ['task']
  }
}
```

**Implementation**:
```typescript
const args = ['exec', '--json', '--search'];

// Add domain restrictions if specified
if (input.searchDomains && input.searchDomains.length > 0) {
  // Note: Check if Codex CLI supports domain filtering
  // May need to add to task description instead:
  // task += `\n\nOnly search these domains: ${input.searchDomains.join(', ')}`;
}

args.push('--mode', input.mode);
if (input.model) args.push('--model', input.model);
args.push(input.task);

const process = spawn('codex', args, { cwd: input.workingDir });
```

**Safety Guardrails**:
```typescript
// Rate limiting
const searchRateLimiter = new Map<string, number>(); // taskId -> timestamp

function checkRateLimit(): boolean {
  const now = Date.now();
  const lastSearch = searchRateLimiter.get('last');

  if (lastSearch && now - lastSearch < 5000) { // 5 second cooldown
    throw new Error('Search rate limit exceeded. Wait 5 seconds between searches.');
  }

  searchRateLimiter.set('last', now);
  return true;
}

// Domain allowlist (if strict mode enabled)
const TRUSTED_DOMAINS = [
  'docs.python.org',
  'docs.openai.com',
  'developer.mozilla.org',
  'stackoverflow.com',
  'github.com',
  // Add more...
];

function validateSearchDomains(domains?: string[]): void {
  if (!domains) return; // No restriction

  for (const domain of domains) {
    if (!TRUSTED_DOMAINS.includes(domain)) {
      console.warn(`Domain ${domain} not in trusted list. Proceeding with caution.`);
    }
  }
}
```

**Testing Criteria**:
- ✅ Executes with --search flag
- ✅ Returns search results in output
- ✅ Respects rate limits
- ✅ Domain filtering works (if supported)
- ✅ Search results are relevant to task

---

## Feature 5: Session Commands

### Priority: 🟡 MEDIUM

### Current Gap

**Codex CLI interactive commands**:
```bash
/init       # Create AGENTS.md file with instructions
/review     # Review changes and find issues
/status     # Show current session configuration
/approvals  # Choose what Codex can do without approval
```

**MCP Status**: ❌ NOT EXPOSED

### New Tools Required

#### Tool 1: `_codex_session_init`

**Description**: Initialize Codex session with AGENTS.md file

**MCP Schema**:
```typescript
{
  name: '_codex_session_init',
  description: 'Initialize Codex session by creating AGENTS.md file with project context and instructions',
  inputSchema: {
    type: 'object',
    properties: {
      workingDir: { type: 'string' },
      objective: {
        type: 'string',
        description: 'Project objective or goal'
      },
      constraints: {
        type: 'array',
        items: { type: 'string' },
        description: 'Constraints or guidelines for Codex'
      },
      technologies: {
        type: 'array',
        items: { type: 'string' },
        description: 'Technologies used in project (e.g., ["TypeScript", "React", "Node.js"])'
      }
    },
    required: ['workingDir']
  }
}
```

**Implementation**:
```typescript
export async function sessionInit(input: {
  workingDir: string;
  objective?: string;
  constraints?: string[];
  technologies?: string[];
}) {
  const agentsContent = `# Project Context for AI Agents

## Objective
${input.objective || 'To be defined'}

## Technologies
${input.technologies?.map(t => `- ${t}`).join('\n') || '- To be defined'}

## Constraints
${input.constraints?.map(c => `- ${c}`).join('\n') || '- To be defined'}

## Instructions for AI Agents
- Follow project coding standards
- Write tests for new features
- Update documentation for API changes
- Use conventional commits

## Code Review Checklist
- [ ] Security: No hardcoded secrets or vulnerabilities
- [ ] Performance: Efficient algorithms and queries
- [ ] Testing: Unit tests for new code
- [ ] Documentation: Updated README and inline comments
`;

  const agentsPath = path.join(input.workingDir, 'AGENTS.md');
  await fs.writeFile(agentsPath, agentsContent);

  return {
    success: true,
    filePath: agentsPath,
    message: 'AGENTS.md created successfully',
    content: agentsContent,
  };
}
```

---

#### Tool 2: `_codex_session_review`

**Description**: Review recent changes and find issues

**MCP Schema**:
```typescript
{
  name: '_codex_session_review',
  description: 'Review recent code changes and identify potential issues (security, performance, style)',
  inputSchema: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        enum: ['uncommitted', 'last-commit', 'branch', 'all'],
        default: 'uncommitted',
        description: 'Scope of review'
      },
      focus: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['security', 'performance', 'style', 'tests', 'documentation']
        },
        description: 'Areas to focus on during review'
      },
      workingDir: { type: 'string' }
    }
  }
}
```

**Implementation**:
```typescript
export async function sessionReview(input: {
  scope?: string;
  focus?: string[];
  workingDir?: string;
}) {
  // Build review task
  let reviewTask = 'Review the following changes:\n\n';

  // Get changes based on scope
  const { stdout } = await execAsync(
    input.scope === 'uncommitted' ? 'git diff' :
    input.scope === 'last-commit' ? 'git show HEAD' :
    input.scope === 'branch' ? 'git diff main...HEAD' :
    'git diff --cached',
    { cwd: input.workingDir }
  );

  reviewTask += stdout;

  // Add focus areas
  if (input.focus && input.focus.length > 0) {
    reviewTask += `\n\nFocus areas: ${input.focus.join(', ')}`;
  }

  // Execute review via Codex
  const result = await codexRun({
    task: reviewTask,
    mode: 'read-only',
    model: 'gpt-5', // Use reasoning for deep review
  });

  return result;
}
```

---

#### Tool 3: `_codex_session_status`

**Description**: Get current session configuration

**MCP Schema**:
```typescript
{
  name: '_codex_session_status',
  description: 'Get current session configuration including model, reasoning level, and active profile',
  inputSchema: { type: 'object', properties: {} }
}
```

**Output Example**:
```typescript
{
  model: 'gpt-5-codex',
  reasoningLevel: 'medium',
  approvalMode: 'on-failure',
  sandboxMode: 'workspace-write',
  activeProfile: null,
  sessionStarted: '2025-11-15T14:30:00Z',
  tasksExecuted: 5,
  totalTokens: 45000,
  estimatedCost: '$0.27'
}
```

---

## Feature 6: Configuration Profiles

### Priority: 🟡 MEDIUM

### Current Gap

**Codex CLI capability**:
```bash
codex --profile security "Audit codebase"
codex --profile fast "Quick syntax check"
codex -p production "Deploy"
```

**MCP Status**: ❌ NOT EXPOSED

### Profile Examples

```yaml
# security.yaml
name: security
model: gpt-5
reasoning: high
sandbox: read-only
approvals: untrusted
tools:
  webSearch: true
  images: false
limits:
  maxOutputTokens: 10000
  dailyCostUsd: 5.00

# fast.yaml
name: fast
model: gpt-5-codex
reasoning: low
sandbox: read-only
approvals: on-failure
limits:
  maxOutputTokens: 2000
```

### New Tools Required

#### Tool 1: `_codex_list_profiles`

**MCP Schema**:
```typescript
{
  name: '_codex_list_profiles',
  description: 'List available configuration profiles',
  inputSchema: { type: 'object', properties: {} }
}
```

**Output Example**:
```typescript
{
  profiles: [
    {
      name: 'security',
      model: 'gpt-5',
      reasoning: 'high',
      sandbox: 'read-only',
      description: 'Security audit mode with strict sandbox'
    },
    {
      name: 'fast',
      model: 'gpt-5-codex',
      reasoning: 'low',
      sandbox: 'read-only',
      description: 'Fast execution for simple tasks'
    },
    {
      name: 'production',
      model: 'gpt-5',
      reasoning: 'high',
      sandbox: 'workspace-write',
      description: 'Production deployment mode'
    }
  ]
}
```

---

#### Tool 2: `_codex_set_profile`

**MCP Schema**:
```typescript
{
  name: '_codex_set_profile',
  description: 'Set active configuration profile',
  inputSchema: {
    type: 'object',
    properties: {
      profileName: {
        type: 'string',
        description: 'Name of profile to activate'
      }
    },
    required: ['profileName']
  }
}
```

---

#### Tool 3: `_codex_create_profile`

**MCP Schema**:
```typescript
{
  name: '_codex_create_profile',
  description: 'Create custom configuration profile',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      config: {
        type: 'object',
        properties: {
          model: { type: 'string' },
          reasoning: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'max']
          },
          sandbox: { type: 'string' },
          approvals: { type: 'string' },
          limits: {
            type: 'object',
            properties: {
              maxOutputTokens: { type: 'number' },
              dailyCostUsd: { type: 'number' }
            }
          }
        }
      }
    },
    required: ['name', 'config']
  }
}
```

**Implementation**:
```typescript
interface Profile {
  name: string;
  model: string;
  reasoning?: 'low' | 'medium' | 'high' | 'max';
  sandbox: string;
  approvals: string;
  tools?: {
    webSearch?: boolean;
    images?: boolean;
  };
  limits?: {
    maxOutputTokens?: number;
    dailyCostUsd?: number;
  };
}

const DEFAULT_PROFILES: Profile[] = [
  {
    name: 'security',
    model: 'gpt-5',
    reasoning: 'high',
    sandbox: 'read-only',
    approvals: 'untrusted',
  },
  {
    name: 'fast',
    model: 'gpt-5-codex',
    reasoning: 'low',
    sandbox: 'read-only',
    approvals: 'on-failure',
  },
  {
    name: 'production',
    model: 'gpt-5',
    reasoning: 'high',
    sandbox: 'workspace-write',
    approvals: 'on-request',
  },
];

// Load custom profiles from disk
const PROFILES_DIR = path.join(os.homedir(), '.codex-control', 'profiles');

export async function loadProfiles(): Promise<Profile[]> {
  const profiles = [...DEFAULT_PROFILES];

  try {
    const files = await fs.readdir(PROFILES_DIR);
    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        const content = await fs.readFile(path.join(PROFILES_DIR, file), 'utf-8');
        const profile = yaml.parse(content);
        profiles.push(profile);
      }
    }
  } catch (error) {
    // Profiles directory doesn't exist yet
  }

  return profiles;
}

export async function createProfile(input: { name: string; config: any }) {
  await fs.mkdir(PROFILES_DIR, { recursive: true });

  const profilePath = path.join(PROFILES_DIR, `${input.name}.yaml`);
  const profileContent = yaml.stringify(input.config);

  await fs.writeFile(profilePath, profileContent);

  return {
    success: true,
    profileName: input.name,
    filePath: profilePath,
    message: `Profile ${input.name} created successfully`,
  };
}
```

---

## Implementation Priority Summary

### Phase 1 (v3.2.0) - 1-2 weeks
**MUST HAVE**:
1. ✅ Model Selection (`_codex_list_models`, `_codex_set_default_model`, `_codex_get_active_model`)
2. ✅ Reasoning Levels (`_codex_set_reasoning_level`, `_codex_get_reasoning_level`)

**Why**: Immediate cost optimization (50-90% savings on simple tasks)

### Phase 2 (v3.3.0) - 2-3 weeks
**SHOULD HAVE**:
3. ✅ Multimodal Support (`_codex_local_run_with_images`, `_codex_local_exec_with_images`)
4. ✅ Web Search (`_codex_local_run_with_search`)

**Why**: Enables new workflows (visual analysis, current documentation)

### Phase 3 (v3.4.0) - 1-2 weeks
**NICE TO HAVE**:
5. ✅ Session Commands (`_codex_session_init`, `_codex_session_review`, `_codex_session_status`)
6. ✅ Configuration Profiles (`_codex_list_profiles`, `_codex_set_profile`, `_codex_create_profile`)

**Why**: Better UX and workflow automation

---

## Testing Checklist

### Unit Tests
- [ ] Model registry returns all models
- [ ] Model filtering by capability works
- [ ] Reasoning level validation works
- [ ] Image path validation works
- [ ] Profile loading/merging works

### Integration Tests
- [ ] Model switching mid-session
- [ ] Reasoning level changes token usage
- [ ] Images passed correctly to Codex CLI
- [ ] Web search returns results
- [ ] Profiles apply all settings

### Production Validation
- [ ] Test in Auditor Toolkit project
- [ ] Verify cost savings with reasoning levels
- [ ] Validate multimodal with real images
- [ ] Test profile switching workflows

---

## File Structure for Implementation

```
src/
├── tools/
│   ├── model_selection.ts          # NEW - Model tools
│   ├── reasoning_levels.ts         # NEW - Reasoning tools
│   ├── multimodal.ts                # NEW - Image tools
│   ├── web_search.ts                # NEW - Search tools
│   ├── session_commands.ts          # NEW - Session tools
│   └── profiles.ts                  # NEW - Profile tools
├── state/
│   ├── model_registry.ts            # NEW - Model metadata
│   ├── session_state.ts             # NEW - Session configuration
│   └── profile_loader.ts            # NEW - Profile management
└── index.ts                         # UPDATE - Register new tools
```

---

**Document Status**: ✅ Complete and ready for implementation
**Next Steps**: Begin Phase 1 implementation (Model Selection + Reasoning Levels)
**Last Updated**: 2025-11-15
