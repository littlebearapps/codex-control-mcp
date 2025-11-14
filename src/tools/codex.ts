/**
 * Unified Codex Tool (v3.0)
 *
 * Single user-facing tool for all Codex operations.
 * Routes natural language instructions to appropriate hidden primitives.
 */

import { createRouter, RouterInput } from '../router/router.js';
import { IntentHints } from '../router/intent_parser.js';

/**
 * Codex tool input schema
 */
export interface CodexToolInput {
  // Primary interface: Natural language
  request: string; // Required: "run tests", "check my task", "cancel T-abc123"

  // Optional: Structured hints for fast-path routing
  hints?: IntentHints;

  // Optional: Execution context
  context?: {
    working_dir?: string;
    repo_root?: string;
  };

  // Optional: Preferences
  preference?: {
    mode?: 'auto' | 'local' | 'cloud';
    timeout_ms?: number;
    poll_frequency_ms?: number;
  };

  // Optional: Safety gates
  safety?: {
    require_confirmation?: boolean;
    max_cost_usd?: number;
  };

  // Optional: Debugging
  dry_run?: boolean; // Route only, don't execute
  explain?: boolean; // Include decision trace
}

/**
 * Unified Codex response
 */
export interface CodexToolResponse {
  acknowledged: boolean;
  action: 'run' | 'check' | 'wait' | 'cancel' | 'setup' | 'results' | 'none';
  decision_trace?: string[]; // If explain=true

  task?: {
    id?: string;
    mode?: 'local' | 'cloud';
    status?: 'pending' | 'working' | 'completed' | 'failed' | 'canceled' | 'unknown';
    progress?: {
      percent?: number;
      current_step?: number;
      total_steps?: number;
      step_description?: string;
    };
    created_at?: string;
    updated_at?: string;
    ttl_ms?: number;
    recommended_poll_ms?: number;
  };

  result_summary?: {
    passed?: number;
    failed?: number;
    duration_ms?: number;
    artifacts?: string[];
  };

  next_action?: 'poll' | 'await' | 'none';
  user_message: string; // Conversational summary

  // Disambiguation (if multiple tasks found)
  needs_disambiguation?: boolean;
  disambiguation_options?: Array<{
    taskId: string;
    label: string;
    status: string;
    age: string;
  }>;

  error?: {
    code: string;
    message: string;
    retry_after_ms?: number;
  };
}

/**
 * Codex tool handler
 */
