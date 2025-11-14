/**
 * Local Results Tool - Get Async Task Results
 *
 * Retrieve results from completed async local Codex tasks.
 */
import { globalTaskRegistry } from '../state/task_registry.js';
import { globalRedactor } from '../security/redactor.js';
export class LocalResultsTool {
    async execute(input) {
        const task = globalTaskRegistry.getTask(input.taskId);
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
        if (task.status === 'working') {
            return {
                content: [
                    {
                        type: 'text',
                        text: `⏳ Task Still Running\n\n**Task ID**: \`${input.taskId}\`\n\n**Task**: ${task.instruction}\n\n**Started**: ${new Date(task.createdAt).toLocaleString()}\n\n💡 Check back later with \`_codex_local_status\` or wait for completion.`,
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
                        text: `❌ Task Failed\n\n**Task ID**: \`${input.taskId}\`\n\n**Error**: ${task.error || 'Unknown error'}\n\n**Task**: ${task.instruction}`,
                    },
                ],
                isError: true,
            };
        }
        // Task completed - return results
        const resultStr = task.result;
        if (!resultStr) {
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
        // Parse result JSON from SQLite registry
        let resultData;
        try {
            resultData = JSON.parse(resultStr);
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Invalid Result Format\n\n**Task ID**: \`${input.taskId}\`\n\nCould not parse task result.`,
                    },
                ],
                isError: true,
            };
        }
        // Build result message for SDK execution
        let message = `✅ Codex SDK Task Completed\n\n`;
        message += `**Task ID**: \`${input.taskId}\`\n\n`;
        message += `**Task**: ${task.instruction}\n\n`;
        if (resultData.threadId) {
            message += `**Thread ID**: \`${resultData.threadId}\`\n\n`;
            message += `💡 Use \`_codex_local_resume\` with this thread ID to continue work.\n\n`;
        }
        message += `**Status**: ${resultData.success ? '✅ Success' : '❌ Failed'}\n\n`;
        message += `**Events Captured**: ${resultData.eventCount || 0}\n\n`;
        // Include Codex output
        if (resultData.finalOutput) {
            const output = globalRedactor.redact(resultData.finalOutput);
            const maxLength = 10000;
            const truncated = output.substring(0, maxLength);
            const wasTruncated = output.length > maxLength;
            message += `**Codex Output**:\n\`\`\`\n${truncated}\n\`\`\`\n`;
            if (wasTruncated) {
                message += `\n*(Output truncated - showing first ${maxLength} characters)*\n`;
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
    static getSchema() {
        return {
            name: '_codex_local_results',
            description: 'Retrieve finished async task results - like checking your completed downloads. When you run a local task asynchronously (rare, as most local tasks are synchronous), use this to fetch the final output. Think of it as collecting your package from the post office after getting the "ready for pickup" notification. Use this when: you have a task ID from an async local execution and want the full results. Returns: complete output, analysis, and any generated artifacts. Perfect for: background local tasks that finished while you were doing other work. Avoid for: checking status of running tasks (use _codex_local_status), or most local tasks (which return results immediately).',
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