/**
 * Unified Status Tool - Process Manager + Task Registry
 *
 * Shows both real-time process state AND persistent task history.
 * Consolidates codex_cli_status and codex_local_status into one tool.
 */

import { ProcessManager } from "../executor/process_manager.js";
import { globalTaskRegistry } from "../state/task_registry.js";
import type { Task } from "../state/task_registry.js";

export interface LocalStatusToolInput {
  workingDir?: string;
  showAll?: boolean; // Show all tasks, not just current directory
  limit?: number; // Limit for recently completed (default 5)
  format?: "json" | "markdown";
}

export interface LocalStatusToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

export class LocalStatusTool {
  private processManager: ProcessManager;

  constructor(processManager: ProcessManager) {
    this.processManager = processManager;
  }

  async execute(input: LocalStatusToolInput): Promise<LocalStatusToolResult> {
    const workingDir = input.workingDir || process.cwd();
    const showAll = input.showAll ?? true; // Default to true (Issue 3.2 fix)
    const preferredFormat: "json" | "markdown" = input.format || "markdown";
    const limit =
      typeof input.limit === "number" && input.limit > 0 ? input.limit : 5;

    // JSON mode (status_snapshot)
    if (preferredFormat === "json") {
      const allTasks = globalTaskRegistry.queryTasks({
        origin: "local",
        workingDir: showAll ? undefined : workingDir,
      });

      const runningTasks = allTasks.filter((t: Task) => t.status === "working");
      const queuedTasks = allTasks.filter((t: Task) => t.status === "pending");
      const completedTasksAll = allTasks.filter(
        (t: Task) =>
          t.status === "completed" ||
          t.status === "completed_with_warnings" ||
          t.status === "completed_with_errors",
      );
      const recentlyCompleted = completedTasksAll
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
        .slice(0, limit);

      const json: any = {
        version: "3.6",
        schema_id: "codex/v3.6/status_snapshot/v1",
        tool: "_codex_local_status",
        tool_category: "status_snapshot",
        request_id: (await import("crypto")).randomUUID(),
        ts: new Date().toISOString(),
        status: "ok",
        meta: {
          snapshot_ts: new Date().toISOString(),
          total: allTasks.length,
        },
        data: {
          summary: {
            running: runningTasks.length,
            queued: queuedTasks.length,
            recently_completed: completedTasksAll.length,
          },
        },
      };

      if (runningTasks.length > 0) {
        json.data.tasks = runningTasks.map((t: Task) => {
          let progress: any = null;
          if (t.progressSteps) {
            try {
              const p = JSON.parse(t.progressSteps);
              progress = {
                percent: p.progressPercentage ?? 0,
                completed_steps: p.completedSteps ?? 0,
                total_steps: p.totalSteps ?? 0,
                current_activity: p.currentAction ?? null,
              };
            } catch {}
          }
          return {
            task_id: t.id,
            state: t.status,
            started_ts: new Date(t.createdAt).toISOString(),
            elapsed_seconds: Math.max(
              0,
              Math.floor((Date.now() - t.createdAt) / 1000),
            ),
            progress,
          };
        });
      }

      if (queuedTasks.length > 0) {
        const sorted = queuedTasks.sort((a, b) => a.createdAt - b.createdAt);
        json.data.queue = sorted.map((t: Task, idx: number) => ({
          task_id: t.id,
          position: idx,
        }));
      }

      if (recentlyCompleted.length > 0) {
        json.data.recently_completed = recentlyCompleted.map((t: Task) => ({
          task_id: t.id,
          state: "completed",
          duration_seconds:
            t.completedAt && t.createdAt
              ? Math.max(0, Math.floor((t.completedAt - t.createdAt) / 1000))
              : undefined,
          completed_ts: t.completedAt
            ? new Date(t.completedAt).toISOString()
            : undefined,
        }));
        json.data.recently_completed.forEach((x: any) => {
          if (x.duration_seconds === undefined) delete x.duration_seconds;
          if (x.completed_ts === undefined) delete x.completed_ts;
        });
      }

      return { content: [{ type: "text", text: JSON.stringify(json) }] };
    }

    let message = `## 📊 Codex Execution Status\n\n`;

    // ========================================
    // SECTION 1: Active Processes (Process Manager)
    // ========================================
    const processStatus = this.processManager.getStats();

    message += `### Active Processes (MCP Server)\n\n`;

    if (processStatus.activeProcesses === 0 && processStatus.queued === 0) {
      message += `✅ No active processes or queued tasks\n\n`;
    } else {
      message += `**Active Processes**: ${processStatus.activeProcesses}\n`;
      message += `**Queued Tasks**: ${processStatus.queued}\n`;
      message += `**Running Tasks**: ${processStatus.running}\n`;
      message += `**Concurrency Limit**: ${processStatus.maxConcurrency}\n\n`;

      if (processStatus.running > 0) {
        message += `🔄 ${processStatus.running} task(s) currently running\n\n`;
      }

      if (processStatus.queued > 0) {
        message += `⏳ ${processStatus.queued} task(s) queued\n\n`;
      }
    }

    // ========================================
    // SECTION 2: Task Registry (Persistent)
    // ========================================
    message += `### Task Registry (Persistent)\n\n`;

    const tasks = globalTaskRegistry.queryTasks({
      origin: "local",
      workingDir: showAll ? undefined : workingDir,
    });

    if (tasks.length === 0) {
      message += showAll
        ? `No tasks found in registry.\n\n`
        : `No tasks found for directory: ${workingDir}\n\n💡 Set \`showAll: true\` to see tasks from all directories (default behavior).\n\n`;
    } else {
      message += `**Working Dir**: ${workingDir}\n\n`;

      const runningTasks = tasks.filter((t: Task) => t.status === "working");
      const completedTasks = tasks
        .filter((t: Task) => t.status === "completed")
        .slice(-10); // Last 10
      const failedTasks = tasks
        .filter((t: Task) => t.status === "failed")
        .slice(-5); // Last 5

      message += `**Running**: ${runningTasks.length}\n`;
      message += `**Completed**: ${tasks.filter((t: Task) => t.status === "completed").length} (showing last ${Math.min(completedTasks.length, 10)})\n`;
      message += `**Failed**: ${tasks.filter((t: Task) => t.status === "failed").length} (showing last ${Math.min(failedTasks.length, 5)})\n\n`;

      // Running tasks
      if (runningTasks.length > 0) {
        message += `#### 🔄 Running Tasks\n\n`;
        for (const task of runningTasks) {
          const elapsed = Math.floor((Date.now() - task.createdAt) / 1000);
          message += `**${task.id}**:\n`;
          message += `- Task: ${task.instruction.substring(0, 80)}${task.instruction.length > 80 ? "..." : ""}\n`;
          message += `- Mode: ${task.mode || "N/A"}\n`;
          message += `- Elapsed: ${elapsed}s\n`;

          // Show progress if available
          if (task.progressSteps) {
            try {
              const progress = JSON.parse(task.progressSteps);
              message += `- Progress: ${progress.progressPercentage}% (${progress.completedSteps}/${progress.totalSteps} steps)\n`;
              if (progress.currentAction) {
                message += `- Current: ${progress.currentAction}\n`;
              }
              message += `- Activity: ${progress.filesChanged} file(s) changed, ${progress.commandsExecuted} command(s) executed\n`;
            } catch (e) {
              // Ignore parse errors for progress display
            }
          }

          message += "\n";
        }
      }

      // Recently completed tasks
      if (completedTasks.length > 0) {
        message += `#### ✅ Recently Completed\n\n`;
        for (const task of completedTasks) {
          const ago = this.formatTimeAgo(new Date(task.createdAt));
          message += `- **${task.id}**: ${task.instruction.substring(0, 60)}${task.instruction.length > 60 ? "..." : ""} (${ago})\n`;
        }
        message += "\n";
      }

      // Failed tasks
      if (failedTasks.length > 0) {
        message += `#### ❌ Recent Failures\n\n`;
        for (const task of failedTasks) {
          const ago = this.formatTimeAgo(new Date(task.createdAt));
          message += `- **${task.id}**: ${task.instruction.substring(0, 60)}${task.instruction.length > 60 ? "..." : ""} (${ago})\n`;
          if (task.error) {
            message += `  Error: ${task.error.substring(0, 100)}\n`;
          }
        }
        message += "\n";
      }
    }

    // ========================================
    // SECTION 3: Usage Tips
    // ========================================
    message += `### 💡 Usage Tips\n\n`;
    message += `- **Check results**: Use \`codex_local_results\` with task ID\n`;
    message += `- **Filter by directory**: Set \`showAll: false\` + \`workingDir: "/path/to/project"\`\n`;
    message += `- **Cloud tasks**: Use \`codex_cloud_check_reminder\` for cloud status\n`;
    message += `- **Note**: MCP server can't auto-detect your current directory (shows all by default)\n`;

    return {
      content: [
        {
          type: "text",
          text: message,
        },
      ],
    };
  }

  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  static getSchema() {
    return {
      name: "_codex_local_status",
      description:
        "Check what's running locally - like opening Task Manager. Shows you everything: active Codex processes (with PIDs and queue position), completed tasks, failed attempts, and current concurrency limits. Use this when: you want to see if tasks are stuck, check queue depth, debug concurrency issues, or find task IDs for recent work. Think of it as your local execution dashboard. Returns: process states, task registry entries, and timing information. Perfect for: troubleshooting slow execution, finding that task you ran 5 minutes ago, or checking if the queue is backed up.",
      inputSchema: {
        type: "object",
        properties: {
          workingDir: {
            type: "string",
            description:
              "Working directory to filter tasks by. Defaults to current directory. Only affects task registry section.",
          },
          showAll: {
            type: "boolean",
            default: true,
            description:
              "Show all tasks from all directories (default: true). Set to false with workingDir to filter by specific directory. Note: MCP server cannot auto-detect user's current directory.",
          },
          limit: {
            type: "number",
            default: 5,
            description: "Limit for recently_completed array (default 5).",
          },
          format: {
            type: "string",
            enum: ["json", "markdown"],
            default: "markdown",
            description:
              "Response format. Default markdown for backward compatibility.",
          },
        },
      },
    };
  }
}
