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
      description: `Execute a Codex task locally with real-time status tracking via TypeScript SDK. Runs on your Mac, uses local filesystem, provides full event stream visibility. Perfect for: tasks needing status tracking, iterative development, local service integration. Returns: thread ID for resumption, all events, final response, token usage.

EXECUTION MODES - Choose based on desired behavior:

1. 'read-only' (DEFAULT - Safest, Most Common):
   - Codex ANALYZES code and PROPOSES changes but DOES NOT modify files
   - Returns: Complete patch/diff with exact code to apply
   - Use when: You want to review changes before applying, learning what Codex suggests, or unsure about modifications
   - Thread resumption: Use codex_local_resume with thread ID for follow-up questions
   - How to apply: Codex provides exact commands and file contents - review and apply manually
   - Best practice: Start with read-only, review output, then decide on next steps

2. 'full-auto' (Caution - Direct Modifications):
   - Codex CAN create branches, edit files, run commands, commit changes
   - Returns: Actual filesystem changes + thread ID + event log
   - Use when: You trust Codex to make changes directly, iterative development in safe branches
   - Requires: Git repository (trusted directory)
   - Risk: Codex makes real changes - ensure you can review/revert (use feature branches!)
   - Best practice: Only use in feature branches, never on main/production

3. 'danger-full-access' (High Risk - Unrestricted):
   - Codex has UNRESTRICTED access - can modify ANY file, run ANY command
   - Returns: Any filesystem modifications + thread ID + event log
   - Use when: Codex needs system-level access, infrastructure changes, or you need maximum flexibility
   - Requires: Full understanding of what Codex will do
   - Risk: HIGH - Codex can modify critical files, delete data, run dangerous commands
   - Best practice: Only use when absolutely necessary, in isolated test environments

THREAD PERSISTENCE & RESUMPTION:
- Thread ID returned enables RESUMPTION with codex_local_resume
- Threads preserve full conversation context across sessions
- Cache benefits: 45-93% cache rates on resumed threads (significant cost savings)
- Use cases: Multi-step refactoring, iterative debugging, follow-up questions

WORKFLOW RECOMMENDATIONS:

For Code Improvements:
1. Start: codex_local_exec with mode='read-only'
2. Review: Examine Codex's proposed changes
3. If approved: Apply manually OR re-run with mode='full-auto' in feature branch
4. Follow-up: Use codex_local_resume with thread ID for refinements

For Iterative Development:
1. Start: codex_local_exec with mode='full-auto' in feature branch
2. Iterate: Use codex_local_resume for follow-up changes
3. Benefit: High cache rates (45-93%) reduce costs and latency

For Analysis Only:
1. Use: codex_local_exec with mode='read-only'
2. Get: Comprehensive analysis, suggestions, patches
3. No risk: No files modified, safe to run anytime`,
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
