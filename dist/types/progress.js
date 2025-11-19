/**
 * MCP Progress Notification Support
 *
 * Provides types and helper functions for sending MCP progress notifications
 * to Claude Code, enabling real-time task visibility in the status bar.
 *
 * ⚠️ CURRENTLY DISABLED: Claude Code does not yet support displaying MCP
 * progress notifications in the UI (as of 2025-11-17).
 *
 * See GitHub issues:
 * - https://github.com/anthropics/claude-code/issues/4157
 * - https://github.com/anthropics/claude-code/issues/3174
 *
 * When Claude Code adds UI support, set ENABLE_MCP_PROGRESS_NOTIFICATIONS = true
 *
 * @module types/progress
 */
/**
 * Feature flag to enable/disable MCP progress notifications.
 *
 * DISABLED by default because Claude Code doesn't display them yet.
 * Set to true when Claude Code implements UI support for notifications/progress.
 */
const ENABLE_MCP_PROGRESS_NOTIFICATIONS = false;
/**
 * Send a progress notification to Claude Code with comprehensive error handling.
 *
 * This helper ensures notification failures never break tool execution:
 * - Silently returns if no notification capability available
 * - Catches and logs errors without throwing
 * - Provides context for debugging
 *
 * @param extra - MCP request handler extra (optional)
 * @param params - Progress notification parameters
 * @param context - Logging context (e.g., "LocalExec:T-local-abc123")
 *
 * @example
 * ```typescript
 * await sendProgressNotification(
 *   extra,
 *   {
 *     progressToken: 'T-local-abc123',
 *     progress: 50,
 *     total: 100,
 *     message: 'Processing step 50/100'
 *   },
 *   'LocalExec:T-local-abc123'
 * );
 * ```
 */
export async function sendProgressNotification(extra, params, context) {
    // Feature disabled - Claude Code doesn't support displaying progress notifications yet
    if (!ENABLE_MCP_PROGRESS_NOTIFICATIONS) {
        return;
    }
    // No notification capability - silent return
    if (!extra?.sendNotification) {
        return;
    }
    try {
        await extra.sendNotification({
            method: "notifications/progress",
            params,
        });
    }
    catch (error) {
        // Log error but don't throw - notification failures should never break execution
        console.error(`[${context}] Progress notification failed:`, error);
    }
}
/**
 * Create a progress notification for task start (0% complete).
 *
 * @param taskId - Task identifier
 * @param message - Optional start message
 * @returns Progress notification parameters
 *
 * @example
 * ```typescript
 * await sendProgressNotification(
 *   extra,
 *   createStartNotification('T-local-abc123', 'Starting Codex execution'),
 *   'LocalRun:T-local-abc123'
 * );
 * ```
 */
export function createStartNotification(taskId, message) {
    return {
        progressToken: taskId,
        progress: 0,
        total: 100,
        message: message || "Starting task...",
    };
}
/**
 * Create a progress notification for task completion (100% complete).
 *
 * @param taskId - Task identifier
 * @param message - Optional completion message
 * @returns Progress notification parameters
 *
 * @example
 * ```typescript
 * await sendProgressNotification(
 *   extra,
 *   createCompletionNotification('T-local-abc123', 'Codex execution complete'),
 *   'LocalRun:T-local-abc123'
 * );
 * ```
 */
export function createCompletionNotification(taskId, message) {
    return {
        progressToken: taskId,
        progress: 100,
        total: 100,
        message: message || "Task complete",
    };
}
/**
 * Create a progress notification for elapsed time tracking.
 *
 * Used for operations where total duration is unknown (like CLI execution).
 *
 * @param taskId - Task identifier
 * @param elapsedSeconds - Elapsed time in seconds
 * @returns Progress notification parameters
 *
 * @example
 * ```typescript
 * await sendProgressNotification(
 *   extra,
 *   createElapsedTimeNotification('T-local-abc123', 45),
 *   'LocalRun:T-local-abc123'
 * );
 * // Shows: "Codex executing (45s elapsed)"
 * ```
 */
export function createElapsedTimeNotification(taskId, elapsedSeconds) {
    return {
        progressToken: taskId,
        progress: elapsedSeconds,
        total: undefined,
        message: `Codex executing (${elapsedSeconds}s elapsed)`,
    };
}
/**
 * Create a progress notification with step-based progress.
 *
 * Used for SDK execution where we know total steps.
 *
 * @param taskId - Task identifier
 * @param completedSteps - Number of completed steps
 * @param totalSteps - Total number of steps
 * @param currentAction - Optional description of current action
 * @returns Progress notification parameters
 *
 * @example
 * ```typescript
 * await sendProgressNotification(
 *   extra,
 *   createStepProgressNotification('T-local-abc123', 4, 6, 'Analyzing security'),
 *   'LocalExec:T-local-abc123'
 * );
 * // Shows: "67% complete - Analyzing security"
 * ```
 */
export function createStepProgressNotification(taskId, completedSteps, totalSteps, currentAction) {
    const percentage = Math.round((completedSteps / totalSteps) * 100);
    let message = `${percentage}% complete`;
    if (currentAction) {
        message += ` - ${currentAction}`;
    }
    return {
        progressToken: taskId,
        progress: completedSteps,
        total: totalSteps,
        message,
    };
}
//# sourceMappingURL=progress.js.map