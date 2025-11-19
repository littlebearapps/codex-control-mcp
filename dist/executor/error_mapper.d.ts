/**
 * Error Mapper for Codex CLI
 *
 * Maps Codex CLI errors and failures to MCP error format
 * Provides structured error responses for MCP clients
 */
import { CodexProcessResult } from "./process_manager.js";
import { CodexEvent } from "./jsonl_parser.js";
export interface MCPError {
    code: string;
    message: string;
    details?: any;
    retryable?: boolean;
    duration_ms?: number;
}
export type ErrorObject = {
    code: string;
    message: string;
    details?: any;
    retryable?: boolean;
    duration_ms?: number;
};
export declare function mapTimeoutError(timeoutType: "idle" | "hard", elapsedSeconds: number, partialResults?: {
    lastEvents?: any[];
    lastOutput?: string;
}): ErrorObject;
export declare class ErrorMapper {
    /**
     * Parse stderr to extract meaningful error messages (Issue 3.3 fix)
     */
    private static parseStderrForErrors;
    /**
     * Detect silent failures (Issue 1.2 fix) - when task reports success but did no work
     */
    private static detectSilentFailure;
    /**
     * Map a failed process result to MCP error format (Enhanced for Issues 1.2 + 3.3)
     */
    static mapProcessError(result: CodexProcessResult): MCPError;
    /**
     * Map authentication errors
     */
    static mapAuthError(message: string): MCPError;
    /**
     * Map input validation errors
     */
    static mapValidationError(field: string, reason: string): MCPError;
    /**
     * Map mutation confirmation errors
     */
    static mapConfirmationError(task: string): MCPError;
    /**
     * Extract user-friendly summary from events
     */
    static extractSummary(events: CodexEvent[]): string;
    /**
     * Extract file changes from events
     */
    static extractFileChanges(events: CodexEvent[]): Array<{
        path: string;
        operation: string;
    }>;
    /**
     * Extract command executions from events
     */
    static extractCommands(events: CodexEvent[]): Array<{
        command: string;
        exitCode: number;
    }>;
}
//# sourceMappingURL=error_mapper.d.ts.map