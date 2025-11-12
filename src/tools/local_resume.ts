import { Codex } from '@openai/codex-sdk';
import { z } from 'zod';

const LocalResumeInputSchema = z.object({
  threadId: z.string().describe('The thread ID to resume'),
  task: z.string().describe('The follow-up task to execute'),
  mode: z.enum(['read-only', 'workspace-write', 'danger-full-access']).optional().default('read-only').describe('Execution mode'),
  outputSchema: z.any().optional().describe('Optional JSON Schema for structured output'),
  model: z.string().optional().describe('Model to use (e.g., gpt-5-codex, gpt-5)'),
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
      name: 'codex_local_resume',
      description: 'Resume a previous local Codex thread with follow-up tasks. Preserves conversation context for iterative workflows. Threads are persisted in ~/.codex/sessions and can be resumed across Claude Code restarts.',
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
        },
        required: ['threadId', 'task'],
      },
    };
  }

  async execute(input: LocalResumeInput): Promise<any> {
    console.error('[LocalResume] ==================== EXECUTE START ====================');
    console.error('[LocalResume] Resuming thread with:', JSON.stringify(input, null, 2));

    try {
      // Validate input
      const validated = LocalResumeInputSchema.parse(input);
      console.error('[LocalResume] ✅ Input validated successfully');

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

        // Process events in background
        let eventCount = 0;
        try {
          for await (const event of events) {
            eventCount++;
            console.error(`[LocalResume:${validated.threadId}] Event ${eventCount}:`, event.type);
          }
          console.error(`[LocalResume:${validated.threadId}] ✅ Execution complete, ${eventCount} events processed`);
        } catch (streamError) {
          console.error(`[LocalResume:${validated.threadId}] ❌ Error during execution:`, streamError);
        }
      }).catch((error) => {
        console.error(`[LocalResume:${validated.threadId}] ❌ Fatal error:`, error);
      });

      // Return thread ID immediately (non-blocking)
      const mcpResponse = {
        content: [
          {
            type: 'text',
            text: `✅ Codex SDK Thread Resumed (Async)\n\n**Thread ID**: \`${validated.threadId}\`\n\n**Follow-up Task**: ${validated.task}\n\n**Mode**: ${validated.mode}\n\n**Status**: Executing in background\n\n💡 **Thread Persistence**: Results are saved to \`~/.codex/sessions/${validated.threadId}/\`\n\n**Check Progress**:\n- Call \`codex_local_resume\` again with this thread ID to check results or continue\n- Thread data persists across Claude Code sessions\n- High cache rates (45-93%) on resumed threads\n\n**Note**: Execution continues in background. The conversation history is preserved and you can continue interacting with this thread.`,
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
