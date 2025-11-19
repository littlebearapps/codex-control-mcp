/**
 * Local Wait Tool - Block until completion and return results
 */

import { globalTaskRegistry } from "../state/task_registry.js";
import { extractMetadata } from "../utils/metadata_extractor.js";
import { globalRedactor } from "../security/redactor.js";
import { LocalResultsTool } from "./local_results.js";

export interface LocalWaitInput {
  task_id: string;
  timeout_sec?: number;
  include_output?: boolean;
  max_output_bytes?: number;
  format?: "json" | "markdown";
}

export class LocalWaitTool {
  static getSchema() {
    return {
      name: "_codex_local_wait",
      description:
        "Wait for a local task to complete and return full results. This blocks until the task reaches a terminal state or the timeout is reached.",
      inputSchema: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            description: "Local task ID (T-local-...)",
          },
          timeout_sec: {
            type: "number",
            description: "Maximum seconds to wait (default 300)",
            default: 300,
          },
          include_output: {
            type: "boolean",
            description:
              "Include full stdout/stderr output (default false; included automatically on failure).",
            default: false,
          },
          max_output_bytes: {
            type: "number",
            description: "Max bytes for output (default 65536).",
            default: 65536,
          },
          format: {
            type: "string",
            enum: ["json", "markdown"],
            default: "markdown",
          },
        },
        required: ["task_id"],
      },
    };
  }

  private isTerminal(status: string): boolean {
    return (
      status === "completed" ||
      status === "completed_with_warnings" ||
      status === "completed_with_errors" ||
      status === "failed" ||
      status === "canceled"
    );
  }

  async execute(input: LocalWaitInput) {
    const preferred = input.format || "markdown";
    const timeoutSec =
      typeof input.timeout_sec === "number" ? input.timeout_sec : 300;
    const start = Date.now();

    let task = globalTaskRegistry.getTask(input.task_id);
    if (!task) {
      if (preferred === "json") {
        const json = {
          version: "3.6",
          schema_id: "codex/v3.6/wait_result/v1",
          tool: "_codex_local_wait",
          tool_category: "wait_result",
          request_id: (await import("crypto")).randomUUID(),
          ts: new Date().toISOString(),
          status: "error" as const,
          meta: {},
          error: {
            code: "NOT_FOUND" as const,
            message: "Task not found",
            details: { task_id: input.task_id },
            retryable: false,
          },
        };
        return {
          content: [{ type: "text", text: JSON.stringify(json) }],
          isError: true,
        };
      }
      return {
        content: [
          { type: "text", text: `❌ Task not found: ${input.task_id}` },
        ],
        isError: true,
      };
    }

    // Poll until terminal or timeout
    while (
      !this.isTerminal(task.status) &&
      (Date.now() - start) / 1000 < timeoutSec
    ) {
      await new Promise((r) => setTimeout(r, 2000));
      task = globalTaskRegistry.getTask(input.task_id) || task;
    }

    const timedOut = !this.isTerminal(task.status);
    const completedAt = timedOut ? Date.now() : task.completedAt || Date.now();

    if (preferred === "json") {
      // Build wait_result envelope
      const resultObj = task.result
        ? (() => {
            try {
              return JSON.parse(task.result as string);
            } catch {
              return {};
            }
          })()
        : {};
      const stdoutRaw = resultObj.finalOutput || resultObj.stdout || "";
      const stderrRaw = resultObj.stderr || "";
      const stdout = globalRedactor.redact(stdoutRaw);
      const stderr = globalRedactor.redact(stderrRaw);
      const exitCode =
        typeof resultObj.exitCode === "number" ? resultObj.exitCode : undefined;

      const state: "completed" | "failed" | "cancelled" | "timeout" = timedOut
        ? "timeout"
        : task.status === "failed" || task.status === "completed_with_errors"
          ? "failed"
          : task.status === "canceled"
            ? "cancelled"
            : "completed";

      const includeOutput = state === "failed" || input.include_output === true;
      const maxBytes = input.max_output_bytes || 65536;
      const truncate = (s: string) => {
        if (!s) return { text: "", truncated: false, original: 0 };
        const b = Buffer.from(s, "utf-8");
        if (b.length <= maxBytes)
          return { text: s, truncated: false, original: b.length };
        const half = Math.floor(maxBytes / 2);
        return {
          text: Buffer.concat([
            b.subarray(0, half),
            Buffer.from("\n... [truncated] ...\n"),
            b.subarray(b.length - half),
          ]).toString("utf-8"),
          truncated: true,
          original: b.length,
        };
      };

      const tOut = truncate(stdout);
      const tErr = truncate(stderr);
      const metadata = extractMetadata(
        stdout + (stderr ? `\n${stderr}` : ""),
        exitCode,
        task.threadId,
        input.task_id,
      );

      const json: any = {
        version: "3.6",
        schema_id: "codex/v3.6/wait_result/v1",
        tool: "_codex_local_wait",
        tool_category: "wait_result",
        request_id: (await import("crypto")).randomUUID(),
        ts: new Date().toISOString(),
        status: "ok",
        meta: {
          started_ts: new Date(task.createdAt).toISOString(),
          completed_ts: new Date(completedAt).toISOString(),
          duration_ms: Math.max(0, completedAt - task.createdAt),
          exit_code: exitCode,
        },
        data: {
          task_id: input.task_id,
          state,
          summary:
            state === "completed"
              ? "Task completed successfully"
              : state === "timeout"
                ? "Task timed out while waiting"
                : state === "cancelled"
                  ? "Task cancelled"
                  : `Task failed${task.error ? `: ${task.error}` : ""}`,
          metadata,
        },
      };
      if (json.meta.exit_code === undefined) delete json.meta.exit_code;
      if (includeOutput) {
        json.data.output = {
          included: true,
          stdout: tOut.text,
          stderr: tErr.text,
          truncated: tOut.truncated || tErr.truncated,
          max_bytes: maxBytes,
        };
        if (tOut.truncated || tErr.truncated) {
          json.data.output.original_size =
            (tOut.original || 0) + (tErr.original || 0);
        }
      } else {
        json.data.output = {
          included: false,
          reason: "Output excluded by default (use include_output=true)",
          truncated: false,
          max_bytes: 0,
        };
      }
      return { content: [{ type: "text", text: JSON.stringify(json) }] };
    }

    // Markdown mode → on completion, show results via local_results
    if (timedOut) {
      return {
        content: [
          {
            type: "text",
            text: `⏱️ Timed out waiting for task ${input.task_id} after ${timeoutSec}s.`,
          },
        ],
        isError: true,
      };
    }
    const results = new LocalResultsTool();
    return await results.execute({ task_id: input.task_id });
  }
}
