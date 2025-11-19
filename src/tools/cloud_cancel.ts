/**
 * Cloud Cancel Tool - Terminate running cloud tasks
 *
 * Cancels a cloud task via Codex CLI and updates local registry.
 */

import { spawn } from "child_process";
import { globalTaskRegistry } from "../state/task_registry.js";

/**
 * Cancel cloud task via CLI
 */
async function cancelCloudTask(taskId: string): Promise<{
  success: boolean;
  message: string;
}> {
  return new Promise((resolve, _reject) => {
    // Use codex cloud cancel command
    const proc = spawn("codex", ["cloud", "cancel", taskId], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          message: `codex cloud cancel failed: ${stderr || stdout}`,
        });
        return;
      }

      resolve({
        success: true,
        message: stdout || "Task canceled successfully",
      });
    });
  });
}

/**
 * Cloud cancel tool handler
 */
export async function handleCloudCancel(params: {
  task_id: string;
  reason?: string;
}): Promise<{
  success: boolean;
  task_id: string;
  status: string;
  message: string;
  error?: string;
  reason?: string;
  web_ui_url: string;
}> {
  const { task_id, reason } = params;
  const webUiUrl = `https://chatgpt.com/codex/tasks/${task_id}`;

  try {
    // Get task from registry
    const task = globalTaskRegistry.getTask(task_id);
    if (!task) {
      return {
        success: false,
        task_id,
        status: "unknown",
        message: `Task ${task_id} not found in registry`,
        error: "Task not found",
        web_ui_url: webUiUrl,
      };
    }

    // Check if task is cloud
    if (task.origin !== "cloud") {
      return {
        success: false,
        task_id,
        status: task.status,
        message: `Task ${task_id} is a local task. Use _codex_local_cancel instead.`,
        error: "Wrong cancellation tool for local task",
        web_ui_url: webUiUrl,
      };
    }

    // Check if already completed
    if (
      task.status === "completed" ||
      task.status === "failed" ||
      task.status === "canceled"
    ) {
      return {
        success: false,
        task_id,
        status: task.status,
        message: `Task ${task_id} already ${task.status}. Cannot cancel.`,
        error: `Task already in terminal state: ${task.status}`,
        web_ui_url: webUiUrl,
      };
    }

    // Attempt to cancel via CLI
    const cancelResult = await cancelCloudTask(task_id);

    if (!cancelResult.success) {
      return {
        success: false,
        task_id,
        status: task.status,
        message: cancelResult.message,
        error: "Cloud cancellation failed",
        web_ui_url: webUiUrl,
      };
    }

    // Update local registry
    const updatedTask = globalTaskRegistry.updateStatus(task_id, "canceled");
    if (!updatedTask) {
      // Cancellation succeeded in cloud but registry update failed
      return {
        success: true,
        task_id,
        status: "canceled",
        message: `Task ${task_id} canceled in cloud, but local registry update failed. Check Web UI for status.`,
        error: "Registry update failed (cloud task still canceled)",
        web_ui_url: webUiUrl,
      };
    }

    // Add cancellation reason to metadata if provided
    if (reason) {
      globalTaskRegistry.updateTask(task_id, {
        metadata: JSON.stringify({ cancelReason: reason }),
      });
    }

    return {
      success: true,
      task_id,
      status: "canceled",
      message: `Task ${task_id} canceled successfully in Codex Cloud. ${cancelResult.message}`,
      reason,
      web_ui_url: webUiUrl,
    };
  } catch (error) {
    return {
      success: false,
      task_id,
      status: "unknown",
      message: error instanceof Error ? error.message : String(error),
      error: error instanceof Error ? error.message : String(error),
      web_ui_url: webUiUrl,
    };
  }
}

/**
 * MCP Tool Class
 */
export class CloudCancelTool {
  static getSchema() {
    return {
      name: "_codex_cloud_cancel",
      description:
        'Stop a running cloud task - like aborting a long-running build. Sends cancellation request to Codex Cloud via CLI and updates local registry status to "canceled". Use when a cloud task is taking too long, stuck, or no longer needed. Works for tasks in "pending" or "working" state. Returns confirmation of cancellation with Web UI link for verification. Note: Cancellation may take a few seconds to propagate. Check Web UI if uncertain.',
      inputSchema: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            description: "The cloud task to cancel (format: T-cloud-abc123).",
          },
          reason: {
            type: "string",
            description:
              'Optional: Why canceling (e.g., "User aborted", "Taking too long", "Requirements changed"). Helps with debugging and audit trail.',
          },
          format: {
            type: "string",
            enum: ["json", "markdown"],
            default: "markdown",
            description:
              "Response format. Default markdown for backward compatibility.",
          },
        },
        required: ["task_id"],
      },
    };
  }

  async execute(params: any) {
    const result = await handleCloudCancel(params);
    if (params?.format === "json") {
      const json: any = {
        version: "3.6",
        schema_id: "codex/v3.6/registry_info/v1",
        tool: "_codex_cloud_cancel",
        tool_category: "registry_info",
        request_id: (await import("crypto")).randomUUID(),
        ts: new Date().toISOString(),
        status: result.success ? "ok" : "error",
        meta: { ack_ts: new Date().toISOString() },
        ...(result.success
          ? {
              data: {
                operation: "cancel",
                task_id: result.task_id,
                state: result.status,
                web_ui_url: result.web_ui_url,
              },
            }
          : {
              error: {
                code: "TOOL_ERROR",
                message: result.error || result.message,
                retryable: false,
                details: { web_ui_url: result.web_ui_url },
              },
            }),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(json) }],
        isError: !result.success,
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
}
