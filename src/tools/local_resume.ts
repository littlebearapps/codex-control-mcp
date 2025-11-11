import { Codex } from '@openai/codex-sdk';
import { z } from 'zod';

const LocalResumeInputSchema = z.object({
  threadId: z.string().describe('The thread ID to resume'),
  task: z.string().describe('The follow-up task to execute'),
  mode: z.enum(['read-only', 'full-auto', 'danger-full-access']).optional().default('read-only').describe('Execution mode'),
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
            enum: ['read-only', 'full-auto', 'danger-full-access'],
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

  async execute(input: LocalResumeInput): Promise<LocalResumeResult> {
    try {
      // Validate input
      const validated = LocalResumeInputSchema.parse(input);

      // Initialize Codex SDK
      const codex = new Codex();

      // Resume thread
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

      // Execute with streaming
      const { events } = await thread.runStreamed(validated.task, runOptions);

      const eventLog: any[] = [];
      let finalResponse = '';
      let usage: any = undefined;

      // Stream and collect events
      for await (const event of events) {
        eventLog.push(event);

        if (event.type === 'turn.completed') {
          const agentMessage = eventLog
            .filter((e) => e.type === 'item.completed' && e.item?.type === 'agent_message')
            .pop();

          if (agentMessage?.item?.text) {
            finalResponse = agentMessage.item.text;
          }

          if (event.usage) {
            usage = event.usage;
          }
        }
      }

      return {
        success: true,
        threadId: validated.threadId,
        events: eventLog,
        finalResponse,
        usage,
      };
    } catch (error) {
      return {
        success: false,
        threadId: input.threadId,
        events: [],
        finalResponse: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
