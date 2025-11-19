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

// Error envelope used for timeout mapping
export type ErrorObject = {
  code: string;
  message: string;
  details?: any;
  retryable?: boolean;
  duration_ms?: number;
};

export function mapTimeoutError(
  timeoutType: "idle" | "hard",
  elapsedSeconds: number,
  partialResults?: { lastEvents?: any[]; lastOutput?: string },
): ErrorObject {
  return {
    code: "TIMEOUT",
    message: `Task exceeded ${timeoutType} timeout (${elapsedSeconds}s elapsed)`,
    details: {
      timeout_type: timeoutType,
      elapsed_seconds: elapsedSeconds,
      partial_results: partialResults
        ? {
            last_events: partialResults.lastEvents?.slice(-50),
            last_output: partialResults.lastOutput?.slice(-2000),
          }
        : undefined,
    },
    retryable: false,
    duration_ms: elapsedSeconds * 1000,
  };
}

export class ErrorMapper {
  /**
   * Parse stderr to extract meaningful error messages (Issue 3.3 fix)
   */
  private static parseStderrForErrors(
    stderr: string,
  ): { message: string; suggestion?: string } | null {
    if (!stderr) return null;

    // Authentication errors
    if (
      stderr.includes("Not authenticated") ||
      stderr.includes("Authentication failed")
    ) {
      return {
        message: "Codex authentication failed",
        suggestion:
          "Run `codex auth` or set CODEX_API_KEY environment variable",
      };
    }

    // Git repository errors
    if (
      stderr.includes("Not inside a trusted directory") ||
      stderr.includes("not a git repository")
    ) {
      return {
        message: "Task requires a git repository",
        suggestion:
          "Run `git init` in your project directory or use skipGitRepoCheck=true",
      };
    }

    // Network/API errors
    if (stderr.includes("ECONNREFUSED") || stderr.includes("ENOTFOUND")) {
      return {
        message: "Network connection failed",
        suggestion: "Check your internet connection and try again",
      };
    }

    // Rate limit errors
    if (stderr.includes("rate limit") || stderr.includes("429")) {
      return {
        message: "API rate limit exceeded",
        suggestion: "Wait a few minutes and try again",
      };
    }

    // File permission errors
    if (stderr.includes("EACCES") || stderr.includes("permission denied")) {
      return {
        message: "Permission denied",
        suggestion: "Check file permissions in your working directory",
      };
    }

    // Timeout errors
    if (stderr.includes("timeout") || stderr.includes("timed out")) {
      return {
        message: "Task execution timed out",
        suggestion:
          "Try breaking the task into smaller steps or use cloud execution",
      };
    }

    // Extract first meaningful error line
    const lines = stderr.split("\n").filter((line) => line.trim());
    const errorLine = lines.find(
      (line) =>
        line.includes("Error:") ||
        line.includes("error") ||
        line.includes("failed"),
    );

    if (errorLine) {
      return {
        message: errorLine.trim(),
        suggestion: "Check the error details above and correct the issue",
      };
    }

    return null;
  }

  /**
   * Detect silent failures (Issue 1.2 fix) - when task reports success but did no work
   */
  private static detectSilentFailure(result: CodexProcessResult): boolean {
    // If exit code is 0 but no events were captured, something went wrong
    if (result.exitCode === 0 && result.events.length === 0) {
      return true;
    }

    // If there's a turn.completed but no actual work (no file changes, no commands)
    const hasCompleted = result.events.some((e) => e.type === "turn.completed");
    const hasWork =
      result.events.some(
        (e) =>
          e.type === "item.completed" &&
          (e.data?.type === "file_change" ||
            e.data?.type === "command_execution"),
      ) ||
      result.events.some(
        (e) => e.type === "agent.message" || e.type === "item.completed",
      );

    if (hasCompleted && !hasWork) {
      return true;
    }

    return false;
  }

