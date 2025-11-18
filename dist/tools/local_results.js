/**
 * Local Results Tool - Get Async Task Results
 *
 * Retrieve results from completed async local Codex tasks.
 */
import { globalTaskRegistry } from '../state/task_registry.js';
import { globalRedactor } from '../security/redactor.js';
import { extractMetadata } from '../utils/metadata_extractor.js';
export class LocalResultsTool {
    async execute(input) {
        const task = globalTaskRegistry.getTask(input.task_id);
        if (!task) {
            if (input.format === 'json') {
                const json = {
                    version: '3.6',
                    schema_id: 'codex/v3.6/result_set/v1',
                    tool: '_codex_local_results',
                    tool_category: 'result_set',
                    request_id: (await import('crypto')).randomUUID(),
                    ts: new Date().toISOString(),
                    status: 'error',
                    meta: {},
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Task not found in registry',
                        details: { task_id: input.task_id },
                        retryable: false,
                    },
                };
                return { content: [{ type: 'text', text: JSON.stringify(json) }], isError: true };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Task Not Found\n\n**Task ID**: \`${input.task_id}\`\n\nTask not found in registry.`,
                    },
                ],
                isError: true,
            };
        }
        // Check if still running
        if (task.status === 'working') {
            if (input.format === 'json') {
                const json = {
                    version: '3.6',
                    schema_id: 'codex/v3.6/result_set/v1',
                    tool: '_codex_local_results',
                    tool_category: 'result_set',
                    request_id: (await import('crypto')).randomUUID(),
                    ts: new Date().toISOString(),
                    status: 'error',
                    meta: {},
                    error: {
                        code: 'VALIDATION',
                        message: 'Task still running',
                        details: { task_id: input.task_id, status: task.status },
                        retryable: true,
                    },
                };
                return { content: [{ type: 'text', text: JSON.stringify(json) }] };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `⏳ Task Still Running\n\n**Task ID**: \`${input.task_id}\`\n\n**Task**: ${task.instruction}\n\n**Started**: ${new Date(task.createdAt).toLocaleString()}\n\n💡 Check back later with \`_codex_local_status\` or wait for completion.`,
                    },
                ],
            };
        }
        // Check if failed
        if (task.status === 'failed') {
            if (input.format === 'json') {
                // Build minimal metadata from error
                const metadata = extractMetadata(task.error || '', 1, task.threadId, input.task_id);
                const includeOutput = true; // Always include on failure per spec
                const maxBytes = input.max_output_bytes || 65536;
                const resultData = task.result ? JSON.parse(task.result) : {};
                const stdout = resultData.stdout || resultData.finalOutput || '';
                const stderr = resultData.stderr || (task.error || '');
                const truncate = (s) => {
                    if (!s)
                        return { text: '', truncated: false, original: 0 };
                    const b = Buffer.from(s, 'utf-8');
                    if (b.length <= maxBytes)
                        return { text: s, truncated: false, original: b.length };
                    // first 16KB + last 16KB
                    const half = Math.floor(maxBytes / 2);
                    const first = b.subarray(0, half);
                    const last = b.subarray(b.length - half);
                    return { text: Buffer.concat([first, Buffer.from('\n... [truncated] ...\n'), last]).toString('utf-8'), truncated: true, original: b.length };
                };
                const tOut = truncate(stdout);
                const tErr = truncate(stderr);
                const json = {
                    version: '3.6',
                    schema_id: 'codex/v3.6/result_set/v1',
                    tool: '_codex_local_results',
                    tool_category: 'result_set',
                    request_id: (await import('crypto')).randomUUID(),
                    ts: new Date().toISOString(),
                    status: 'ok',
                    meta: { count: 1 },
                    data: {
                        task_id: input.task_id,
                        state: 'failed',
                        summary: `Task failed${task.error ? `: ${task.error}` : ''}`,
                        duration_seconds: task.completedAt && task.createdAt ? Math.max(0, Math.floor((task.completedAt - task.createdAt) / 1000)) : undefined,
                        completed_ts: task.completedAt ? new Date(task.completedAt).toISOString() : undefined,
                        metadata,
                        output: {
                            included: includeOutput,
                            stdout: tOut.text,
                            stderr: tErr.text,
                            truncated: tOut.truncated || tErr.truncated,
                            max_bytes: maxBytes,
                        },
                    },
                };
                if (tOut.truncated || tErr.truncated) {
                    json.data.output.original_size = (tOut.original || 0) + (tErr.original || 0);
                }
                if (json.data.duration_seconds === undefined)
                    delete json.data.duration_seconds;
                if (json.data.completed_ts === undefined)
                    delete json.data.completed_ts;
                return { content: [{ type: 'text', text: JSON.stringify(json) }] };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Task Failed\n\n**Task ID**: \`${input.task_id}\`\n\n**Error**: ${task.error || 'Unknown error'}\n\n**Task**: ${task.instruction}`,
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
                        text: `❌ No Results Available\n\n**Task ID**: \`${input.task_id}\`\n\nTask completed but results not available.`,
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
            if (input.format === 'json') {
                const json = {
                    version: '3.6',
                    schema_id: 'codex/v3.6/result_set/v1',
                    tool: '_codex_local_results',
                    tool_category: 'result_set',
                    request_id: (await import('crypto')).randomUUID(),
                    ts: new Date().toISOString(),
                    status: 'error',
                    meta: {},
                    error: {
                        code: 'INTERNAL',
                        message: 'Could not parse task result',
                        retryable: false,
                    },
                };
                return { content: [{ type: 'text', text: JSON.stringify(json) }] };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Invalid Result Format\n\n**Task ID**: \`${input.task_id}\`\n\nCould not parse task result.`,
                    },
                ],
                isError: true,
            };
        }
        // JSON: result_set
        if (input.format === 'json') {
            const success = resultData?.success === true || resultData?.exitCode === 0;
            const state = success ? 'completed' : 'failed';
            const rawOut = (resultData.finalOutput || resultData.stdout || '');
            const rawErr = (resultData.stderr || '');
            const stdout = globalRedactor.redact(rawOut || '');
            const stderr = globalRedactor.redact(rawErr || '');
            const includeOutput = state === 'failed' || input.include_output === true;
            const maxBytes = input.max_output_bytes || 65536;
            const truncate = (s) => {
                if (!s)
                    return { text: '', truncated: false, original: 0 };
                const b = Buffer.from(s, 'utf-8');
                if (b.length <= maxBytes)
                    return { text: s, truncated: false, original: b.length };
                const half = Math.floor(maxBytes / 2);
                const first = b.subarray(0, half);
                const last = b.subarray(b.length - half);
                return { text: Buffer.concat([first, Buffer.from('\n... [truncated] ...\n'), last]).toString('utf-8'), truncated: true, original: b.length };
            };
            const tOut = truncate(stdout);
            const tErr = truncate(stderr);
            const metadata = extractMetadata(stdout + (stderr ? `\n${stderr}` : ''), resultData.exitCode ?? (success ? 0 : 1), task.threadId, input.task_id);
            const json = {
                version: '3.6',
                schema_id: 'codex/v3.6/result_set/v1',
                tool: '_codex_local_results',
                tool_category: 'result_set',
                request_id: (await import('crypto')).randomUUID(),
                ts: new Date().toISOString(),
                status: 'ok',
                meta: { count: 1 },
                data: {
                    task_id: input.task_id,
                    state,
                    summary: success ? 'Task completed successfully' : `Task failed${task.error ? `: ${task.error}` : ''}`,
                    duration_seconds: task.completedAt && task.createdAt ? Math.max(0, Math.floor((task.completedAt - task.createdAt) / 1000)) : undefined,
                    completed_ts: task.completedAt ? new Date(task.completedAt).toISOString() : undefined,
                    metadata,
                },
            };
            if (includeOutput) {
                json.data.output = {
                    included: true,
                    stdout: tOut.text,
                    stderr: tErr.text,
                    truncated: tOut.truncated || tErr.truncated,
                    max_bytes: maxBytes,
                };
                if (tOut.truncated || tErr.truncated) {
                    json.data.output.original_size = (tOut.original || 0) + (tErr.original || 0);
                }
            }
            else {
                json.data.output = {
                    included: false,
                    reason: 'Output excluded by default (use include_output=true)',
                    truncated: false,
                    max_bytes: 0,
                };
            }
            if (json.data.duration_seconds === undefined)
                delete json.data.duration_seconds;
            if (json.data.completed_ts === undefined)
                delete json.data.completed_ts;
            return { content: [{ type: 'text', text: JSON.stringify(json) }] };
        }
        // Build result message for SDK execution
        let message = `✅ Codex SDK Task Completed\n\n`;
        message += `**Task ID**: \`${input.task_id}\`\n\n`;
        message += `**Task**: ${task.instruction}\n\n`;
        if (resultData.threadId) {
            message += `**Thread ID**: \`${resultData.threadId}\`\n\n`;
            message += `💡 Use \`_codex_local_resume\` with this thread ID to continue work.\n\n`;
        }
        message += `**Status**: ${resultData.success ? '✅ Success' : '❌ Failed'}\n\n`;
        message += `**Events Captured**: ${resultData.eventCount || 0}\n\n`;
        // Include git verification results if available
        if (resultData.verificationOutput) {
            message += `${resultData.verificationOutput}\n\n`;
        }
        else if (resultData.gitVerification) {
            // Fallback to raw git verification data if formatted output not available
            const gitV = resultData.gitVerification;
            if (gitV.errors && gitV.errors.length > 0) {
                message += `**Git Verification Errors**:\n`;
                gitV.errors.forEach((err) => {
                    message += `- ❌ ${err}\n`;
                });
                message += `\n`;
            }
            if (gitV.warnings && gitV.warnings.length > 0) {
                message += `**Git Verification Warnings**:\n`;
                gitV.warnings.forEach((warn) => {
                    message += `- ⚠️ ${warn}\n`;
                });
                message += `\n`;
            }
            if (gitV.recommendations && gitV.recommendations.length > 0) {
                message += `**Recommended Actions**:\n`;
                gitV.recommendations.forEach((rec, i) => {
                    message += `${i + 1}. ${rec}\n`;
                });
                message += `\n`;
            }
        }
        // Include Codex output (Issue 3.1 fix: Increased limit + smart truncation)
        if (resultData.finalOutput) {
            const output = globalRedactor.redact(resultData.finalOutput);
            const maxLength = 50000; // Increased from 10KB to 50KB
            const wasTruncated = output.length > maxLength;
            let displayOutput;
            if (wasTruncated) {
                // Smart truncation: Show first 40KB and last 5KB with separator
                const firstPortion = output.substring(0, 40000);
                const lastPortion = output.substring(output.length - 5000);
                const truncatedChars = output.length - 45000;
                const truncatedLines = output.substring(40000, output.length - 5000).split('\n').length;
                displayOutput = `${firstPortion}\n\n... [Truncated ${truncatedChars.toLocaleString()} characters (~${truncatedLines} lines)] ...\n\n${lastPortion}`;
            }
            else {
                displayOutput = output;
            }
            message += `**Codex Output**:\n\`\`\`\n${displayOutput}\n\`\`\`\n`;
            if (wasTruncated) {
                message += `\n*Output size: ${output.length.toLocaleString()} chars (showing first 40KB + last 5KB)*\n`;
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
                    task_id: {
                        type: 'string',
                        description: 'Task ID from codex_run async execution',
                    },
                },
                required: ['task_id'],
            },
        };
    }
}
//# sourceMappingURL=local_results.js.map