import { Codex } from '@openai/codex-sdk';
import { z } from 'zod';
import { RiskyOperationDetector, GitOperationTier } from '../security/risky_operation_detector.js';
import { SafetyCheckpointing } from '../security/safety_checkpointing.js';
import {
  ToolExecuteExtra,
  sendProgressNotification,
  createElapsedTimeNotification,
  createCompletionNotification,
} from '../types/progress.js';

const LocalResumeInputSchema = z.object({
  threadId: z.string().describe('The thread ID to resume'),
  task: z.string().describe('The follow-up task to execute'),
  mode: z.enum(['read-only', 'workspace-write', 'danger-full-access']).optional().default('read-only').describe('Execution mode'),
  outputSchema: z.any().optional().describe('Optional JSON Schema for structured output'),
  model: z.string().optional().describe('Model to use (e.g., gpt-5-codex, gpt-5)'),
  allow_destructive_git: z.boolean().optional().default(false).describe('Allow risky git operations (rebase, reset --hard, force push, etc.). User must explicitly confirm via Claude Code dialog.'),
  format: z.enum(['json', 'markdown']).optional().default('markdown').describe('Output format. Default markdown for backward compatibility.'),
});

export type LocalResumeInput = z.infer<typeof LocalResumeInputSchema>;

export interface LocalResumeResult {
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

export class LocalResumeTool {
  static getSchema() {
    return {
      name: '_codex_local_resume',
      description: 'Continue a previous conversation - like replying to an email thread. Takes a thread ID from _codex_local_exec and lets you ask follow-ups while keeping full context. The beauty: Codex remembers everything from the previous analysis, so you get 45-93% token savings from caching. Use this when: you want to refine previous work, ask "now fix the bugs you found", or iterate on a design. Think of it as the "reply" button for Codex conversations. Works across Claude Code restarts (threads saved to ~/.codex/sessions). Perfect for: multi-step refactoring, iterative debugging, "show me, then do it" workflows. Requires: thread ID from previous _codex_local_exec call. Avoid for: starting new unrelated tasks (use _codex_local_exec instead).',
      inputSchema: {
        type: 'object',
        properties: {
          threadId: {
            type: 'string',
            description: 'The thread ID to resume (from previous codex_local_exec result)',
          },
          task: {
            type: 'string',
            description: 'The follow-up task to execute in this thread',
          },
          mode: {
            type: 'string',
            enum: ['read-only', 'workspace-write', 'danger-full-access'],
            description: 'Execution mode',
            default: 'read-only',
          },
          outputSchema: {
            type: 'object',
            description: 'Optional JSON Schema for structured output',
          },
          model: {
            type: 'string',
            description: 'Model to use (e.g., gpt-5-codex, gpt-5)',
          },
          format: {
            type: 'string',
            enum: ['json', 'markdown'],
            default: 'markdown',
            description: 'Response format. Default markdown for backward compatibility.',
          },
        },
        required: ['threadId', 'task'],
      },
    };
  }

  async execute(input: LocalResumeInput, extra?: ToolExecuteExtra): Promise<any> {
    console.error('[LocalResume] ==================== EXECUTE START ====================');
    console.error('[LocalResume] Resuming thread with:', JSON.stringify(input, null, 2));

    try {
      // Validate input (Bug 2 fix: structured envelope on validation error)
      const validationResult = LocalResumeInputSchema.safeParse(input);
      if (!validationResult.success) {
        if ((input as any)?.format === 'json') {
          const json = {
            version: '3.6',
            schema_id: 'codex/v3.6/error/v1',
            tool: '_codex_local_resume',
            request_id: (await import('crypto')).randomUUID(),
            ts: new Date().toISOString(),
            status: 'error',
            error: {
              code: 'VALIDATION' as const,
              message: 'Invalid parameters',
              details: validationResult.error.errors,
              retryable: false,
            },
          } as const;
          return { content: [{ type: 'text', text: JSON.stringify(json, null, 2) }], isError: true };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(validationResult.error.errors, null, 2) }],
          isError: true,
        };
      }

      const validated = validationResult.data;
      console.error('[LocalResume] ✅ Input validated successfully');
      let checkpointInfo: string | null = null; // Store checkpoint info for inclusion in output

      // GIT SAFETY CHECK: Detect and block risky git operations
      const detector = new RiskyOperationDetector();
      const riskyOps = detector.detect(validated.task);

