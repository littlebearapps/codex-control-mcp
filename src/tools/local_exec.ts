import { Codex } from '@openai/codex-sdk';
import { z } from 'zod';

const LocalExecInputSchema = z.object({
  task: z.string().describe('The task to execute locally'),
  workingDir: z.string().optional().describe('Working directory (defaults to current directory)'),
  mode: z.enum(['read-only', 'full-auto', 'danger-full-access']).optional().default('read-only').describe('Execution mode: read-only (safe), full-auto (can edit files), danger-full-access (unrestricted)'),
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
      name: 'codex_local_exec',
      description: 'Execute a Codex task locally with real-time status tracking via TypeScript SDK. Runs on your Mac, uses local filesystem, provides full event stream visibility. Perfect for: tasks needing status tracking, iterative development, local service integration. Returns: thread ID for resumption, all events, final response, token usage.',
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
            enum: ['read-only', 'full-auto', 'danger-full-access'],
            description: 'Execution mode: read-only (safe), full-auto (can edit files), danger-full-access (unrestricted)',
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

  async execute(input: LocalExecInput): Promise<LocalExecResult> {
    try {
      // Validate input
      const validated = LocalExecInputSchema.parse(input);

      // Initialize Codex SDK
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

      const thread = codex.startThread(threadOptions);

      // Prepare run options
      const runOptions: any = {
        sandbox: validated.mode,
      };

      if (validated.outputSchema) {
        runOptions.outputSchema = validated.outputSchema;
      }

      // Execute with streaming to capture all events
      const { events } = await thread.runStreamed(validated.task, runOptions);

      const eventLog: any[] = [];
      let finalResponse = '';
      let usage: any = undefined;

      // Stream and collect events
      for await (const event of events) {
        eventLog.push(event);

        // Extract final response and usage
        if (event.type === 'turn.completed') {
          // Find the final agent_message item
          const agentMessage = eventLog
            .filter((e) => e.type === 'item.completed' && e.item?.type === 'agent_message')
            .pop();

          if (agentMessage?.item?.text) {
            finalResponse = agentMessage.item.text;
          }

          // Capture usage stats
          if (event.usage) {
            usage = event.usage;
          }
        }
      }

      return {
        success: true,
        threadId: thread.id || 'unknown',
        events: eventLog,
        finalResponse,
        usage,
      };
    } catch (error) {
      return {
        success: false,
        threadId: '',
        events: [],
        finalResponse: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
