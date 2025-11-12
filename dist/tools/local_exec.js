import { Codex } from '@openai/codex-sdk';
import { z } from 'zod';
import { localTaskRegistry } from '../state/local_task_registry.js';
const LocalExecInputSchema = z.object({
    task: z.string().describe('The task to execute locally'),
    workingDir: z.string().optional().describe('Working directory (defaults to current directory)'),
    mode: z.enum(['read-only', 'workspace-write', 'danger-full-access']).optional().default('read-only').describe('Execution mode: read-only (safe), workspace-write (can edit files), danger-full-access (unrestricted)'),
    outputSchema: z.any().optional().describe('Optional JSON Schema for structured output'),
    skipGitRepoCheck: z.boolean().optional().default(false).describe('Skip Git repository check (use with caution)'),
    model: z.string().optional().describe('Model to use (e.g., gpt-5-codex, gpt-5)'),
});
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

2. 'workspace-write' (Caution - Direct Modifications):
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
3. If approved: Apply manually OR re-run with mode='workspace-write' in feature branch
4. Follow-up: Use codex_local_resume with thread ID for refinements

For Iterative Development:
1. Start: codex_local_exec with mode='workspace-write' in feature branch
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
    async execute(input) {
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
            const threadOptions = {
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
            const runOptions = {
                sandbox: validated.mode,
            };
            if (validated.outputSchema) {
                runOptions.outputSchema = validated.outputSchema;
            }
            console.error('[LocalExec] Running task with options:', runOptions);
            console.error('[LocalExec] *** STARTING ASYNC EXECUTION (NON-BLOCKING) ***');
            // Generate task ID for tracking
            const taskId = `sdk-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            // Create promise wrapper for SDK execution
            const executionPromise = new Promise(async (resolve, reject) => {
                try {
                    const { events } = await thread.runStreamed(validated.task, runOptions);
                    let threadId = '';
                    let eventCount = 0;
                    const eventLog = [];
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
                        }
                        else if (event.type === 'item.completed' && event.output) {
                            finalOutput += JSON.stringify(event.output) + '\n';
                        }
                    }
                    console.error(`[LocalExec:${taskId}] ✅ Execution complete, ${eventCount} events, thread: ${threadId}`);
                    resolve({
                        success: true,
                        stdout: finalOutput || `SDK execution complete (${eventCount} events, thread: ${threadId})`,
                        stderr: '',
                        exitCode: 0,
                        signal: null,
                        events: eventLog,
                    });
                }
                catch (error) {
                    console.error(`[LocalExec:${taskId}] ❌ Error:`, error);
                    reject(error);
                }
            });
            // Register task in registry for status tracking
            localTaskRegistry.registerTask(taskId, validated.task, executionPromise, {
                mode: validated.mode,
                model: validated.model,
                workingDir: validated.workingDir,
            });
            // Return task ID immediately (non-blocking)
            const mcpResponse = {
                content: [
                    {
                        type: 'text',
                        text: `✅ Codex SDK Task Started (Async)\n\n**Task ID**: \`${taskId}\`\n\n**Task**: ${validated.task}\n\n**Mode**: ${validated.mode}\n\n**Working Directory**: ${validated.workingDir || process.cwd()}\n\n**Status**: Running in background\n\n💡 **Check Progress**:\n- Use \`codex_local_status\` to check status\n- Use \`codex_local_results\` with task ID to get results when complete\n- Thread data persists in \`~/.codex/sessions/\` for resumption\n\n**Note**: SDK execution continues in background. Results will include thread ID for use with \`codex_local_resume\`.`,
                    },
                ],
            };
            console.error('[LocalExec] ✅ Returned task ID immediately (non-blocking)');
            console.error('[LocalExec] ==================== EXECUTE END (ASYNC) ====================');
            return mcpResponse;
        }
        catch (error) {
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
//# sourceMappingURL=local_exec.js.map