export async function handleCodexTool(
  input: CodexToolInput,
  primitives?: PrimitiveToolMap
): Promise<CodexToolResponse> {
  try {
    // Step 1: Route instruction
    const router = await createRouter();
    const routerInput: RouterInput = {
      request: input.request,
      hints: input.hints,
      context: {
        workingDir: input.context?.working_dir,
        repoRoot: input.context?.repo_root,
        hasGit: !!input.context?.repo_root,
      },
      preference: {
        mode: input.preference?.mode,
        timeoutMs: input.preference?.timeout_ms,
        pollFrequencyMs: input.preference?.poll_frequency_ms,
      },
      dryRun: input.dry_run,
      explain: input.explain,
    };

    const routing = await router.route(routerInput);

    // Step 2: Check for disambiguation
    if (routing.needsDisambiguation) {
      return {
        acknowledged: true,
        action: 'none',
        user_message: `I found ${routing.disambiguationOptions?.length || 0} recent tasks. Which one did you mean?`,
        needs_disambiguation: true,
        disambiguation_options: routing.disambiguationOptions,
        decision_trace: input.explain ? routing.decisionTrace : undefined,
      };
    }

    // Step 3: Check for routing error
    if (routing.error) {
      return {
        acknowledged: false,
        action: 'none',
        user_message: routing.error.message,
        error: {
          code: routing.error.code,
          message: routing.error.message,
        },
        decision_trace: input.explain ? routing.decisionTrace : undefined,
      };
    }

    // Step 4: Execute primitive (or return dry-run result)
    if (input.dry_run) {
      return {
        acknowledged: true,
        action: mapIntentToAction(routing.intent.type),
        user_message: `[Dry Run] Would route to: ${routing.primitive}`,
        task: routing.taskId ? { id: routing.taskId } : undefined,
        decision_trace: routing.decisionTrace,
      };
    }

    // Step 5: Actually execute the primitive
    if (!primitives) {
      return {
        acknowledged: false,
        action: 'none',
        user_message: 'Primitive tools not available (server initialization error)',
        error: {
          code: 'MISSING_PRIMITIVES',
          message: 'Primitive tool map was not provided to CodexTool',
        },
        decision_trace: input.explain ? routing.decisionTrace : undefined,
      };
    }

    // Look up the primitive tool
    const primitiveTool = primitives[routing.primitive];
    if (!primitiveTool) {
      return {
        acknowledged: false,
        action: 'none',
        user_message: `Primitive ${routing.primitive} not found`,
        error: {
          code: 'PRIMITIVE_NOT_FOUND',
          message: `No tool registered for primitive: ${routing.primitive}`,
        },
        decision_trace: input.explain ? routing.decisionTrace : undefined,
      };
    }

    // Execute the primitive tool with routed parameters
    const primitiveResult = await primitiveTool.execute(routing.parameters);

    // Convert primitive result to CodexToolResponse
    return convertPrimitiveResult(primitiveResult, routing, input.explain);
  } catch (error) {
    return {
      acknowledged: false,
      action: 'none',
      user_message: error instanceof Error ? error.message : String(error),
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Convert primitive tool result to unified CodexToolResponse
 */
function convertPrimitiveResult(
  primitiveResult: any,
  routing: any,
  includeTrace: boolean | undefined
): CodexToolResponse {
  // Extract text content from primitive result
  const textContent =
    primitiveResult.content?.[0]?.text || JSON.stringify(primitiveResult, null, 2);

  // Check if primitive reported an error
  const isError = primitiveResult.isError === true;

  // Basic response structure
  const response: CodexToolResponse = {
    acknowledged: !isError,
    action: mapIntentToAction(routing.intent.type),
    user_message: isError
      ? `Primitive execution failed: ${textContent}`
      : `Executed ${routing.primitive} successfully`,
    decision_trace: includeTrace ? routing.decisionTrace : undefined,
  };

  // Add task info if available
  if (routing.taskId) {
    response.task = {
      id: routing.taskId,
      status: isError ? 'failed' : 'completed',
    };
  }

  // Add error info if primitive failed
  if (isError) {
    response.error = {
      code: 'PRIMITIVE_ERROR',
      message: textContent,
    };
  }

  return response;
}

/**
 * Map intent type to action
 */
function mapIntentToAction(intentType: string): 'run' | 'check' | 'wait' | 'cancel' | 'setup' | 'results' | 'none' {
  switch (intentType) {
    case 'execute':
      return 'run';
    case 'status':
      return 'check';
    case 'wait':
      return 'wait';
    case 'cancel':
      return 'cancel';
    case 'fetch':
      return 'results';
    case 'setup':
      return 'setup';
    default:
      return 'none';
  }
}

/**
 * MCP tool definition for unified codex tool
 */
export const codexToolDefinition = {
  name: 'codex',
  description:
    'Natural language interface to OpenAI Codex. Use this tool for all Codex operations: running tasks, checking status, getting results, setup, etc. Just describe what you want in plain English (e.g., "run tests", "check my task", "cancel T-abc123"). The tool will automatically route to the appropriate backend operation.',
  inputSchema: {
    type: 'object',
    properties: {
      request: {
        type: 'string',
        description:
          'What you want to do, in natural language. Examples: "run tests", "check status of T-local-abc123", "wait for my task to complete", "cancel T-cloud-def456", "set up GitHub integration".',
      },
      hints: {
        type: 'object',
        description:
          'Optional: Structured hints for fast-path routing. Use when you know exactly what operation you want (e.g., operation="check", taskId="T-local-abc123").',
        properties: {
          operation: {
            type: 'string',
            enum: ['run', 'check', 'wait', 'cancel', 'setup', 'results'],
            description: 'The operation type (bypasses natural language parsing).',
          },
          taskId: {
            type: 'string',
            description: 'Explicit task ID (format: T-local-abc123 or T-cloud-def456).',
          },
          mode: {
            type: 'string',
            enum: ['auto', 'local', 'cloud'],
            description: 'Execution mode preference.',
          },
        },
      },
      context: {
        type: 'object',
        description: 'Optional: Execution context (working directory, repo root).',
        properties: {
          working_dir: {
            type: 'string',
            description: 'Absolute path to working directory.',
          },
          repo_root: {
            type: 'string',
            description: 'Absolute path to repository root (if in a git repo).',
          },
        },
      },
      preference: {
        type: 'object',
        description: 'Optional: Execution preferences.',
        properties: {
          mode: {
            type: 'string',
            enum: ['auto', 'local', 'cloud'],
            description: 'Execution mode: auto (infer), local, or cloud.',
          },
          timeout_ms: {
            type: 'number',
            description: 'Timeout in milliseconds for wait operations.',
          },
          poll_frequency_ms: {
            type: 'number',
            description: 'Polling frequency in milliseconds for status checks.',
          },
        },
      },
      dry_run: {
        type: 'boolean',
        description: 'If true, route the request but do not execute. Useful for testing.',
      },
      explain: {
        type: 'boolean',
        description:
          'If true, include decision trace showing how the request was routed.',
      },
    },
    required: ['request'],
  },
};

/**
 * Primitive tool interface (for dependency injection)
 */
export interface PrimitiveTool {
  execute(params: any): Promise<any>;
}

/**
 * Primitive tool map (injected from main server)
 */
export interface PrimitiveToolMap {
  _codex_local_run: PrimitiveTool;
  _codex_local_status: PrimitiveTool;
  _codex_local_exec: PrimitiveTool;
  _codex_local_resume: PrimitiveTool;
  _codex_local_results: PrimitiveTool;
  _codex_local_wait: PrimitiveTool;
  _codex_local_cancel: PrimitiveTool;
  _codex_cloud_submit: PrimitiveTool;
  _codex_cloud_status: PrimitiveTool;
  _codex_cloud_results: PrimitiveTool;
  _codex_cloud_wait: PrimitiveTool;
  _codex_cloud_cancel: PrimitiveTool;
  _codex_cloud_list_environments: PrimitiveTool;
  _codex_cloud_github_setup: PrimitiveTool;
}

/**
 * MCP Tool Class for Unified Codex Interface
 */
export class CodexTool {
  private primitives?: PrimitiveToolMap;

  constructor(primitives?: PrimitiveToolMap) {
    this.primitives = primitives;
  }

  static getSchema() {
    return codexToolDefinition;
  }

  async execute(params: any) {
    const result = await handleCodexTool(params, this.primitives);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
}
