/**
 * Codex Logger Utility
 *
 * Provides structured logging to help Claude Code detect failures and troubleshoot issues.
 * Logs are written to .codex-errors.log in the working directory (or configured path).
 */
export interface LogEntry {
    timestamp: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    meta?: any;
    pid: number;
}
export declare class CodexLogger {
    private logFile;
    private logLevel;
    constructor();
    private resolveLogPath;
    private write;
    private shouldLog;
    /**
     * Log an error (always logged)
     * Use this for failures that Claude Code needs to detect
     */
    error(message: string, meta?: any, workingDir?: string): void;
    /**
     * Log a warning
     * Use this for non-fatal issues
     */
    warn(message: string, meta?: any, workingDir?: string): void;
    /**
     * Log informational message
     * Use this for normal operations
     */
    info(message: string, meta?: any, workingDir?: string): void;
    /**
     * Log debug information
     * Use this for detailed troubleshooting
     */
    debug(message: string, meta?: any, workingDir?: string): void;
    /**
     * Log tool start
     * Helps Claude Code track which tools are running
     */
    toolStart(toolName: string, input: any, workingDir?: string): void;
    /**
     * Log tool success
     * Confirms tool completed successfully
     */
    toolSuccess(toolName: string, result: any, workingDir?: string): void;
    /**
     * Log tool failure
     * CRITICAL: Claude Code uses this to detect failures
     */
    toolFailure(toolName: string, error: Error | string, input: any, workingDir?: string): void;
    /**
     * Log timeout
     * CRITICAL: Claude Code uses this to stop waiting
     */
    toolTimeout(toolName: string, timeoutMs: number, workingDir?: string): void;
}
export declare const globalLogger: CodexLogger;
//# sourceMappingURL=logger.d.ts.map