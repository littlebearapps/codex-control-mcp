/**
 * Local Wait Tool - Server-side polling with intelligent backoff
 *
 * Waits for local task completion with automatic progress updates.
 * Reduces tool call spam by handling polling internally.
 */
import { globalTaskRegistry } from '../state/task_registry.js';
/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Add jitter to polling interval (±20%)
 */
function addJitter(ms) {
    const jitter = ms * 0.2; // 20% jitter
    return ms + (Math.random() * 2 - 1) * jitter;
}
/**
 * Local wait tool handler
 */
export async function handleLocalWait(params) {
    const { task_id, timeout_sec = 300, poll_interval_sec = 5 } = params;
    const startTime = Date.now();
    const timeoutMs = timeout_sec * 1000;
    const maxWaitTime = Math.min(timeoutMs, 600_000); // Cap at 10 minutes
    // Backoff strategy: 2s → 5s → 10s → cap at 15s
    const backoffSchedule = [2000, 5000, 10000, 15000]; // Milliseconds
    let backoffIndex = 0;
    // Override first interval if specified
    if (poll_interval_sec) {
        backoffSchedule[0] = poll_interval_sec * 1000;
    }
    try {
        // Initial check
        const task = globalTaskRegistry.getTask(task_id);
        if (!task) {
            return {
                success: false,
                task_id,
                status: 'unknown',
                message: `Task ${task_id} not found`,
                error: 'Task not found in registry',
                elapsed_ms: 0,
                timed_out: false,
            };
        }
        // Check if already completed
        if (task.status === 'completed' || task.status === 'failed' || task.status === 'canceled') {
            return {
                success: true,
                task_id,
                status: task.status,
                progress: task.progressSteps ? JSON.parse(task.progressSteps) : undefined,
                result: task.result,
                error: task.error,
                message: `Task ${task_id} already ${task.status}`,
                elapsed_ms: Date.now() - startTime,
                timed_out: false,
            };
        }
        // Poll with backoff
        while (Date.now() - startTime < maxWaitTime) {
            // Wait with jitter
            const currentInterval = backoffSchedule[Math.min(backoffIndex, backoffSchedule.length - 1)];
            const waitTime = addJitter(currentInterval);
            await sleep(waitTime);
            // Check task status
            const updatedTask = globalTaskRegistry.getTask(task_id);
            if (!updatedTask) {
                return {
                    success: false,
                    task_id,
                    status: 'unknown',
                    message: `Task ${task_id} disappeared during polling`,
                    error: 'Task removed from registry',
                    elapsed_ms: Date.now() - startTime,
                    timed_out: false,
                };
            }
            // Check if completed
            if (updatedTask.status === 'completed' ||
                updatedTask.status === 'failed' ||
                updatedTask.status === 'canceled') {
                return {
                    success: true,
                    task_id,
                    status: updatedTask.status,
                    progress: updatedTask.progressSteps ? JSON.parse(updatedTask.progressSteps) : undefined,
                    result: updatedTask.result,
                    error: updatedTask.error,
                    message: `Task ${task_id} ${updatedTask.status} after ${Math.round((Date.now() - startTime) / 1000)}s`,
                    elapsed_ms: Date.now() - startTime,
                    timed_out: false,
                };
            }
            // Increase backoff index for next iteration
            backoffIndex++;
        }
        // Timeout reached - return partial progress
        const finalTask = globalTaskRegistry.getTask(task_id);
        return {
            success: false,
            task_id,
            status: finalTask?.status || 'unknown',
            progress: finalTask?.progressSteps ? JSON.parse(finalTask.progressSteps) : undefined,
            message: `Timeout after ${timeout_sec}s. Task still ${finalTask?.status || 'unknown'}.`,
            error: `Timeout reached after ${timeout_sec}s`,
            elapsed_ms: Date.now() - startTime,
            timed_out: true,
        };
    }
    catch (error) {
        return {
            success: false,
            task_id,
            status: 'unknown',
            message: error instanceof Error ? error.message : String(error),
            error: error instanceof Error ? error.message : String(error),
            elapsed_ms: Date.now() - startTime,
            timed_out: false,
        };
    }
}
/**
 * MCP Tool Class
 */
export class LocalWaitTool {
    static getSchema() {
        return {
            name: '_codex_local_wait',
            description: 'Wait for local task completion with automatic progress updates - like watching a progress bar. Internally polls the task status with intelligent backoff (2s → 5s → 10s → 15s) until completion or timeout. Use this for medium-duration tasks (30-120 seconds) where you want continuous feedback without manual status checking. Better than repeated _codex_local_status calls - reduces tool call spam and provides smoother UX. Returns: final state (completed/failed/canceled) or partial progress if timeout reached.',
            inputSchema: {
                type: 'object',
                properties: {
                    task_id: {
                        type: 'string',
                        description: 'The local task identifier to wait for (format: T-local-abc123).',
                    },
                    timeout_sec: {
                        type: 'number',
                        description: 'Max seconds to wait (default: 300, i.e., 5 minutes). Server caps this at 10 minutes.',
                    },
                    poll_interval_sec: {
                        type: 'number',
                        description: 'Initial polling interval in seconds (default: 2). Server adjusts with backoff.',
                    },
                },
                required: ['task_id'],
            },
        };
    }
    async execute(params) {
        // Add hard timeout wrapper (v3.2.1) - ensures wait can't hang indefinitely
        const maxExecutionTime = 11 * 60 * 1000; // 11 minutes (slightly longer than max wait)
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: false,
                    task_id: params.task_id,
                    status: 'unknown',
                    message: `Wait operation timed out after ${maxExecutionTime / 1000}s (hard limit)`,
                    error: 'Wait operation exceeded hard timeout',
                    elapsed_ms: maxExecutionTime,
                    timed_out: true,
                });
            }, maxExecutionTime);
        });
        // Race between actual wait and hard timeout
        const result = await Promise.race([handleLocalWait(params), timeoutPromise]);
        // Format progress info if available
        let displayText = `**Task ${result.task_id}** - ${result.status}\n\n`;
        if (result.progress) {
            const progress = typeof result.progress === 'string'
                ? JSON.parse(result.progress)
                : result.progress;
            displayText += `**Progress**: ${progress.progressPercentage || 0}% complete\n`;
            if (progress.currentAction) {
                displayText += `**Current**: ${progress.currentAction}\n`;
            }
            displayText += `**Completed**: ${progress.completedSteps}/${progress.totalSteps} steps\n`;
            if (progress.filesChanged > 0) {
                displayText += `**Files Changed**: ${progress.filesChanged}\n`;
            }
            if (progress.commandsExecuted > 0) {
                displayText += `**Commands Executed**: ${progress.commandsExecuted}\n`;
            }
            displayText += '\n';
        }
        displayText += result.message;
        if (result.elapsed_ms) {
            displayText += `\n\n⏱️ Elapsed: ${Math.round(result.elapsed_ms / 1000)}s`;
        }
        return {
            content: [
                {
                    type: 'text',
                    text: displayText,
                },
            ],
        };
    }
}
//# sourceMappingURL=local_wait.js.map