      if (riskyOps.length > 0) {
        const highestTier = detector.getHighestRiskTier(validated.task);

        // Tier 1: ALWAYS BLOCKED
        if (highestTier === GitOperationTier.ALWAYS_BLOCKED) {
          const blockedOps = riskyOps.filter((op) => op.tier === GitOperationTier.ALWAYS_BLOCKED);
          const errorMessage = detector.formatBlockedMessage(blockedOps);

          console.error('[LocalResume] ❌ BLOCKED - Destructive git operation detected');
          return {
            content: [
              {
                type: 'text',
                text: errorMessage,
              },
            ],
            isError: true,
          };
        }

        // Tier 2: REQUIRES CONFIRMATION
        if (highestTier === GitOperationTier.REQUIRES_CONFIRMATION && !validated.allow_destructive_git) {
          const riskyOpsToConfirm = riskyOps.filter(
            (op) => op.tier === GitOperationTier.REQUIRES_CONFIRMATION
          );
          const confirmMessage = detector.formatConfirmationMessage(riskyOpsToConfirm);
          const confirmMetadata = detector.formatConfirmationMetadata(riskyOpsToConfirm);

          console.error('[LocalResume] ⚠️ RISKY operation detected, user confirmation required');
          return {
            content: [
              {
                type: 'text',
                text: confirmMessage,
              },
            ],
            isError: true,
            metadata: confirmMetadata,
          };
        }

        // User confirmed risky operation - Create safety checkpoint
        if (validated.allow_destructive_git) {
          console.error('[LocalResume] ⚠️  User confirmed risky operation, creating safety checkpoint...');

          const checkpointing = new SafetyCheckpointing();
          // Note: workingDir not available in resume, use cwd
          const workingDir = process.cwd();
          const riskyOpsToCheckpoint = riskyOps.filter(
            (op) => op.tier === GitOperationTier.REQUIRES_CONFIRMATION
          );

          // Create checkpoint
          const operation = riskyOpsToCheckpoint[0].operation.replace(/\s+/g, '-').toLowerCase();
          const checkpoint = await checkpointing.createCheckpoint(operation, workingDir);

          checkpointInfo = checkpointing.formatRecoveryInstructions(checkpoint);

          console.error('[LocalResume] ✅ Safety checkpoint created:', checkpoint.safety_branch);
          console.error('[LocalResume] Recovery instructions will be included in output');
        }
      }

      // Initialize Codex SDK
      console.error('[LocalResume] Initializing Codex SDK...');
      const codex = new Codex();

      // Resume thread
      console.error('[LocalResume] Resuming thread:', validated.threadId);
      const thread = codex.resumeThread(validated.threadId);

      // Prepare run options
      const runOptions: any = {
        sandbox: validated.mode,
      };

      if (validated.outputSchema) {
        runOptions.outputSchema = validated.outputSchema;
      }

      if (validated.model) {
        runOptions.model = validated.model;
      }

      console.error('[LocalResume] Running task with options:', runOptions);
      console.error('[LocalResume] *** STARTING ASYNC EXECUTION (NON-BLOCKING) ***');

      // ASYNC MODE: Start execution but DON'T WAIT - return thread ID immediately
      // The SDK handles persistence via ~/.codex/sessions/
      // User can call codex_local_resume again to continue or check results

