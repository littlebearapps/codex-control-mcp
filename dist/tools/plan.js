/**
 * Plan Tool - Preview Codex Task Without Execution
 *
 * Shows what Codex would do without actually executing.
 * Useful for understanding proposed changes before applying them.
 */
import { ErrorMapper } from '../executor/error_mapper.js';
import { InputValidator } from '../security/input_validator.js';
import { globalRedactor } from '../security/redactor.js';
import { localTaskRegistry } from '../state/local_task_registry.js';
export class PlanTool {
    processManager;
    constructor(processManager) {
        this.processManager = processManager;
    }
    /**
     * Execute the plan tool (dry-run)
     */
    async execute(input) {
        // Validate inputs
        const validation = InputValidator.validateAll({
            task: input.task,
            mode: 'read-only', // Plan is always read-only
            model: input.model,
            workingDir: input.workingDir,
        });
        if (!validation.valid) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Validation Error: ${validation.error}`,
                    },
                ],
                isError: true,
            };
        }
        // Execute Codex task in read-only mode (plan/preview)
        const options = {
            task: `Preview/plan this task without executing: ${input.task}`,
            mode: 'read-only',
            model: input.model,
            workingDir: input.workingDir,
            envPolicy: input.envPolicy,
            envAllowList: input.envAllowList,
        };
        try {
            // ASYNC MODE: Return immediately with task ID
            if (input.async) {
                const taskId = `local-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                const promise = this.processManager.execute(options);
                // Register task for status tracking
                localTaskRegistry.registerTask(taskId, input.task, promise, {
                    mode: 'read-only',
                    model: input.model,
                    workingDir: input.workingDir,
                });
                return {
                    content: [
                        {
                            type: 'text',
                            text: `✅ Codex Plan Task Started (Async)\n\n**Task ID**: \`${taskId}\`\n\n**Task**: Preview/plan - ${input.task}\n\n**Mode**: read-only (preview)\n\n**Status**: Running in background\n\n💡 Use \`codex_local_status\` to check progress and \`codex_local_results\` to get plan details when complete.`,
                        },
                    ],
                };
            }
            // SYNC MODE: Wait for completion (original behavior)
            const result = await this.processManager.execute(options);
            // Redact secrets from output
            const redactedOutput = globalRedactor.redactOutput({
                stdout: result.stdout,
                stderr: result.stderr,
            });
            // Check for success
            if (!result.success) {
                const error = ErrorMapper.mapProcessError(result);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `❌ Plan Failed\n\n**Error**: ${error.message}\n\n**Code**: ${error.code}\n\n**Details**:\n\`\`\`json\n${JSON.stringify(error.details, null, 2)}\n\`\`\``,
                        },
                    ],
                    isError: true,
                };
            }
            // Extract plan information from events
            const summary = ErrorMapper.extractSummary(result.events);
            const fileChanges = ErrorMapper.extractFileChanges(result.events);
            const commands = ErrorMapper.extractCommands(result.events);
            // Build plan message
            let message = `📋 Codex Task Plan (Preview)\n\n`;
            message += `**Original Task**: ${input.task}\n\n`;
            message += `**Plan Summary**: ${summary}\n\n`;
            if (fileChanges.length > 0) {
                message += `**Proposed File Changes** (${fileChanges.length}):\n`;
                for (const change of fileChanges) {
                    message += `- ${change.operation}: \`${change.path}\`\n`;
                }
                message += '\n';
            }
            if (commands.length > 0) {
                message += `**Proposed Commands** (${commands.length}):\n`;
                for (const cmd of commands) {
                    message += `- \`${cmd.command}\`\n`;
                }
                message += '\n';
            }
            message += `**Note**: This is a preview only. Use \`codex_apply\` with \`confirm=true\` to execute.\n`;
            // Include Codex output (plan details, explanations)
            if (redactedOutput.stdout.trim()) {
                const maxStdoutLength = 10000; // Prevent huge responses
                const truncatedStdout = redactedOutput.stdout.substring(0, maxStdoutLength);
                const wasTruncated = redactedOutput.stdout.length > maxStdoutLength;
                message += `\n**Codex Plan Details**:\n\`\`\`\n${truncatedStdout}\n\`\`\`\n`;
                if (wasTruncated) {
                    message += `\n*(Output truncated - showing first ${maxStdoutLength} characters)*\n`;
                }
            }
            // Include reasoning events if available
            const reasoningEvents = result.events.filter((e) => e.type === 'item.completed' && e.data?.type === 'reasoning');
            if (reasoningEvents.length > 0) {
                message += `\n**Reasoning Steps**:\n`;
                for (const event of reasoningEvents.slice(0, 3)) {
                    // Show first 3 reasoning steps
                    message += `- ${event.data?.content || 'N/A'}\n`;
                }
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: message,
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Unexpected Error\n\n${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
                isError: true,
            };
        }
    }
    /**
     * Get tool schema for MCP registration
     */
    static getSchema() {
        return {
            name: 'codex_plan',
            description: 'Preview what Codex would do for a task without executing it. Shows proposed file changes and commands.',
            inputSchema: {
                type: 'object',
                properties: {
                    task: {
                        type: 'string',
                        description: 'Task description to preview (e.g., "add error handling to main.ts")',
                    },
                    model: {
                        type: 'string',
                        description: 'OpenAI model to use (e.g., "gpt-4o", "o1", "o3-mini"). Defaults to Codex default.',
                    },
                    workingDir: {
                        type: 'string',
                        description: 'Absolute path to working directory (defaults to current directory)',
                    },
                    envPolicy: {
                        type: 'string',
                        enum: ['inherit-all', 'inherit-none', 'allow-list'],
                        default: 'inherit-none',
                        description: 'Environment variable policy: inherit-none (default, most secure), inherit-all (all vars), allow-list (specific vars only)',
                    },
                    envAllowList: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of environment variables to pass to Codex Cloud (only used with envPolicy=allow-list). Example: ["OPENAI_API_KEY", "DATABASE_URL"]',
                    },
                    async: {
                        type: 'boolean',
                        default: false,
                        description: 'Run task in background (async mode). Set to true to return immediately with a task ID, then use codex_local_status and codex_local_results to check progress and retrieve plan details.',
                    },
                },
                required: ['task'],
            },
        };
    }
}
//# sourceMappingURL=plan.js.map