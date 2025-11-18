/**
 * Cloud Wait Tool - Block until completion and return results summary
 */
import { globalTaskRegistry } from '../state/cloud_task_registry.js';
export class CloudWaitTool {
    static getSchema() {
        return {
            name: '_codex_cloud_wait',
            description: 'Wait for a cloud task to complete and return a structured summary. Use _codex_cloud_results to view details/PR links in Web UI.',
            inputSchema: {
                type: 'object',
                properties: {
                    task_id: { type: 'string', description: 'Cloud task ID (T-cloud-...)' },
                    timeout_sec: { type: 'number', description: 'Maximum seconds to wait (default 600)', default: 600 },
                    include_output: { type: 'boolean', description: 'No effect for cloud; logs not available via registry', default: false },
                    format: { type: 'string', enum: ['json', 'markdown'], default: 'markdown' },
                },
                required: ['task_id'],
            },
        };
    }
    isTerminal(status) {
        return status === 'completed' || status === 'failed' || status === 'cancelled';
    }
    async execute(input) {
        const preferred = input.format || 'markdown';
        const timeoutSec = typeof input.timeout_sec === 'number' ? input.timeout_sec : 600;
        const start = Date.now();
        let task = await globalTaskRegistry.getTask(input.task_id);
        if (!task) {
            if (preferred === 'json') {
                const json = {
                    version: '3.6',
                    schema_id: 'codex/v3.6/wait_result/v1',
                    tool: '_codex_cloud_wait',
                    tool_category: 'wait_result',
                    request_id: (await import('crypto')).randomUUID(),
                    ts: new Date().toISOString(),
                    status: 'error',
                    meta: {},
                    error: { code: 'NOT_FOUND', message: 'Task not found in cloud registry', details: { task_id: input.task_id }, retryable: false },
                };
                return { content: [{ type: 'text', text: JSON.stringify(json) }], isError: true };
            }
            return { content: [{ type: 'text', text: `❌ Task not found in cloud registry: ${input.task_id}` }], isError: true };
        }
        // Poll
        while (!this.isTerminal(task.status) && (Date.now() - start) / 1000 < timeoutSec) {
            await new Promise(r => setTimeout(r, 3000));
            task = (await globalTaskRegistry.getTask(input.task_id)) || task;
        }
        const timedOut = !this.isTerminal(task.status);
        const completedTs = new Date();
        if (preferred === 'json') {
            const state = timedOut ? 'timeout' : task.status;
            const json = {
                version: '3.6',
                schema_id: 'codex/v3.6/wait_result/v1',
                tool: '_codex_cloud_wait',
                tool_category: 'wait_result',
                request_id: (await import('crypto')).randomUUID(),
                ts: new Date().toISOString(),
                status: 'ok',
                meta: {
                    started_ts: task.timestamp,
                    completed_ts: completedTs.toISOString(),
                    duration_ms: Math.max(0, completedTs.getTime() - new Date(task.timestamp).getTime()),
                },
                data: {
                    task_id: input.task_id,
                    state,
                    summary: state === 'completed' ? 'Cloud task completed' : state === 'failed' ? 'Cloud task failed' : state === 'cancelled' ? 'Cloud task cancelled' : 'Cloud task wait timeout',
                    metadata: {
                        task_status: state,
                    },
                    output: {
                        included: false,
                        reason: 'Output/logs available via Web UI',
                        truncated: false,
                        max_bytes: 0,
                    },
                },
            };
            return { content: [{ type: 'text', text: JSON.stringify(json) }] };
        }
        if (timedOut) {
            return { content: [{ type: 'text', text: `⏱️ Timed out waiting for cloud task ${input.task_id} after ${timeoutSec}s.` }], isError: true };
        }
        const url = `https://chatgpt.com/codex/tasks/${input.task_id}`;
        return {
            content: [{ type: 'text', text: `✅ Cloud task ${input.task_id} ${task.status}. View results: ${url}` }],
        };
    }
}
//# sourceMappingURL=cloud_wait.js.map