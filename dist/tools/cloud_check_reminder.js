import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
const TASK_REGISTRY_PATH = join(
  homedir(),
  ".config",
  "codex-control",
  "cloud-tasks.json",
);
export class CloudCheckReminderTool {
  static getSchema() {
    return {
      name: "codex_cloud_check_reminder",
      description:
        "Check for pending Codex Cloud tasks and get Web UI links for status checking. Lists all submitted tasks with their details and provides direct links to check completion status. Use this periodically to monitor long-running Cloud tasks.",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    };
  }
  async execute() {
    try {
      // Load task registry
      const data = await readFile(TASK_REGISTRY_PATH, "utf-8");
      const tasks = JSON.parse(data);
      // Filter pending tasks
      const pendingTasks = tasks
        .filter((t) => t.status === "submitted")
        .map((t) => {
          const submittedTime = new Date(t.timestamp);
          const now = new Date();
          const minutesAgo = Math.floor(
            (now.getTime() - submittedTime.getTime()) / 60000,
          );
          return {
            taskId: t.taskId,
            envId: t.envId,
            task: t.task.substring(0, 100) + (t.task.length > 100 ? "..." : ""),
            submittedAt: t.timestamp,
            checkUrl: `https://chatgpt.com/codex/tasks/${t.taskId}`,
            minutesAgo,
          };
        });
      const pendingCount = pendingTasks.length;
      if (pendingCount === 0) {
        return {
          content: [
            {
              type: "text",
              text: "✅ No pending Cloud tasks. All submitted tasks have been checked or completed.",
            },
          ],
        };
      }
      // Format pending tasks as text
      let message = `## ⏳ Pending Cloud Tasks\n\n`;
      message += `**Count**: ${pendingCount} task${pendingCount === 1 ? "" : "s"}\n\n`;
      message += `### Tasks:\n\n`;
      for (const t of pendingTasks) {
        const timeAgo =
          t.minutesAgo < 60
            ? `${t.minutesAgo}m ago`
            : `${Math.floor(t.minutesAgo / 60)}h ${t.minutesAgo % 60}m ago`;
        message += `**${t.taskId}**\n`;
        message += `- Environment: ${t.envId}\n`;
        message += `- Task: ${t.task}\n`;
        message += `- Submitted: ${timeAgo}\n`;
        message += `- Check Status: ${t.checkUrl}\n\n`;
      }
      message += `\n💡 Click the links above to check task status in Codex Cloud Web UI.`;
      return {
        content: [{ type: "text", text: message }],
      };
    } catch (error) {
      // Registry file doesn't exist or is empty
      if (error.code === "ENOENT") {
        return {
          content: [
            {
              type: "text",
              text: "✅ No Cloud tasks have been submitted yet.\n\n💡 Use `codex_cloud_submit` to submit your first task.",
            },
          ],
        };
      }
      throw error;
    }
  }
}
//# sourceMappingURL=cloud_check_reminder.js.map