      // Kick off execution in background (don't await)
      thread.runStreamed(validated.task, runOptions).then(async ({ events }) => {
        console.error(`[LocalResume:${validated.threadId}] Background execution started`);

        // Setup timeout detection (v3.2.1)
        const idleTimeoutMs = 5 * 60 * 1000; // 5 minutes of no events
        const hardTimeoutMs = 20 * 60 * 1000; // 20 minutes total execution time
        let lastEventTime = Date.now();
        let timedOut = false;

        // MCP Progress Notifications (v3.5.0)
        const startTime = Date.now();

        // Hard timeout watchdog
        const hardTimeoutTimer = setTimeout(() => {
          if (!timedOut) {
            timedOut = true;
            console.error(`[LocalResume:${validated.threadId}] ⏱️ HARD TIMEOUT after ${hardTimeoutMs / 1000}s`);
          }
        }, hardTimeoutMs);

        // Idle timeout check (runs every 30s)
        const idleCheckInterval = setInterval(() => {
          const idleTime = Date.now() - lastEventTime;
          if (idleTime > idleTimeoutMs && !timedOut) {
            timedOut = true;
            console.error(`[LocalResume:${validated.threadId}] ⏱️ IDLE TIMEOUT after ${idleTimeoutMs / 1000}s of inactivity`);
            clearTimeout(hardTimeoutTimer);
            clearInterval(idleCheckInterval);
          }
        }, 30000); // Check every 30 seconds

        // Process events in background
        let eventCount = 0;
        try {
          for await (const event of events) {
            // Update last event time (reset idle timeout)
            lastEventTime = Date.now();

            // Stop if timed out
            if (timedOut) {
              console.error(`[LocalResume:${validated.threadId}] Stopping iteration - timed out`);
              break;
            }

            eventCount++;
            console.error(`[LocalResume:${validated.threadId}] Event ${eventCount}:`, event.type);

            // Send MCP progress notification every 10 events (v3.5.0)
            if (eventCount % 10 === 0) {
              const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
              await sendProgressNotification(
                extra,
                createElapsedTimeNotification(validated.threadId, elapsedSeconds),
                `LocalResume:${validated.threadId}`
              );
            }
          }

          // Clear timeout timers (v3.2.1)
          clearTimeout(hardTimeoutTimer);
          clearInterval(idleCheckInterval);

          console.error(`[LocalResume:${validated.threadId}] ✅ Execution complete, ${eventCount} events processed`);

          // Send final completion notification (v3.5.0)
          await sendProgressNotification(
            extra,
            createCompletionNotification(validated.threadId, 'Codex SDK thread resumed - execution complete'),
            `LocalResume:${validated.threadId}`
          );
        } catch (streamError) {
          // Clear timeout timers (v3.2.1)
          clearTimeout(hardTimeoutTimer);
          clearInterval(idleCheckInterval);

          console.error(`[LocalResume:${validated.threadId}] ❌ Error during execution:`, streamError);
        }
      }).catch((error) => {
        console.error(`[LocalResume:${validated.threadId}] ❌ Fatal error:`, error);
      });

      // Build response message
      let responseText = '';

      // Prepend safety checkpoint info if it exists
      if (checkpointInfo) {
        responseText += `🛡️  **GIT SAFETY CHECKPOINT CREATED**\n\n${checkpointInfo}\n\n---\n\n`;
      }

      responseText += `✅ Codex SDK Thread Resumed (Async)\n\n**Thread ID**: \`${validated.threadId}\`\n\n**Follow-up Task**: ${validated.task}\n\n**Mode**: ${validated.mode}\n\n**Status**: Executing in background\n\n💡 **Thread Persistence**: Results are saved to \`~/.codex/sessions/${validated.threadId}/\`\n\n**Check Progress**:\n- Call \`codex_local_resume\` again with this thread ID to check results or continue\n- Thread data persists across Claude Code sessions\n- High cache rates (45-93%) on resumed threads\n\n**Note**: Execution continues in background. The conversation history is preserved and you can continue interacting with this thread.`;

      // Return thread ID immediately (non-blocking)
      if (validated.format === 'json') {
        const json = {
          version: '3.6',
          schema_id: 'codex/v3.6/execution_ack/v1',
          tool: '_codex_local_resume',
          tool_category: 'execution_ack',
          request_id: (await import('crypto')).randomUUID(),
          ts: new Date().toISOString(),
          status: 'ok',
          meta: {},
          data: {
            task_id: `T-local-resume-${Date.now()}`,
            thread_id: validated.threadId,
            accepted: true,
            capability: 'background',
            started_at: new Date().toISOString(),
          },
        } as const;
        console.error('[LocalResume] ✅ Returned JSON execution_ack');
        console.error('[LocalResume] ==================== EXECUTE END (ASYNC) ====================');
        return { content: [{ type: 'text', text: JSON.stringify(json) }] };
      }

      const mcpResponse = {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };

      console.error('[LocalResume] ✅ Returned thread ID immediately (non-blocking)');
      console.error('[LocalResume] ==================== EXECUTE END (ASYNC) ====================');
      return mcpResponse;
    } catch (error) {
      console.error('[LocalResume] ❌❌❌ CAUGHT ERROR ❌❌❌');
      console.error('[LocalResume] Error type:', error instanceof Error ? 'Error' : typeof error);
      console.error('[LocalResume] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[LocalResume] Error stack:', error instanceof Error ? error.stack : 'N/A');

      const errorResult = {
        success: false,
        threadId: input.threadId,
        events: [],
        finalResponse: '',
        error: error instanceof Error ? error.message : String(error),
      };

      // Return MCP-compatible error response
      const errorResponse = {
        content: [
          {
            type: 'text',
            text: `❌ codex_local_resume failed:\n${JSON.stringify(errorResult, null, 2)}`,
          },
        ],
        isError: true,
      };

      console.error('[LocalResume] ==================== EXECUTE END (ERROR) ====================');
      return errorResponse;
    }
  }
}
