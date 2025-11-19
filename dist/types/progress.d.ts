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
import type { Request, Notification } from "@modelcontextprotocol/sdk/types.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
/**
 * Extended tool execute signature with MCP notification support.
 *
 * Tools can receive this as an optional second parameter to enable
 * sending progress notifications during long-running operations.
 */
export type ToolExecuteExtra = RequestHandlerExtra<Request, Notification>;
/**
 * Progress notification parameters following MCP protocol.
 *
 * @see https://spec.modelcontextprotocol.io/specification/2024-11-05/server/utilities/notifications/#progress-notifications
 */
export interface ProgressNotificationParams {
    /** Unique token identifying this operation (typically task ID) */
    progressToken: string | number;
    /** Current progress value (completed steps, elapsed time, etc.) */
    progress: number;
    /** Total expected value (total steps, estimated time, etc.) - optional */
    total?: number;
    /** Human-readable status message - optional */
    message?: string;
    /** Index signature for MCP SDK compatibility */
    [key: string]: unknown;
}
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
export declare function sendProgressNotification(extra: ToolExecuteExtra | undefined, params: ProgressNotificationParams, context: string): Promise<void>;
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
export declare function createStartNotification(taskId: string, message?: string): ProgressNotificationParams;
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
export declare function createCompletionNotification(taskId: string, message?: string): ProgressNotificationParams;
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
export declare function createElapsedTimeNotification(taskId: string, elapsedSeconds: number): ProgressNotificationParams;
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
export declare function createStepProgressNotification(taskId: string, completedSteps: number, totalSteps: number, currentAction?: string): ProgressNotificationParams;
//# sourceMappingURL=progress.d.ts.map