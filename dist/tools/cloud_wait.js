/**
 * Cloud Wait Tool - Server-side polling for cloud tasks
 *
 * Waits for cloud task completion with automatic progress updates.
 * Uses Codex CLI to check status periodically.
 */
import { spawn } from 'child_process';
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
    const jitter = ms * 0.2;
    return ms + (Math.random() * 2 - 1) * jitter;
}
/**
 * Check cloud task status via CLI
 */
async function checkCloudStatus(taskId) {
    return new Promise((resolve, reject) => {
        const proc = spawn('codex', ['cloud', 'status', taskId], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`codex cloud status failed: ${stderr}`));
                return;
            }
            try {
                // Parse output to determine status
                // This is a simplified version - actual implementation would parse CLI output
                if (stdout.includes('completed') || stdout.includes('succeeded')) {
                    resolve({ status: 'completed', details: stdout });
                }
                else if (stdout.includes('failed') || stdout.includes('error')) {
                    resolve({ status: 'failed', details: stdout });
                }
                else if (stdout.includes('canceled') || stdout.includes('cancelled')) {
                    resolve({ status: 'canceled', details: stdout });
                }
                else {
                    resolve({ status: 'working', details: stdout });
                }
            }
            catch (error) {
                reject(error);
            }
        });
    });
}
/**
 * Cloud wait tool handler
 */
export async function handleCloudWait(params) {
    const { task_id, timeout_sec = 300, poll_interval_sec = 10 } = params;
    const startTime = Date.now();
    const timeoutMs = timeout_sec * 1000;
    const maxWaitTime = Math.min(timeoutMs, 1800_000); // Cap at 30 minutes for cloud
    // Cloud tasks typically take longer - use longer backoff
    const backoffSchedule = [10000, 15000, 30000, 60000]; // 10s → 15s → 30s → 60s
    let backoffIndex = 0;
    // Override first interval if specified
    if (poll_interval_sec) {
        backoffSchedule[0] = poll_interval_sec * 1000;
    }
    const webUiUrl = `https://chatgpt.com/codex/tasks/${task_id}`;
    try {
        // Get task from registry
        const task = globalTaskRegistry.getTask(task_id);
        if (!task) {
            return {
                success: false,
                task_id,
                status: 'unknown',
                message: `Task ${task_id} not found in registry`,
                error: 'Task not found',
                elapsed_ms: 0,
                timed_out: false,
                web_ui_url: webUiUrl,
            };
        }
        // Check if task is cloud
        if (task.origin !== 'cloud') {
            return {
                success: false,
                task_id,
                status: task.status,
                message: `Task ${task_id} is a local task. Use _codex_local_wait instead.`,
                error: 'Wrong wait tool for local task',
                elapsed_ms: 0,
                timed_out: false,
                web_ui_url: webUiUrl,
            };
        }
        // Check initial status
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
                web_ui_url: webUiUrl,
            };
        }
        // Poll with backoff
        while (Date.now() - startTime < maxWaitTime) {
            // Wait with jitter
            const currentInterval = backoffSchedule[Math.min(backoffIndex, backoffSchedule.length - 1)];
            const waitTime = addJitter(currentInterval);
            await sleep(waitTime);
            // Check status via CLI
            try {
                const cloudStatus = await checkCloudStatus(task_id);
                // Update registry with latest status
                if (cloudStatus.status === 'completed') {
                    globalTaskRegistry.updateStatus(task_id, 'completed');
                }
                else if (cloudStatus.status === 'failed') {
                    globalTaskRegistry.updateStatus(task_id, 'failed');
                }
                else if (cloudStatus.status === 'canceled') {
                    globalTaskRegistry.updateStatus(task_id, 'canceled');
                }
                // Check if completed
                if (cloudStatus.status === 'completed' ||
                    cloudStatus.status === 'failed' ||
                    cloudStatus.status === 'canceled') {
                    const updatedTask = globalTaskRegistry.getTask(task_id);
                    return {
                        success: true,
                        task_id,
                        status: cloudStatus.status,
                        progress: updatedTask?.progressSteps
                            ? JSON.parse(updatedTask.progressSteps)
                            : undefined,
                        result: cloudStatus.details,
                        message: `Task ${task_id} ${cloudStatus.status} after ${Math.round((Date.now() - startTime) / 1000)}s`,
                        elapsed_ms: Date.now() - startTime,
                        timed_out: false,
                        web_ui_url: webUiUrl,
                    };
                }
            }
            catch (error) {
                // Ignore individual check failures, continue polling
                console.error(`[CloudWait] Status check failed:`, error);
            }
            // Increase backoff index for next iteration
            backoffIndex++;
        }
        // Timeout reached
        const finalTask = globalTaskRegistry.getTask(task_id);
        return {
            success: false,
            task_id,
            status: finalTask?.status || 'working',
            progress: finalTask?.progressSteps ? JSON.parse(finalTask.progressSteps) : undefined,
            message: `Timeout after ${timeout_sec}s. Task still running. Check Web UI for updates.`,
            error: `Timeout reached after ${timeout_sec}s`,
            elapsed_ms: Date.now() - startTime,
            timed_out: true,
            web_ui_url: webUiUrl,
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
            web_ui_url: webUiUrl,
        };
    }
}
/**
 * MCP Tool Class
 */
export class CloudWaitTool {
    static getSchema() {
        return {
            name: '_codex_cloud_wait',
            description: 'Wait for cloud task completion with automatic progress updates - like watching a long-running build. Internally polls Codex Cloud status with intelligent backoff (10s → 15s → 30s → 60s) until completion or timeout. Use this for cloud tasks where you want continuous feedback without manual status checking. Cloud tasks often take 5-60 minutes, so this uses longer intervals than local wait. Returns: final state (completed/failed/canceled) or partial progress if timeout reached. Always includes Web UI link for detailed monitoring.',
            inputSchema: {
                type: 'object',
                properties: {
                    task_id: {
                        type: 'string',
                        description: 'The cloud task identifier to wait for (format: T-cloud-abc123).',
                    },
                    timeout_sec: {
                        type: 'number',
                        description: 'Max seconds to wait (default: 300, i.e., 5 minutes). Server caps this at 30 minutes for cloud tasks.',
                    },
                    poll_interval_sec: {
                        type: 'number',
                        description: 'Initial polling interval in seconds (default: 10). Server adjusts with backoff for efficiency.',
                    },
                },
                required: ['task_id'],
            },
        };
    }
    async execute(params) {
        // Add hard timeout wrapper (v3.2.1) - ensures wait can't hang indefinitely
        const maxExecutionTime = 31 * 60 * 1000; // 31 minutes (slightly longer than max wait)
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
                    web_ui_url: `https://chatgpt.com/codex/tasks/${params.task_id}`,
                });
            }, maxExecutionTime);
        });
        // Race between actual wait and hard timeout
        const result = await Promise.race([handleCloudWait(params), timeoutPromise]);
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
        displayText += `\n\n🔗 **Web UI**: ${result.web_ui_url}`;
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
//# sourceMappingURL=cloud_wait.js.map