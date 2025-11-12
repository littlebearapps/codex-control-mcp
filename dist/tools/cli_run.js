/**
 * Run Tool - Execute Codex Tasks (Read-Only by Default)
 *
 * Executes a Codex task with read-only mode by default.
 * Returns structured results with events, summary, and file changes.
 */
import { ErrorMapper } from '../executor/error_mapper.js';
import { InputValidator } from '../security/input_validator.js';
import { globalRedactor } from '../security/redactor.js';
import { localTaskRegistry } from '../state/local_task_registry.js';
export class RunTool {
    processManager;
    constructor(processManager) {
        this.processManager = processManager;
    }
    /**
     * Execute the run tool
     */
    async execute(input) {
        // Default to read-only mode
        const mode = input.mode || 'read-only';
        // Validate inputs
        const validation = InputValidator.validateAll({
            task: input.task,
            mode,
            model: input.model,
            outputSchema: input.outputSchema,
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
        // Execute Codex task
        const options = {
            task: input.task,
            mode,
            model: input.model,
            outputSchema: input.outputSchema,
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
                    mode,
                    model: input.model,
                    workingDir: input.workingDir,
                });
                return {
                    content: [
                        {
                            type: 'text',
                            text: `✅ Codex Task Started (Async)\n\n**Task ID**: \`${taskId}\`\n\n**Task**: ${input.task}\n\n**Mode**: ${mode}\n\n**Status**: Running in background\n\n💡 Use \`codex_local_status\` to check progress and \`codex_local_results\` to get results when complete.`,
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
                            text: `❌ Codex Task Failed\n\n**Error**: ${error.message}\n\n**Code**: ${error.code}\n\n**Details**:\n\`\`\`json\n${JSON.stringify(error.details, null, 2)}\n\`\`\``,
                        },
                    ],
                    isError: true,
                };
            }
            // Extract meaningful information from events
            const summary = ErrorMapper.extractSummary(result.events);
            const fileChanges = ErrorMapper.extractFileChanges(result.events);
            const commands = ErrorMapper.extractCommands(result.events);
            // Build result message
            let message = `✅ Codex Task Completed\n\n`;
            message += `**Summary**: ${summary}\n\n`;
            if (fileChanges.length > 0) {
                message += `**File Changes** (${fileChanges.length}):\n`;
                for (const change of fileChanges) {
                    message += `- ${change.operation}: \`${change.path}\`\n`;
                }
                message += '\n';
            }
            if (commands.length > 0) {
                message += `**Commands Executed** (${commands.length}):\n`;
                for (const cmd of commands) {
                    message += `- \`${cmd.command}\` (exit ${cmd.exitCode})\n`;
                }
                message += '\n';
            }
            message += `**Events**: ${result.events.length} events captured\n`;
            message += `**Exit Code**: ${result.exitCode}\n`;
            // Include Codex output (analysis, explanations, etc.)
            if (redactedOutput.stdout.trim()) {
                const maxStdoutLength = 10000; // Prevent huge responses
                const truncatedStdout = redactedOutput.stdout.substring(0, maxStdoutLength);
                const wasTruncated = redactedOutput.stdout.length > maxStdoutLength;
                message += `\n**Codex Output**:\n\`\`\`\n${truncatedStdout}\n\`\`\`\n`;
                if (wasTruncated) {
                    message += `\n*(Output truncated - showing first ${maxStdoutLength} characters)*\n`;
                }
            }
            // Include stderr if present (warnings, debug info)
            if (redactedOutput.stderr.trim()) {
                message += `\n**Warnings/Debug Info**:\n\`\`\`\n${redactedOutput.stderr.substring(0, 1000)}\n\`\`\`\n`;
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
            name: 'codex_cli_run',
            description: 'Execute a local Codex task via CLI (read-only by default). Use for analyzing code, reading files, running tests, etc.',
            inputSchema: {
                type: 'object',
                properties: {
                    task: {
                        type: 'string',
                        description: 'Task description for Codex (e.g., "analyze the main.ts file for bugs")',
                    },
                    mode: {
                        type: 'string',
                        enum: ['read-only', 'workspace-write', 'danger-full-access'],
                        default: 'read-only',
                        description: 'Execution mode: read-only (safe), workspace-write (can modify files), danger-full-access (unrestricted)',
                    },
                    model: {
                        type: 'string',
                        description: 'OpenAI model to use (e.g., "gpt-4o", "o1", "o3-mini"). Defaults to Codex default.',
                    },
                    outputSchema: {
                        type: 'object',
                        description: 'Optional JSON schema for structured output',
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
                        description: 'Run task asynchronously (return immediately with task ID). Set to true to avoid blocking Claude Code. Use codex_local_status and codex_local_results to check progress.',
                    },
                },
                required: ['task'],
            },
        };
    }
}
//# sourceMappingURL=cli_run.js.map