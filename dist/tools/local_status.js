/**
 * Local Status Tool - Check Async Task Status
 *
 * Check status of async local Codex tasks (CLI/SDK).
 * Shows running and recently completed tasks.
 */
import { localTaskRegistry } from '../state/local_task_registry.js';
export class LocalStatusTool {
    async execute(input = {}) {
        // Specific task status
        if (input.taskId) {
            const task = localTaskRegistry.getTask(input.taskId);
            if (!task) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `❌ Task Not Found\n\n**Task ID**: \`${input.taskId}\`\n\nTask not found in registry. It may have been cleared or never existed.`,
                        },
                    ],
                };
            }
            let message = `## Task Status: \`${task.taskId}\`\n\n`;
            message += `**Task**: ${task.task}\n\n`;
            message += `**Status**: ${task.status === 'running' ? '🔄 Running' : task.status === 'completed' ? '✅ Completed' : '❌ Failed'}\n\n`;
            message += `**Mode**: ${task.mode || 'read-only'}\n\n`;
            message += `**Started**: ${new Date(task.submittedAt).toLocaleString()}\n\n`;
            if (task.status === 'running') {
                message += `💡 Task is still running. Check back later with \`codex_local_status\` or retrieve results when complete with \`codex_local_results\`.`;
            }
            else if (task.status === 'completed') {
                message += `✅ Task completed successfully. Use \`codex_local_results\` with task ID to get full output.`;
            }
            else if (task.status === 'failed') {
                message += `❌ Task failed. Error: ${task.error || 'Unknown error'}`;
            }
            return {
                content: [{ type: 'text', text: message }],
            };
        }
        // Show all tasks or just running
        const workingDir = process.cwd();
        const runningTasks = localTaskRegistry.getRunningTasks(workingDir);
        const allTasks = input.showAll ? localTaskRegistry.getAllTasks(workingDir) : runningTasks;
        if (allTasks.length === 0) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `📋 No ${input.showAll ? '' : 'running '}async local tasks found in current directory.\n\n**Working Dir**: ${workingDir}`,
                    },
                ],
            };
        }
        let message = `## Async Local Tasks\n\n`;
        message += `**Working Dir**: ${workingDir}\n\n`;
        message += `**Running**: ${runningTasks.length}\n`;
        message += `**Total**: ${allTasks.length}\n\n`;
        message += `### Tasks:\n\n`;
        for (const task of allTasks) {
            const status = task.status === 'running' ? '🔄 Running' : task.status === 'completed' ? '✅ Done' : '❌ Failed';
            const elapsed = this.getElapsedTime(task.submittedAt);
            message += `- **${task.taskId}**: ${status} (${elapsed})\n`;
            message += `  Task: ${task.task.substring(0, 80)}${task.task.length > 80 ? '...' : ''}\n\n`;
        }
        message += `\n💡 Use \`codex_local_status\` with \`taskId\` for details, or \`codex_local_results\` to get completed task output.`;
        return {
            content: [{ type: 'text', text: message }],
        };
    }
    getElapsedTime(submittedAt) {
        const elapsed = Date.now() - new Date(submittedAt).getTime();
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0)
            return `${hours}h ${minutes % 60}m ago`;
        if (minutes > 0)
            return `${minutes}m ${seconds % 60}s ago`;
        return `${seconds}s ago`;
    }
    static getSchema() {
        return {
            name: 'codex_local_status',
            description: 'Check status of async local Codex tasks. Shows running and recently completed tasks in current directory.',
            inputSchema: {
                type: 'object',
                properties: {
                    taskId: {
                        type: 'string',
                        description: 'Optional: Check status of specific task by ID',
                    },
                    showAll: {
                        type: 'boolean',
                        default: false,
                        description: 'Show all tasks including completed (default: running only)',
                    },
                },
            },
        };
    }
}
//# sourceMappingURL=local_status.js.map