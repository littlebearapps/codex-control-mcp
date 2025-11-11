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

export class ErrorMapper {
  /**
   * Map a failed process result to MCP error format
   */
  static mapProcessError(result: CodexProcessResult): MCPError {
    // Spawn error (codex not found, permission denied, etc.)
    if (result.error) {
      return {
        code: 'SPAWN_ERROR',
        message: `Failed to spawn codex process: ${result.error.message}`,
        details: {
          error: result.error.message,
          stderr: result.stderr,
        },
      };
    }

    // Signal termination (killed, timeout, etc.)
    if (result.signal) {
      return {
        code: 'PROCESS_KILLED',
        message: `Codex process terminated by signal: ${result.signal}`,
        details: {
          signal: result.signal,
          stderr: result.stderr,
        },
      };
    }

    // Non-zero exit code
    if (result.exitCode !== 0) {
      // Check for specific error events in JSONL stream
      const failedEvent = result.events.find((e) => e.type === 'turn.failed');
      if (failedEvent) {
        return {
          code: 'TURN_FAILED',
          message: failedEvent.data?.error?.message || 'Codex turn failed',
          details: {
            exitCode: result.exitCode,
            error: failedEvent.data?.error,
            stderr: result.stderr,
          },
        };
      }

      return {
        code: 'EXIT_ERROR',
        message: `Codex process exited with code ${result.exitCode}`,
        details: {
          exitCode: result.exitCode,
          stderr: result.stderr,
        },
      };
    }

    // Unknown error
    return {
      code: 'UNKNOWN_ERROR',
      message: 'Codex process failed for unknown reason',
      details: {
        exitCode: result.exitCode,
        stderr: result.stderr,
      },
    };
  }

  /**
   * Map authentication errors
   */
  static mapAuthError(message: string): MCPError {
    return {
      code: 'AUTH_ERROR',
      message: 'Codex authentication failed',
      details: {
        hint: 'Set CODEX_API_KEY environment variable or ensure ChatGPT Pro is configured',
        error: message,
      },
    };
  }

  /**
   * Map input validation errors
   */
  static mapValidationError(field: string, reason: string): MCPError {
    return {
      code: 'VALIDATION_ERROR',
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
      code: 'CONFIRMATION_REQUIRED',
      message: 'This operation requires explicit confirmation',
      details: {
        task,
        hint: 'Run with confirm=true to proceed with file modifications',
      },
    };
  }

  /**
   * Extract user-friendly summary from events
   */
  static extractSummary(events: CodexEvent[]): string {
    const completedEvent = events.find((e) => e.type === 'turn.completed');
    if (completedEvent?.data?.summary) {
      return completedEvent.data.summary;
    }

    const messageEvents = events.filter(
      (e) => e.type === 'item.completed' && e.data?.type === 'agent_message'
    );

    if (messageEvents.length > 0) {
      const lastMessage = messageEvents[messageEvents.length - 1];
      return lastMessage.data?.content || 'Task completed';
    }

    return 'Task completed successfully';
  }

  /**
   * Extract file changes from events
   */
  static extractFileChanges(events: CodexEvent[]): Array<{ path: string; operation: string }> {
    return events
      .filter((e) => e.type === 'item.completed' && e.data?.type === 'file_change')
      .map((e) => ({
        path: e.data?.path || 'unknown',
        operation: e.data?.operation || 'modified',
      }));
  }

  /**
   * Extract command executions from events
   */
  static extractCommands(events: CodexEvent[]): Array<{ command: string; exitCode: number }> {
    return events
      .filter((e) => e.type === 'item.completed' && e.data?.type === 'command_execution')
      .map((e) => ({
        command: e.data?.command || 'unknown',
        exitCode: e.data?.exit_code ?? -1,
      }));
  }
}
