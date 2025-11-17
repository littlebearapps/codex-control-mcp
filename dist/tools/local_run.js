/**
 * Unified CLI Execution Tool
 *
 * Consolidates codex_cli_run, codex_cli_plan, and codex_cli_apply into one tool.
 * Supports all execution modes with safety gating for mutations.
 */
import { ErrorMapper } from '../executor/error_mapper.js';
import { InputValidator } from '../security/input_validator.js';
import { globalRedactor } from '../security/redactor.js';
import { globalTaskRegistry } from '../state/task_registry.js';
import { RiskyOperationDetector, GitOperationTier } from '../security/risky_operation_detector.js';
import { SafetyCheckpointing } from '../security/safety_checkpointing.js';
import { sendProgressNotification, createElapsedTimeNotification, createCompletionNotification, } from '../types/progress.js';
export class LocalRunTool {
    processManager;
    constructor(processManager) {
        this.processManager = processManager;
    }
    async execute(input, extra) {
        // Default to read-only mode
        const mode = input.mode || 'read-only';
        // GIT SAFETY CHECK: Detect and block risky git operations (RUNS FIRST)
        const detector = new RiskyOperationDetector();
        const riskyOps = detector.detect(input.task);
        let checkpointInfo = null; // Store checkpoint info for inclusion in output
        if (riskyOps.length > 0) {
            const highestTier = detector.getHighestRiskTier(input.task);
            // Tier 1: ALWAYS BLOCKED - No way to proceed
            if (highestTier === GitOperationTier.ALWAYS_BLOCKED) {
                const blockedOps = riskyOps.filter((op) => op.tier === GitOperationTier.ALWAYS_BLOCKED);
                const errorMessage = detector.formatBlockedMessage(blockedOps);
                return {
                    content: [
                        {
                            type: 'text',
                            text: errorMessage,
                        },
                    ],
                    isError: true,
                };
            }
            // Tier 2: REQUIRES CONFIRMATION - Check if user confirmed
            if (highestTier === GitOperationTier.REQUIRES_CONFIRMATION && !input.allow_destructive_git) {
                const riskyOpsToConfirm = riskyOps.filter((op) => op.tier === GitOperationTier.REQUIRES_CONFIRMATION);
                const confirmMessage = detector.formatConfirmationMessage(riskyOpsToConfirm);
                const confirmMetadata = detector.formatConfirmationMetadata(riskyOpsToConfirm);
                return {
                    content: [
                        {
                            type: 'text',
                            text: confirmMessage,
                        },
                    ],
                    isError: true,
                    metadata: confirmMetadata,
                };
            }
            // User confirmed risky operation - Create safety checkpoint
            if (input.allow_destructive_git) {
                console.error('[LocalRun] ⚠️  User confirmed risky operation, creating safety checkpoint...');
                const checkpointing = new SafetyCheckpointing();
                const workingDir = input.workingDir || process.cwd();
                const riskyOpsToCheckpoint = riskyOps.filter((op) => op.tier === GitOperationTier.REQUIRES_CONFIRMATION);
                // Create checkpoint for the first risky operation detected
                const operation = riskyOpsToCheckpoint[0].operation.replace(/\s+/g, '-').toLowerCase();
                const checkpoint = await checkpointing.createCheckpoint(operation, workingDir);
                checkpointInfo = checkpointing.formatRecoveryInstructions(checkpoint);
                console.error('[LocalRun] ✅ Safety checkpoint created:', checkpoint.safety_branch);
                console.error('[LocalRun] Recovery instructions will be included in output');
            }
        }
        // SAFETY GATE: Require confirmation for mutations
        const isMutationMode = mode === 'workspace-write' || mode === 'danger-full-access';
        if (isMutationMode && input.confirm !== true) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `⚠️ Confirmation Required\n\nThis operation will modify files in your project.\n\n**Task**: ${input.task}\n**Mode**: ${mode}\n\n**To proceed**, call this tool again with \`confirm: true\`.\n\n**Tip**: Use \`mode: "preview"\` first to see proposed changes.`,
                    },
                ],
                isError: true,
            };
        }
        // Handle preview mode (just adds context to task)
        const actualTask = mode === 'preview' ? `Preview/plan this task without executing: ${input.task}` : input.task;
        const actualMode = mode === 'preview' ? 'read-only' : mode;
        // Validate inputs
        const validation = InputValidator.validateAll({
            task: actualTask,
            mode: actualMode,
            model: input.model,
            outputSchema: input.outputSchema,
            workingDir: input.workingDir,
            confirm: input.confirm,
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
        // Generate task ID for progress tracking (used in both async and sync modes)
        const taskIdForProgress = `T-local-run-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const options = {
            task: actualTask,
            mode: actualMode,
            model: input.model,
            outputSchema: input.outputSchema,
            workingDir: input.workingDir,
            envPolicy: input.envPolicy,
            envAllowList: input.envAllowList,
            // MCP Progress Notifications (v3.5.0)
            onMcpProgress: async (elapsed) => {
                await sendProgressNotification(extra, createElapsedTimeNotification(taskIdForProgress, elapsed), `LocalRun:${taskIdForProgress}`);
            },
        };
        try {
            // ASYNC MODE: Return immediately with task ID
            if (input.async) {
                // Register task in unified SQLite registry BEFORE execution
                const registeredTask = globalTaskRegistry.registerTask({
                    origin: 'local',
                    instruction: input.task,
                    workingDir: input.workingDir || process.cwd(),
                    mode: actualMode,
                    model: input.model,
                });
                const taskId = registeredTask.id;
                // Update status to 'working'
                globalTaskRegistry.updateStatus(taskId, 'working');
                // Execute in background and update registry on completion
                (async () => {
                    try {
                        const result = await this.processManager.execute(options);
                        // Update registry with success
                        globalTaskRegistry.updateTask(taskId, {
                            status: 'completed',
                            result: JSON.stringify(result),
                        });
                    }
                    catch (error) {
                        // Update registry with failure
                        globalTaskRegistry.updateTask(taskId, {
                            status: 'failed',
                            error: error instanceof Error ? error.message : String(error),
                        });
                    }
                })();
                const modeLabel = mode === 'preview' ? 'preview (read-only)' : mode;
                return {
                    content: [
                        {
                            type: 'text',
                            text: `✅ Codex Task Started (Async)\n\n**Task ID**: \`${taskId}\`\n\n**Task**: ${input.task}\n\n**Mode**: ${modeLabel}\n\n**Status**: Running in background\n\n💡 **Check Progress**:\n- Use \`_codex_local_wait\` to wait for completion: \`{ "task_id": "${taskId}" }\`\n- Use \`_codex_local_status\` to check status\n- Use \`_codex_local_results\` with task ID to get results when complete\n- Use \`_codex_local_cancel\` to cancel: \`{ "task_id": "${taskId}" }\`\n\n**Note**: Task tracked in unified SQLite registry.`,
                        },
                    ],
                };
            }
            // SYNC MODE: Wait for completion
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
            // Extract information from events
            const summary = ErrorMapper.extractSummary(result.events);
            const fileChanges = ErrorMapper.extractFileChanges(result.events);
            const commands = ErrorMapper.extractCommands(result.events);
            // Build result message (format depends on mode)
            let message = '';
            if (mode === 'preview') {
                message = this.formatPreviewResult(input.task, summary, fileChanges, commands, result);
            }
            else {
                message = this.formatExecutionResult(mode, summary, fileChanges, commands, result);
            }
            // Prepend safety checkpoint info if it exists
            if (checkpointInfo) {
                message = `🛡️  **GIT SAFETY CHECKPOINT CREATED**\n\n${checkpointInfo}\n\n---\n\n` + message;
            }
            // Add redacted output
            if (redactedOutput.stdout.trim()) {
                const maxStdoutLength = 10000;
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
            // Send final completion notification (v3.5.0)
            await sendProgressNotification(extra, createCompletionNotification(taskIdForProgress, 'Codex execution complete'), `LocalRun:${taskIdForProgress}`);
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
    formatPreviewResult(originalTask, summary, fileChanges, commands, _result) {
        let message = `📋 Codex Task Plan (Preview)\n\n`;
        message += `**Original Task**: ${originalTask}\n\n`;
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
        message += `**Note**: This is a preview only. Use \`mode: "workspace-write"\` with \`confirm: true\` to execute.\n`;
        return message;
    }
    formatExecutionResult(mode, summary, fileChanges, commands, result) {
        let message = `✅ Codex Task Completed\n\n`;
        message += `**Mode**: ${mode}\n`;
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
        return message;
    }
    static getSchema() {
        return {
            name: '_codex_local_run',
            description: 'Simple one-shot Codex execution - like running a quick command. Use this for fast, self-contained tasks that don\'t need follow-up: code analysis, running tests (read-only), security audits, or simple fixes. Think of it as "fire and forget" - you get results immediately, but there\'s no conversation history preserved for later. Perfect for: "analyze this file for bugs", "check code quality", "run the test suite". Avoid for: iterative development (use _codex_local_exec instead), long-running tasks (use _codex_cloud_submit), or tasks needing follow-up questions.',
            inputSchema: {
                type: 'object',
                properties: {
                    task: {
                        type: 'string',
                        description: 'Task description for Codex (e.g., "analyze main.ts for bugs")',
                    },
                    mode: {
                        type: 'string',
                        enum: ['read-only', 'preview', 'workspace-write', 'danger-full-access'],
                        default: 'read-only',
                        description: 'Execution mode: read-only (safe analysis), preview (show proposed changes), workspace-write (modify files with confirm), danger-full-access (unrestricted with confirm)',
                    },
                    confirm: {
                        type: 'boolean',
                        description: 'REQUIRED for workspace-write and danger-full-access modes. Set to true to confirm file modifications.',
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
                        description: 'List of environment variables to pass (only used with envPolicy=allow-list). Example: ["OPENAI_API_KEY", "DATABASE_URL"]',
                    },
                    async: {
                        type: 'boolean',
                        default: false,
                        description: 'Run task asynchronously (return immediately with task ID). Set to true to avoid blocking. Use codex_status and codex_local_results to monitor progress.',
                    },
                },
                required: ['task'],
            },
        };
    }
}
//# sourceMappingURL=local_run.js.map