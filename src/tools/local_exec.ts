import { Codex } from '@openai/codex-sdk';
import { z } from 'zod';
import { globalTaskRegistry } from '../state/task_registry.js';
import { verifyGitOperations, formatGitVerification } from '../utils/git_verifier.js';
import { ProgressInferenceEngine } from '../executor/progress_inference.js';

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
      description: `Advanced local execution with real-time progress - like having a conversation with Codex. Unlike the simple one-shot _codex_local_run, this gives you a thread ID that preserves context for follow-up questions. Think of it as opening a chat window vs sending a single message. Use this when: you want iterative development, need to ask follow-ups, or want to see live progress updates. The magic: 45-93% token cache rates on resumed threads = huge cost savings.

🔒 **SANDBOX MODES** (CRITICAL - Controls file system access):
• 'read-only' (DEFAULT): Analysis only, CANNOT create/modify files
• 'workspace-write': CAN create/modify files, initialize git repos, write code
• 'danger-full-access': Unrestricted access (use with extreme caution)

⚠️ **IMPORTANT**: If you need to CREATE FILES, WRITE CODE, or INITIALIZE GIT REPOSITORIES, you MUST use mode='workspace-write' or 'danger-full-access'. The default 'read-only' mode will FAIL for any write operations.

Returns: thread ID (use with _codex_local_resume), real-time events, final output, token usage. Perfect for: "analyze this, then if you find bugs, fix them" workflows. Avoid for: simple one-off tasks (use _codex_local_run), or tasks over 30 minutes (use _codex_cloud_submit).`,
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
            description: 'Sandbox mode - controls file system access. read-only (DEFAULT - analysis only, CANNOT write files), workspace-write (CAN create/modify files, required for git init, file creation, code writing), danger-full-access (unrestricted access). ⚠️ Use workspace-write when creating files or repos!',
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
        sandboxMode: validated.mode,  // ✅ FIX: Pass sandbox mode in ThreadOptions
        approvalPolicy: 'never',       // ✅ FIX: Enable automatic execution without prompts
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

      // Prepare run options (TurnOptions only has outputSchema)
      const runOptions: any = {};

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

          // Initialize progress tracking
          const progressEngine = new ProgressInferenceEngine();

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
            if (event.type === 'item.completed') {
              const item = (event as any).item;

              // Capture command execution output (the actual work!)
              if (item?.type === 'command_execution' && item.aggregated_output) {
                finalOutput += item.aggregated_output + '\n';
                console.error(`[LocalExec:${taskId}] Captured command output: ${item.aggregated_output.substring(0, 100)}...`);
              }

              // Capture Codex's reasoning/messages
              else if (item?.type === 'agent_message' && item.text) {
                finalOutput += item.text + '\n';
                console.error(`[LocalExec:${taskId}] Captured agent message: ${item.text.substring(0, 100)}...`);
              }
            } else if (event.type === 'turn.completed') {
              // Keep for completion marker
              console.error(`[LocalExec:${taskId}] Turn completed`);
            }

            // Track progress for real-time visibility
            progressEngine.processEvent(event);

            // Update task registry with progress every 10 events (rate limiting)
            if (eventCount % 10 === 0) {
              const progress = progressEngine.getProgress();
              globalTaskRegistry.updateProgress(taskId, progress);
              console.error(`[LocalExec:${taskId}] Progress: ${progress.progressPercentage}% (${progress.currentAction || 'processing'})`);
            }
          }

          console.error(`[LocalExec:${taskId}] ✅ Execution complete, ${eventCount} events, thread: ${threadId}`);

          // Run git verification to check if git operations actually succeeded
          console.error(`[LocalExec:${taskId}] Running git verification...`);
          const gitVerification = await verifyGitOperations(
            validated.workingDir || process.cwd(),
            validated.task
          );

          // Determine final status based on git verification
          let finalStatus: 'completed' | 'completed_with_warnings' | 'completed_with_errors' = 'completed';
          if (gitVerification.errors.length > 0) {
            finalStatus = 'completed_with_errors';
            console.error(`[LocalExec:${taskId}] ⚠️ Git verification found ${gitVerification.errors.length} errors`);
          } else if (gitVerification.warnings.length > 0) {
            finalStatus = 'completed_with_warnings';
            console.error(`[LocalExec:${taskId}] ⚠️ Git verification found ${gitVerification.warnings.length} warnings`);
          }

          // Format verification results for user
          const verificationOutput = formatGitVerification(gitVerification);

          // Update SQLite registry with success + verification results
          globalTaskRegistry.updateTask(taskId, {
            status: finalStatus,
            threadId: threadId,
            result: JSON.stringify({
              success: gitVerification.errors.length === 0,
              eventCount,
              threadId,
              finalOutput: finalOutput || `SDK execution complete (${eventCount} events)`,
              gitVerification: {
                errors: gitVerification.errors,
                warnings: gitVerification.warnings,
                recommendations: gitVerification.recommendations,
                branchCreated: gitVerification.branchExists,
                commitCreated: gitVerification.commitExists,
                filesStaged: gitVerification.filesStaged,
              },
              verificationOutput,
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
