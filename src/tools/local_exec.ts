import { Codex } from '@openai/codex-sdk';
import { z } from 'zod';
import { globalTaskRegistry } from '../state/task_registry.js';

const LocalExecInputSchema = z.object({
  task: z.string().describe('The task to execute locally'),
  workingDir: z.string().optional().describe('Working directory (defaults to current directory)'),
  mode: z.enum(['read-only', 'workspace-write', 'danger-full-access']).optional().default('read-only').describe('Execution mode: read-only (safe), workspace-write (can edit files), danger-full-access (unrestricted)'),
  outputSchema: z.any().optional().describe('Optional JSON Schema for structured output'),
  skipGitRepoCheck: z.boolean().optional().default(false).describe('Skip Git repository check (use with caution)'),
  model: z.string().optional().describe('Model to use (e.g., gpt-5-codex, gpt-5)'),
});

export type LocalExecInput = z.infer<typeof LocalExecInputSchema>;

export interface LocalExecResult {
  success: boolean;
  threadId: string;
  events: any[];
  finalResponse: string;
  usage?: {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
  };
  error?: string;
}

export class LocalExecTool {
  static getSchema() {
    return {
      name: '_codex_local_exec',
      description: `Advanced local execution with real-time progress - like having a conversation with Codex. Unlike the simple one-shot _codex_local_run, this gives you a thread ID that preserves context for follow-up questions. Think of it as opening a chat window vs sending a single message. Use this when: you want iterative development, need to ask follow-ups, or want to see live progress updates. The magic: 45-93% token cache rates on resumed threads = huge cost savings. Three modes: 'read-only' (safe, just analysis), 'workspace-write' (direct file changes in git repos), 'danger-full-access' (unrestricted - use with extreme caution). Returns: thread ID (use with _codex_local_resume), real-time events, final output, token usage. Perfect for: "analyze this, then if you find bugs, fix them" workflows. Avoid for: simple one-off tasks (use _codex_local_run), or tasks over 30 minutes (use _codex_cloud_submit).`,
      inputSchema: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description: 'The task to execute locally',
          },
          workingDir: {
            type: 'string',
            description: 'Working directory (defaults to current directory)',
          },
          mode: {
            type: 'string',
            enum: ['read-only', 'workspace-write', 'danger-full-access'],
            description: 'Execution mode: read-only (safe), workspace-write (can edit files), danger-full-access (unrestricted)',
            default: 'read-only',
          },
          outputSchema: {
            type: 'object',
            description: 'Optional JSON Schema for structured output',
          },
          skipGitRepoCheck: {
            type: 'boolean',
            description: 'Skip Git repository check (use with caution)',
            default: false,
          },
          model: {
            type: 'string',
            description: 'Model to use (e.g., gpt-5-codex, gpt-5)',
          },
        },
        required: ['task'],
      },
    };
  }

  async execute(input: LocalExecInput): Promise<any> {
    try {
      console.error('[LocalExec] Starting execution with:', JSON.stringify(input, null, 2));

      // TEST MODE: Return immediately to verify MCP response works
      if (process.env.LOCAL_EXEC_TEST_MODE === 'true') {
        console.error('[LocalExec] TEST MODE: Returning immediate test response');
        return {
          content: [
            {
              type: 'text',
              text: '🧪 TEST MODE: This is a test response from codex_local_exec. If you see this, MCP response mechanism works!',
            },
          ],
        };
      }

      // Validate input
      const validated = LocalExecInputSchema.parse(input);
      console.error('[LocalExec] Input validated:', validated);

      // Initialize Codex SDK
      console.error('[LocalExec] Initializing Codex SDK...');
      const codex = new Codex();

      // Start thread with configuration
      const threadOptions: any = {
        skipGitRepoCheck: validated.skipGitRepoCheck,
      };

      if (validated.workingDir) {
        threadOptions.workingDirectory = validated.workingDir;
      }

      if (validated.model) {
        threadOptions.model = validated.model;
      }

      console.error('[LocalExec] Starting thread with options:', threadOptions);
      const thread = codex.startThread(threadOptions);
      console.error('[LocalExec] Thread started with ID:', thread.id);

      // Prepare run options
      const runOptions: any = {
        sandbox: validated.mode,
      };

      if (validated.outputSchema) {
        runOptions.outputSchema = validated.outputSchema;
      }

      console.error('[LocalExec] Running task with options:', runOptions);
      console.error('[LocalExec] *** STARTING ASYNC EXECUTION (NON-BLOCKING) ***');

      // Register task in unified SQLite registry BEFORE execution
      const registeredTask = globalTaskRegistry.registerTask({
        origin: 'local',
        instruction: validated.task,
        workingDir: validated.workingDir || process.cwd(),
        mode: validated.mode,
        model: validated.model,
        threadId: thread.id || undefined, // Will be updated once available
      });

      const taskId = registeredTask.id;
      console.error('[LocalExec] Registered task in SQLite registry:', taskId);

      // Update status to 'working' immediately
      globalTaskRegistry.updateStatus(taskId, 'working');

      // Execute in background (fire and forget - updates registry on completion)
      (async () => {
        try {
          const { events } = await thread.runStreamed(validated.task, runOptions);

          let threadId = '';
          let eventCount = 0;
          const eventLog: any[] = [];
          let finalOutput = '';

          console.error(`[LocalExec:${taskId}] Background execution started`);

          for await (const event of events) {
            eventCount++;
            eventLog.push(event);

            // Capture thread ID when it becomes available
            if (!threadId && thread.id) {
              threadId = thread.id;
              console.error(`[LocalExec:${taskId}] Thread ID: ${threadId}`);
            }

            console.error(`[LocalExec:${taskId}] Event ${eventCount}:`, event.type);

            // Capture final output from various event types
            if (event.type === 'turn.completed') {
              finalOutput += `Turn completed\n`;
            } else if (event.type === 'item.completed' && (event as any).output) {
              finalOutput += JSON.stringify((event as any).output) + '\n';
            }
          }

          console.error(`[LocalExec:${taskId}] ✅ Execution complete, ${eventCount} events, thread: ${threadId}`);

          // Update SQLite registry with success
          globalTaskRegistry.updateTask(taskId, {
            status: 'completed',
            threadId: threadId,
            result: JSON.stringify({
              success: true,
              eventCount,
              threadId,
              finalOutput: finalOutput || `SDK execution complete (${eventCount} events)`,
            }),
          });
        } catch (error) {
          console.error(`[LocalExec:${taskId}] ❌ Error:`, error);

          // Update SQLite registry with failure
          globalTaskRegistry.updateTask(taskId, {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })(); // Execute immediately in background

      // Task is now tracked in unified SQLite registry

      // Return unified registry task ID immediately (non-blocking)
      const mcpResponse = {
        content: [
          {
            type: 'text',
            text: `✅ Codex SDK Task Started (Async)\n\n**Task ID**: \`${taskId}\`\n\n**Task**: ${validated.task}\n\n**Mode**: ${validated.mode}\n\n**Working Directory**: ${validated.workingDir || process.cwd()}\n\n**Status**: Running in background\n\n💡 **Check Progress**:\n- Use \`_codex_local_wait\` to wait for completion: \`{ "task_id": "${taskId}" }\`\n- Use \`_codex_local_status\` to check status\n- Use \`_codex_local_results\` with task ID to get results when complete\n- Use \`_codex_local_cancel\` to cancel: \`{ "task_id": "${taskId}" }\`\n\n**Note**: Task tracked in unified SQLite registry. Thread data persists in \`~/.codex/sessions/\` for resumption with \`_codex_local_resume\`.`,
          },
        ],
      };

      console.error('[LocalExec] ✅ Returned task ID immediately (non-blocking)');
      console.error('[LocalExec] ==================== EXECUTE END (ASYNC) ====================');
      return mcpResponse;
    } catch (error) {
      console.error('[LocalExec] ❌❌❌ CAUGHT ERROR ❌❌❌');
      console.error('[LocalExec] Error type:', error instanceof Error ? 'Error' : typeof error);
      console.error('[LocalExec] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[LocalExec] Error stack:', error instanceof Error ? error.stack : 'N/A');

      const errorResult = {
        success: false,
        threadId: '',
        events: [],
        finalResponse: '',
        error: error instanceof Error ? error.message : String(error),
      };

      // Return MCP-compatible error response
      const errorResponse = {
        content: [
          {
            type: 'text',
            text: `❌ codex_local_exec failed:\n${JSON.stringify(errorResult, null, 2)}`,
          },
        ],
        isError: true,
      };

      console.error('[LocalExec] ==================== EXECUTE END (ERROR) ====================');
      return errorResponse;
    }
  }
}
