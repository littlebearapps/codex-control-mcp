/**
 * Codex Logger Utility
 *
 * Provides structured logging to help Claude Code detect failures and troubleshoot issues.
 * Logs are written to .codex-errors.log in the working directory (or configured path).
 */

import fs from "fs";
import path from "path";

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  meta?: any;
  pid: number;
}

export class CodexLogger {
  private logFile: string | null;
  private logLevel: "debug" | "info" | "warn" | "error";

  constructor() {
    // Support ${PWD} variable in log file path
    this.logFile = process.env.CODEX_LOG_FILE || null;
    this.logLevel = (process.env.CODEX_LOG_LEVEL as any) || "info";
  }

  private resolveLogPath(workingDir?: string): string | null {
    if (!this.logFile) return null;

    // Replace ${PWD} with actual working directory
    const cwd = workingDir || process.cwd();
    return this.logFile.replace("${PWD}", cwd);
  }

  private write(
    level: LogEntry["level"],
    message: string,
    meta?: any,
    workingDir?: string,
  ) {
    const resolvedPath = this.resolveLogPath(workingDir);
    if (!resolvedPath) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta: meta || {},
      pid: process.pid,
    };

    const logLine = JSON.stringify(entry) + "\n";

    try {
      // Ensure directory exists
      const logDir = path.dirname(resolvedPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Append to log file
      fs.appendFileSync(resolvedPath, logLine);
    } catch (err) {
      // Silent failure - can't log if logging fails
      // Write to stderr as fallback
      console.error("[Logger] Failed to write log:", err);
    }
  }

  private shouldLog(level: LogEntry["level"]): boolean {
    const levels = ["debug", "info", "warn", "error"];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Log an error (always logged)
   * Use this for failures that Claude Code needs to detect
   */
  error(message: string, meta?: any, workingDir?: string) {
    this.write("error", message, meta, workingDir);
    console.error(`[ERROR] ${message}`, meta);
  }

  /**
   * Log a warning
   * Use this for non-fatal issues
   */
  warn(message: string, meta?: any, workingDir?: string) {
    if (this.shouldLog("warn")) {
      this.write("warn", message, meta, workingDir);
      console.warn(`[WARN] ${message}`);
    }
  }

  /**
   * Log informational message
   * Use this for normal operations
   */
  info(message: string, meta?: any, workingDir?: string) {
    if (this.shouldLog("info")) {
      this.write("info", message, meta, workingDir);
    }
  }

  /**
   * Log debug information
   * Use this for detailed troubleshooting
   */
  debug(message: string, meta?: any, workingDir?: string) {
    if (this.shouldLog("debug")) {
      this.write("debug", message, meta, workingDir);
    }
  }

  /**
   * Log tool start
   * Helps Claude Code track which tools are running
   */
  toolStart(toolName: string, input: any, workingDir?: string) {
    this.info(`Tool started: ${toolName}`, { input }, workingDir);
  }

  /**
   * Log tool success
   * Confirms tool completed successfully
   */
  toolSuccess(toolName: string, result: any, workingDir?: string) {
    this.info(
      `Tool completed: ${toolName}`,
      {
        success: true,
        hasOutput: !!result,
      },
      workingDir,
    );
  }

  /**
   * Log tool failure
   * CRITICAL: Claude Code uses this to detect failures
   */
  toolFailure(
    toolName: string,
    error: Error | string,
    input: any,
    workingDir?: string,
  ) {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.error(
      `Tool failed: ${toolName}`,
      {
        error: errorMessage,
        stack: errorStack,
        input,
      },
      workingDir,
    );
  }

  /**
   * Log timeout
   * CRITICAL: Claude Code uses this to stop waiting
   */
  toolTimeout(toolName: string, timeoutMs: number, workingDir?: string) {
    this.error(
      `Tool timeout: ${toolName}`,
      {
        timeoutMs,
        message: "Task exceeded time limit",
      },
      workingDir,
    );
  }
}

// Global singleton instance
export const globalLogger = new CodexLogger();
