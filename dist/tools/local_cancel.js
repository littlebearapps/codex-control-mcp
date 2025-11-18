/**
 * Local Cancel Tool - Terminate running local tasks
 *
 * Stops a running local task by sending termination signal and updating status.
 */
import { globalTaskRegistry } from '../state/task_registry.js';
/**
 * Local cancel tool handler
 */
export async function handleLocalCancel(params) {
    const { task_id, reason } = params;
    try {
        // Get task from registry
        const task = globalTaskRegistry.getTask(task_id);
        if (!task) {
            return {
                success: false,
                task_id,
                status: 'unknown',
                message: `Task ${task_id} not found`,
                error: 'Task not found in registry',
            };
        }
        // Check if task is already completed
        if (task.status === 'completed' || task.status === 'failed' || task.status === 'canceled') {
            return {
                success: false,
                task_id,
                status: task.status,
                message: `Task ${task_id} already ${task.status}. Cannot cancel.`,
                error: `Task already in terminal state: ${task.status}`,
            };
        }
        // Check if task is local (not cloud)
        if (task.origin !== 'local') {
            return {
                success: false,
                task_id,
                status: task.status,
                message: `Task ${task_id} is a cloud task. Use _codex_cloud_cancel instead.`,
                error: 'Wrong cancellation tool for cloud task',
            };
        }
        // Attempt to kill the process if we have an external ID (PID)
        let processKilled = false;
        if (task.externalId) {
            try {
                // The external ID for local tasks is typically the process ID
                const pid = parseInt(task.externalId, 10);
                if (!isNaN(pid)) {
                    // Try to kill the process
                    process.kill(pid, 'SIGTERM');
                    processKilled = true;
                    // Wait a bit for graceful shutdown
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    // Force kill if still running
                    try {
                        process.kill(pid, 'SIGKILL');
                    }
                    catch (e) {
                        // Process already dead, ignore
                    }
                }
            }
            catch (error) {
                // Process might already be dead or not accessible
                console.error(`[LocalCancel] Failed to kill process ${task.externalId}:`, error);
            }
        }
        // Update task status to canceled
        const updatedTask = globalTaskRegistry.updateStatus(task_id, 'canceled');
        if (!updatedTask) {
            return {
                success: false,
                task_id,
                status: 'unknown',
                message: `Failed to update task ${task_id} status`,
                error: 'Status update failed',
            };
        }
        // Also add the cancellation reason to metadata if provided
        if (reason) {
            globalTaskRegistry.updateTask(task_id, {
                metadata: JSON.stringify({ cancelReason: reason }),
            });
        }
        return {
            success: true,
            task_id,
            status: 'canceled',
            message: `Task ${task_id} canceled successfully${processKilled ? ' (process terminated)' : ''}`,
            reason,
        };
    }
    catch (error) {
        return {
            success: false,
            task_id,
            status: 'unknown',
            message: error instanceof Error ? error.message : String(error),
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
/**
 * MCP Tool Class
 */
export class LocalCancelTool {
    static getSchema() {
        return {
            name: '_codex_local_cancel',
            description: 'Stop a running local task - like hitting Ctrl+C. Sends termination signal (SIGTERM, then SIGKILL) to the Codex process and updates task status to "canceled". Use when a task is stuck, taking too long, or no longer needed. Works for tasks in "pending" or "working" state. Returns confirmation of cancellation. Note: May not work if task is in critical section or already completing.',
            inputSchema: {
                type: 'object',
                properties: {
                    task_id: {
                        type: 'string',
                        description: 'The local task to cancel (format: T-local-abc123).',
                    },
                    reason: {
                        type: 'string',
                        description: 'Optional: Why canceling (e.g., "User aborted", "Stuck on step 3"). Helps with debugging.',
                    },
                    format: {
                        type: 'string',
                        enum: ['json', 'markdown'],
                        default: 'markdown',
                        description: 'Response format. Default markdown for backward compatibility.',
                    },
                },
                required: ['task_id'],
            },
        };
    }
    async execute(params) {
        const result = await handleLocalCancel(params);
        if (params?.format === 'json') {
            const json = {
                version: '3.6',
                schema_id: 'codex/v3.6/registry_info/v1',
                tool: '_codex_local_cancel',
                tool_category: 'registry_info',
                request_id: (await import('crypto')).randomUUID(),
                ts: new Date().toISOString(),
                status: result.success ? 'ok' : 'error',
                meta: { ack_ts: new Date().toISOString() },
                ...(result.success
                    ? { data: { operation: 'cancel', task_id: result.task_id, state: result.status } }
                    : { error: { code: 'TOOL_ERROR', message: result.error || result.message, retryable: false } }),
            };
            return { content: [{ type: 'text', text: JSON.stringify(json) }], isError: !result.success };
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    }
}
//# sourceMappingURL=local_cancel.js.map