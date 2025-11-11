/**
 * Error Mapper for Codex CLI
 *
 * Maps Codex CLI errors and failures to MCP error format
 * Provides structured error responses for MCP clients
 */
import { CodexProcessResult } from './process_manager.js';
import { CodexEvent } from './jsonl_parser.js';
export interface MCPError {
    code: string;
    message: string;
    details?: any;
}
export declare class ErrorMapper {
    /**
     * Map a failed process result to MCP error format
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