  /**
   * Map a failed process result to MCP error format (Enhanced for Issues 1.2 + 3.3)
   */
  static mapProcessError(result: CodexProcessResult): MCPError {
    // Timeout handling with partial results (Bug 1 fix)
    if (result.timeout) {
      const t = result.timeout;
      const timeoutType: "idle" | "hard" =
        t.kind === "inactivity" ? "idle" : "hard";
      const elapsedMs = t.wallClockMs ?? t.idleMs ?? 0;
      const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
      const partial = result.partial;
      const partialResults = partial
        ? {
            lastEvents: partial.lastEvents,
            lastOutput: partial.stdoutTail,
          }
        : undefined;

      return mapTimeoutError(timeoutType, elapsedSeconds, partialResults);
    }

    // Spawn error (codex not found, permission denied, etc.)
    if (result.error) {
      const stderrError = this.parseStderrForErrors(result.stderr);
      return {
        code: "SPAWN_ERROR",
        message:
          stderrError?.message ||
          `Failed to spawn codex process: ${result.error.message}`,
        details: {
          error: result.error.message,
          stderr: result.stderr,
          suggestion:
            stderrError?.suggestion ||
            "Ensure codex CLI is installed: npm install -g @openai/codex",
        },
      };
    }

    // Signal termination (killed, timeout, etc.)
    if (result.signal) {
      return {
        code: "PROCESS_KILLED",
        message: `Codex process terminated by signal: ${result.signal}`,
        details: {
          signal: result.signal,
          stderr: result.stderr,
          suggestion:
            result.signal === "SIGTERM"
              ? "Process timed out - try breaking task into smaller steps"
              : "Process was killed unexpectedly - check system resources",
        },
      };
    }

    // Silent failure detection (Issue 1.2)
    if (this.detectSilentFailure(result)) {
      return {
        code: "SILENT_FAILURE",
        message: "Task completed but no work was performed",
        details: {
          exitCode: result.exitCode,
          events: result.events.length,
          suggestion:
            "Task may have failed silently - check task description and try again",
        },
      };
    }

    // Non-zero exit code
    if (result.exitCode !== 0) {
      // Check for specific error events in JSONL stream
      const failedEvent = result.events.find((e) => e.type === "turn.failed");
      if (failedEvent) {
        return {
          code: "TURN_FAILED",
          message: failedEvent.data?.error?.message || "Codex turn failed",
          details: {
            exitCode: result.exitCode,
            error: failedEvent.data?.error,
            stderr: result.stderr,
            suggestion:
              "Review the error message and adjust your task description",
          },
        };
      }

      // Parse stderr for better error message (Issue 3.3)
      const stderrError = this.parseStderrForErrors(result.stderr);
      if (stderrError) {
        return {
          code: "EXIT_ERROR",
          message: stderrError.message,
          details: {
            exitCode: result.exitCode,
            stderr: result.stderr,
            suggestion: stderrError.suggestion,
          },
        };
      }

      return {
        code: "EXIT_ERROR",
        message: `Codex process exited with code ${result.exitCode}`,
        details: {
          exitCode: result.exitCode,
          stderr: result.stderr,
          suggestion: "Check stderr output above for details",
        },
      };
    }

    // Unknown error
    return {
      code: "UNKNOWN_ERROR",
      message: "Codex process failed for unknown reason",
      details: {
        exitCode: result.exitCode,
        stderr: result.stderr,
        suggestion:
          "Check system logs and ensure codex CLI is working correctly",
      },
    };
  }

  /**
   * Map authentication errors
   */
  static mapAuthError(message: string): MCPError {
    return {
      code: "AUTH_ERROR",
      message: "Codex authentication failed",
      details: {
        hint: "Set CODEX_API_KEY environment variable or ensure ChatGPT Pro is configured",
        error: message,
      },
    };
  }

  /**
   * Map input validation errors
   */
  static mapValidationError(field: string, reason: string): MCPError {
    return {
      code: "VALIDATION_ERROR",
      message: `Invalid input: ${field}`,
      details: {
        field,
        reason,
      },
    };
  }

  /**
   * Map mutation confirmation errors
   */
  static mapConfirmationError(task: string): MCPError {
    return {
      code: "CONFIRMATION_REQUIRED",
      message: "This operation requires explicit confirmation",
      details: {
        task,
        hint: "Run with confirm=true to proceed with file modifications",
      },
    };
  }

  /**
   * Extract user-friendly summary from events
   */
  static extractSummary(events: CodexEvent[]): string {
    const completedEvent = events.find((e) => e.type === "turn.completed");
    if (completedEvent?.data?.summary) {
      return completedEvent.data.summary;
    }

    const messageEvents = events.filter(
      (e) => e.type === "item.completed" && e.data?.type === "agent_message",
    );

    if (messageEvents.length > 0) {
      const lastMessage = messageEvents[messageEvents.length - 1];
      return lastMessage.data?.content || "Task completed";
    }

    return "Task completed successfully";
  }

  /**
   * Extract file changes from events
   */
  static extractFileChanges(
    events: CodexEvent[],
  ): Array<{ path: string; operation: string }> {
    return events
      .filter(
        (e) => e.type === "item.completed" && e.data?.type === "file_change",
      )
      .map((e) => ({
        path: e.data?.path || "unknown",
        operation: e.data?.operation || "modified",
      }));
  }

  /**
   * Extract command executions from events
   */
  static extractCommands(
    events: CodexEvent[],
  ): Array<{ command: string; exitCode: number }> {
    return events
      .filter(
        (e) =>
          e.type === "item.completed" && e.data?.type === "command_execution",
      )
      .map((e) => ({
        command: e.data?.command || "unknown",
        exitCode: e.data?.exit_code ?? -1,
      }));
  }
}
