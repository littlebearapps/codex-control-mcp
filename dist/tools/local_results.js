/**
 * Local Results Tool - Get Async Task Results
 *
 * Retrieve results from completed async local Codex tasks.
 */
import { localTaskRegistry } from '../state/local_task_registry.js';
import { ErrorMapper } from '../executor/error_mapper.js';
import { globalRedactor } from '../security/redactor.js';
export class LocalResultsTool {
    async execute(input) {
        const task = localTaskRegistry.getTask(input.taskId);
        if (!task) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Task Not Found\n\n**Task ID**: \`${input.taskId}\`\n\nTask not found in registry.`,
                    },
                ],
                isError: true,
            };
        }
        // Check if still running
        if (task.status === 'running') {
            return {
                content: [
                    {
                        type: 'text',
                        text: `⏳ Task Still Running\n\n**Task ID**: \`${input.taskId}\`\n\n**Task**: ${task.task}\n\n**Started**: ${new Date(task.submittedAt).toLocaleString()}\n\n💡 Check back later with \`codex_local_status\` or wait for completion.`,
                    },
                ],
            };
        }
        // Check if failed
        if (task.status === 'failed') {
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Task Failed\n\n**Task ID**: \`${input.taskId}\`\n\n**Error**: ${task.error || 'Unknown error'}\n\n**Task**: ${task.task}`,
                    },
                ],
                isError: true,
            };
        }
        // Task completed - return results
        const result = task.result;
        if (!result) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ No Results Available\n\n**Task ID**: \`${input.taskId}\`\n\nTask completed but results not available.`,
                    },
                ],
                isError: true,
            };
        }
        // Redact secrets from output
        const redactedOutput = globalRedactor.redactOutput({
            stdout: result.stdout,
            stderr: result.stderr,
        });
        // Extract meaningful information from events
        const summary = ErrorMapper.extractSummary(result.events);
        const fileChanges = ErrorMapper.extractFileChanges(result.events);
        const commands = ErrorMapper.extractCommands(result.events);
        // Build result message
        let message = `✅ Codex Task Completed\n\n`;
        message += `**Task ID**: \`${input.taskId}\`\n\n`;
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
    static getSchema() {
        return {
            name: 'codex_local_results',
            description: 'Get results from completed async local Codex task. Returns full output and analysis.',
            inputSchema: {
                type: 'object',
                properties: {
                    taskId: {
                        type: 'string',
                        description: 'Task ID from codex_run async execution',
                    },
                },
                required: ['taskId'],
            },
        };
    }
}
//# sourceMappingURL=local_results.js.map