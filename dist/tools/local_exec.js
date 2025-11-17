import { Codex } from '@openai/codex-sdk';
import { z } from 'zod';
import { globalTaskRegistry } from '../state/task_registry.js';
import { verifyGitOperations, formatGitVerification } from '../utils/git_verifier.js';
import { ProgressInferenceEngine } from '../executor/progress_inference.js';
import { RiskyOperationDetector, GitOperationTier } from '../security/risky_operation_detector.js';
import { SafetyCheckpointing } from '../security/safety_checkpointing.js';
import { sendProgressNotification, createStepProgressNotification, createCompletionNotification, } from '../types/progress.js';
const LocalExecInputSchema = z.object({
    task: z.string().describe('The task to execute locally'),
    workingDir: z.string().optional().describe('Working directory (defaults to current directory)'),
    mode: z.enum(['read-only', 'workspace-write', 'danger-full-access']).optional().default('read-only').describe('Execution mode: read-only (safe), workspace-write (can edit files), danger-full-access (unrestricted)'),
    outputSchema: z.any().optional().describe('Optional JSON Schema for structured output'),
    skipGitRepoCheck: z.boolean().optional().default(false).describe('Skip Git repository check (use with caution)'),
    model: z.string().optional().describe('Model to use (e.g., gpt-5-codex, gpt-5)'),
    allow_destructive_git: z.boolean().optional().default(false).describe('Allow risky git operations (rebase, reset --hard, force push, etc.). User must explicitly confirm via Claude Code dialog.'),
});
export class LocalExecTool {
    static getSchema() {
        return {
            name: '_codex_local_exec',
            description: `Advanced local execution with real-time progress - like having a conversation with Codex. Unlike the simple one-shot _codex_local_run, this gives you a thread ID that preserves context for follow-up questions. Think of it as opening a chat window vs sending a single message. Use this when: you want iterative development, need to ask follow-ups, or want to see live progress updates. The magic: 45-93% token cache rates on resumed threads = huge cost savings.

🔒 **SANDBOX MODES** (CRITICAL - Controls file system access):
• 'read-only' (DEFAULT): Analysis only, CANNOT create/modify files
• 'workspace-write': CAN create/modify files, initialize git repos, write code
• 'danger-full-access': Unrestricted access (use with extreme caution)

⚠️ **IMPORTANT**: If you need to CREATE FILES, WRITE CODE, or INITIALIZE GIT REPOSITORIES, you MUST use mode='workspace-write' or 'danger-full-access'. The default 'read-only' mode will FAIL for any write operations.

Returns: thread ID (use with _codex_local_resume), real-time events, final output, token usage. Perfect for: "analyze this, then if you find bugs, fix them" workflows. Avoid for: simple one-off tasks (use _codex_local_run), or tasks over 30 minutes (use _codex_cloud_submit).`,
            inputSchema: {
                type: 'object',
                properties: {
                    task: {
                        type: 'string',
                        description: 'The task to execute locally',
                    },
                    workingDir: {
                        type: 'string',
                        description: 'Working directory (defaults to current directory)',
                    },
                    mode: {
                        type: 'string',
                        enum: ['read-only', 'workspace-write', 'danger-full-access'],
                        description: 'Sandbox mode - controls file system access. read-only (DEFAULT - analysis only, CANNOT write files), workspace-write (CAN create/modify files, required for git init, file creation, code writing), danger-full-access (unrestricted access). ⚠️ Use workspace-write when creating files or repos!',
                        default: 'read-only',
                    },
                    outputSchema: {
                        type: 'object',
                        description: 'Optional JSON Schema for structured output',
                    },
                    skipGitRepoCheck: {
                        type: 'boolean',
                        description: 'Skip Git repository check (use with caution)',
                        default: false,
                    },
                    model: {
                        type: 'string',
                        description: 'Model to use (e.g., gpt-5-codex, gpt-5)',
                    },
                    allow_destructive_git: {
                        type: 'boolean',
                        description: 'Allow risky git operations (rebase, reset --hard, force push, etc.). User must explicitly confirm via Claude Code dialog.',
                        default: false,
                    },
                },
                required: ['task'],
            },
        };
    }
    async execute(input, extra) {
        try {
            console.error('[LocalExec] Starting execution with:', JSON.stringify(input, null, 2));
            let checkpointInfo = null; // Store checkpoint info for inclusion in output
            // TEST MODE: Return immediately to verify MCP response works
            if (process.env.LOCAL_EXEC_TEST_MODE === 'true') {
                console.error('[LocalExec] TEST MODE: Returning immediate test response');
                return {
                    content: [
                        {
                            type: 'text',
                            text: '🧪 TEST MODE: This is a test response from codex_local_exec. If you see this, MCP response mechanism works!',
                        },
                    ],
                };
            }
            // Validate input
            const validated = LocalExecInputSchema.parse(input);
            console.error('[LocalExec] Input validated:', validated);
            // GIT SAFETY CHECK: Detect and block risky git operations
            const detector = new RiskyOperationDetector();
            const riskyOps = detector.detect(validated.task);
            if (riskyOps.length > 0) {
                const highestTier = detector.getHighestRiskTier(validated.task);
                // Tier 1: ALWAYS BLOCKED - No way to proceed
                if (highestTier === GitOperationTier.ALWAYS_BLOCKED) {
                    const blockedOps = riskyOps.filter(op => op.tier === GitOperationTier.ALWAYS_BLOCKED);
                    const errorMessage = detector.formatBlockedMessage(blockedOps);
                    console.error('[LocalExec] ❌ BLOCKED - Destructive git operation detected');
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
                if (highestTier === GitOperationTier.REQUIRES_CONFIRMATION && !validated.allow_destructive_git) {
                    const riskyOpsToConfirm = riskyOps.filter(op => op.tier === GitOperationTier.REQUIRES_CONFIRMATION);
                    const confirmMessage = detector.formatConfirmationMessage(riskyOpsToConfirm);
                    const confirmMetadata = detector.formatConfirmationMetadata(riskyOpsToConfirm);
                    console.error('[LocalExec] ⚠️ RISKY operation detected, user confirmation required');
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
                if (validated.allow_destructive_git) {
                    console.error('[LocalExec] ⚠️  User confirmed risky operation, creating safety checkpoint...');
                    const checkpointing = new SafetyCheckpointing();
                    const workingDir = validated.workingDir || process.cwd();
                    const riskyOpsToCheckpoint = riskyOps.filter(op => op.tier === GitOperationTier.REQUIRES_CONFIRMATION);
                    // Create checkpoint for the first risky operation detected
                    const operation = riskyOpsToCheckpoint[0].operation.replace(/\s+/g, '-').toLowerCase();
                    const checkpoint = await checkpointing.createCheckpoint(operation, workingDir);
                    checkpointInfo = checkpointing.formatRecoveryInstructions(checkpoint);
                    console.error('[LocalExec] ✅ Safety checkpoint created:', checkpoint.safety_branch);
                    console.error('[LocalExec] Recovery instructions will be included in output');
                }
            }
            // Initialize Codex SDK
            console.error('[LocalExec] Initializing Codex SDK...');
            const codex = new Codex();
            // Start thread with configuration
            const threadOptions = {
                skipGitRepoCheck: validated.skipGitRepoCheck,
                sandboxMode: validated.mode, // ✅ FIX: Pass sandbox mode in ThreadOptions
                approvalPolicy: 'never', // ✅ FIX: Enable automatic execution without prompts
            };
            if (validated.workingDir) {
                threadOptions.workingDirectory = validated.workingDir;
            }
            if (validated.model) {
                threadOptions.model = validated.model;
            }
            console.error('[LocalExec] Starting thread with options:', threadOptions);
            const thread = codex.startThread(threadOptions);
            console.error('[LocalExec] Thread started with ID:', thread.id);
            // Prepare run options (TurnOptions only has outputSchema)
            const runOptions = {};
            if (validated.outputSchema) {
                runOptions.outputSchema = validated.outputSchema;
            }
            console.error('[LocalExec] Running task with options:', runOptions);
            console.error('[LocalExec] *** STARTING ASYNC EXECUTION (NON-BLOCKING) ***');
            // Register task in unified SQLite registry BEFORE execution
            const registeredTask = globalTaskRegistry.registerTask({
                origin: 'local',
                instruction: validated.task,
                workingDir: validated.workingDir || process.cwd(),
                mode: validated.mode,
                model: validated.model,
                threadId: thread.id || undefined, // Will be updated once available
            });
            const taskId = registeredTask.id;
            console.error('[LocalExec] Registered task in SQLite registry:', taskId);
            // Update status to 'working' immediately
            globalTaskRegistry.updateStatus(taskId, 'working');
            // Execute in background (fire and forget - updates registry on completion)
            (async () => {
                // Setup timeout detection (v3.2.1)
                const idleTimeoutMs = 5 * 60 * 1000; // 5 minutes of no events
                const hardTimeoutMs = 20 * 60 * 1000; // 20 minutes total execution time
                let lastEventTime = Date.now();
                let timedOut = false;
                // Hard timeout watchdog
                const hardTimeoutTimer = setTimeout(() => {
                    if (!timedOut) {
                        timedOut = true;
                        console.error(`[LocalExec:${taskId}] ⏱️ HARD TIMEOUT after ${hardTimeoutMs / 1000}s`);
                        globalTaskRegistry.updateTask(taskId, {
                            status: 'failed',
                            error: `Execution exceeded hard timeout (${hardTimeoutMs / 1000}s)`,
                        });
                    }
                }, hardTimeoutMs);
                // Idle timeout check (runs every 30s)
                const idleCheckInterval = setInterval(() => {
                    const idleTime = Date.now() - lastEventTime;
                    if (idleTime > idleTimeoutMs && !timedOut) {
                        timedOut = true;
                        console.error(`[LocalExec:${taskId}] ⏱️ IDLE TIMEOUT after ${idleTimeoutMs / 1000}s of inactivity`);
                        clearTimeout(hardTimeoutTimer);
                        clearInterval(idleCheckInterval);
                        globalTaskRegistry.updateTask(taskId, {
                            status: 'failed',
                            error: `No events received for ${idleTimeoutMs / 1000}s (idle timeout)`,
                        });
                    }
                }, 30000); // Check every 30 seconds
                try {
                    const { events } = await thread.runStreamed(validated.task, runOptions);
                    let threadId = '';
                    let eventCount = 0;
                    const eventLog = [];
                    let finalOutput = '';
                    // Initialize progress tracking
                    const progressEngine = new ProgressInferenceEngine();
                    console.error(`[LocalExec:${taskId}] Background execution started`);
                    for await (const event of events) {
                        // Update last event time (reset idle timeout)
                        lastEventTime = Date.now();
                        // Stop if timed out
                        if (timedOut) {
                            console.error(`[LocalExec:${taskId}] Stopping iteration - timed out`);
                            break;
                        }
                        eventCount++;
                        eventLog.push(event);
                        // Capture thread ID when it becomes available
                        if (!threadId && thread.id) {
                            threadId = thread.id;
                            console.error(`[LocalExec:${taskId}] Thread ID: ${threadId}`);
                        }
                        console.error(`[LocalExec:${taskId}] Event ${eventCount}:`, event.type);
                        // Capture final output from various event types
                        if (event.type === 'item.completed') {
                            const item = event.item;
                            // Capture command execution output (the actual work!)
                            if (item?.type === 'command_execution' && item.aggregated_output) {
                                finalOutput += item.aggregated_output + '\n';
                                console.error(`[LocalExec:${taskId}] Captured command output: ${item.aggregated_output.substring(0, 100)}...`);
                            }
                            // Capture Codex's reasoning/messages
                            else if (item?.type === 'agent_message' && item.text) {
                                finalOutput += item.text + '\n';
                                console.error(`[LocalExec:${taskId}] Captured agent message: ${item.text.substring(0, 100)}...`);
                            }
                        }
                        else if (event.type === 'turn.completed') {
                            // Keep for completion marker
                            console.error(`[LocalExec:${taskId}] Turn completed`);
                        }
                        // Track progress for real-time visibility
                        progressEngine.processEvent(event);
                        // Update task registry with progress every 10 events (rate limiting)
                        if (eventCount % 10 === 0) {
                            const progress = progressEngine.getProgress();
                            globalTaskRegistry.updateProgress(taskId, progress);
                            console.error(`[LocalExec:${taskId}] Progress: ${progress.progressPercentage}% (${progress.currentAction || 'processing'})`);
                            // Send MCP progress notification (v3.5.0)
                            await sendProgressNotification(extra, createStepProgressNotification(taskId, progress.completedSteps, progress.totalSteps, progress.currentAction ?? undefined), `LocalExec:${taskId}`);
                        }
                    }
                    console.error(`[LocalExec:${taskId}] ✅ Execution complete, ${eventCount} events, thread: ${threadId}`);
                    // Update progress one final time to ensure 100% (v3.4.2 fix)
                    const finalProgress = progressEngine.getProgress();
                    globalTaskRegistry.updateProgress(taskId, finalProgress);
                    console.error(`[LocalExec:${taskId}] Final progress: ${finalProgress.progressPercentage}%`);
                    // Send final completion notification (v3.5.0)
                    await sendProgressNotification(extra, createCompletionNotification(taskId, 'Codex SDK execution complete'), `LocalExec:${taskId}`);
                    // Clear timeout timers (v3.2.1)
                    clearTimeout(hardTimeoutTimer);
                    clearInterval(idleCheckInterval);
                    // Run git verification to check if git operations actually succeeded
                    console.error(`[LocalExec:${taskId}] Running git verification...`);
                    const gitVerification = await verifyGitOperations(validated.workingDir || process.cwd(), validated.task);
                    // Determine final status based on git verification
                    let finalStatus = 'completed';
                    if (gitVerification.errors.length > 0) {
                        finalStatus = 'completed_with_errors';
                        console.error(`[LocalExec:${taskId}] ⚠️ Git verification found ${gitVerification.errors.length} errors`);
                    }
                    else if (gitVerification.warnings.length > 0) {
                        finalStatus = 'completed_with_warnings';
                        console.error(`[LocalExec:${taskId}] ⚠️ Git verification found ${gitVerification.warnings.length} warnings`);
                    }
                    // Format verification results for user
                    const verificationOutput = formatGitVerification(gitVerification);
                    // Update SQLite registry with success + verification results
                    globalTaskRegistry.updateTask(taskId, {
                        status: finalStatus,
                        threadId: threadId,
                        result: JSON.stringify({
                            success: gitVerification.errors.length === 0,
                            eventCount,
                            threadId,
                            finalOutput: finalOutput || `SDK execution complete (${eventCount} events)`,
                            gitVerification: {
                                errors: gitVerification.errors,
                                warnings: gitVerification.warnings,
                                recommendations: gitVerification.recommendations,
                                branchCreated: gitVerification.branchExists,
                                commitCreated: gitVerification.commitExists,
                                filesStaged: gitVerification.filesStaged,
                            },
                            verificationOutput,
                        }),
                    });
                }
                catch (error) {
                    console.error(`[LocalExec:${taskId}] ❌ Error:`, error);
                    // Clear timeout timers (v3.2.1)
                    clearTimeout(hardTimeoutTimer);
                    clearInterval(idleCheckInterval);
                    // Update SQLite registry with failure
                    globalTaskRegistry.updateTask(taskId, {
                        status: 'failed',
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            })(); // Execute immediately in background
            // Task is now tracked in unified SQLite registry
            // Build response message
            let responseText = '';
            // Prepend safety checkpoint info if it exists
            if (checkpointInfo) {
                responseText += `🛡️  **GIT SAFETY CHECKPOINT CREATED**\n\n${checkpointInfo}\n\n---\n\n`;
            }
            responseText += `✅ Codex SDK Task Started (Async)\n\n**Task ID**: \`${taskId}\`\n\n**Task**: ${validated.task}\n\n**Mode**: ${validated.mode}\n\n**Working Directory**: ${validated.workingDir || process.cwd()}\n\n**Status**: Running in background\n\n💡 **Check Progress**:\n- Use \`_codex_local_wait\` to wait for completion: \`{ "task_id": "${taskId}" }\`\n- Use \`_codex_local_status\` to check status\n- Use \`_codex_local_results\` with task ID to get results when complete\n- Use \`_codex_local_cancel\` to cancel: \`{ "task_id": "${taskId}" }\`\n\n**Note**: Task tracked in unified SQLite registry. Thread data persists in \`~/.codex/sessions/\` for resumption with \`_codex_local_resume\`.`;
            // Return unified registry task ID immediately (non-blocking)
            const mcpResponse = {
                content: [
                    {
                        type: 'text',
                        text: responseText,
                    },
                ],
            };
            console.error('[LocalExec] ✅ Returned task ID immediately (non-blocking)');
            console.error('[LocalExec] ==================== EXECUTE END (ASYNC) ====================');
            return mcpResponse;
        }
        catch (error) {
            console.error('[LocalExec] ❌❌❌ CAUGHT ERROR ❌❌❌');
            console.error('[LocalExec] Error type:', error instanceof Error ? 'Error' : typeof error);
            console.error('[LocalExec] Error message:', error instanceof Error ? error.message : String(error));
            console.error('[LocalExec] Error stack:', error instanceof Error ? error.stack : 'N/A');
            const errorResult = {
                success: false,
                threadId: '',
                events: [],
                finalResponse: '',
                error: error instanceof Error ? error.message : String(error),
            };
            // Return MCP-compatible error response
            const errorResponse = {
                content: [
                    {
                        type: 'text',
                        text: `❌ codex_local_exec failed:\n${JSON.stringify(errorResult, null, 2)}`,
                    },
                ],
                isError: true,
            };
            console.error('[LocalExec] ==================== EXECUTE END (ERROR) ====================');
            return errorResponse;
        }
    }
}
//# sourceMappingURL=local_exec.js.map