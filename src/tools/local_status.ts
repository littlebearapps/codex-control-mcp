/**
 * Unified Status Tool - Process Manager + Task Registry
 *
 * Shows both real-time process state AND persistent task history.
 * Consolidates codex_cli_status and codex_local_status into one tool.
 */

import { ProcessManager } from '../executor/process_manager.js';
import { localTaskRegistry } from '../state/local_task_registry.js';
import { LocalTask } from '../state/local_task_registry.js';

export interface LocalStatusToolInput {
  workingDir?: string;
  showAll?: boolean; // Show all tasks, not just current directory
}

export interface LocalStatusToolResult {
  content: Array<{
    type: 'text';
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
    const showAll = input.showAll || false;

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

    const allTasksInWorkingDir = localTaskRegistry.getAllTasks(workingDir);
    const tasks = showAll ? localTaskRegistry.getAllTasks() : allTasksInWorkingDir;

    if (tasks.length === 0) {
      message += showAll
        ? `No tasks found in registry.\n\n`
        : `No tasks found for current directory.\n\n💡 Use \`showAll: true\` to see all tasks.\n\n`;
    } else {
      message += `**Working Dir**: ${workingDir}\n\n`;

      const runningTasks = tasks.filter((t: LocalTask) => t.status === 'running');
      const completedTasks = tasks.filter((t: LocalTask) => t.status === 'completed').slice(-10); // Last 10
      const failedTasks = tasks.filter((t: LocalTask) => t.status === 'failed').slice(-5); // Last 5

      message += `**Running**: ${runningTasks.length}\n`;
      message += `**Completed**: ${tasks.filter((t: LocalTask) => t.status === 'completed').length} (showing last ${Math.min(completedTasks.length, 10)})\n`;
      message += `**Failed**: ${tasks.filter((t: LocalTask) => t.status === 'failed').length} (showing last ${Math.min(failedTasks.length, 5)})\n\n`;

      // Running tasks
      if (runningTasks.length > 0) {
        message += `#### 🔄 Running Tasks\n\n`;
        for (const task of runningTasks) {
          const elapsed = Math.floor((Date.now() - new Date(task.submittedAt).getTime()) / 1000);
          message += `**${task.taskId}**:\n`;
          message += `- Task: ${task.task.substring(0, 80)}${task.task.length > 80 ? '...' : ''}\n`;
          message += `- Mode: ${task.mode || 'N/A'}\n`;
          message += `- Elapsed: ${elapsed}s ago\n`;
          message += '\n';
        }
      }

      // Recently completed tasks
      if (completedTasks.length > 0) {
        message += `#### ✅ Recently Completed\n\n`;
        for (const task of completedTasks) {
          const ago = this.formatTimeAgo(new Date(task.submittedAt));
          message += `- **${task.taskId}**: ${task.task.substring(0, 60)}${task.task.length > 60 ? '...' : ''} (${ago})\n`;
        }
        message += '\n';
      }

      // Failed tasks
      if (failedTasks.length > 0) {
        message += `#### ❌ Recent Failures\n\n`;
        for (const task of failedTasks) {
          const ago = this.formatTimeAgo(new Date(task.submittedAt));
          message += `- **${task.taskId}**: ${task.task.substring(0, 60)}${task.task.length > 60 ? '...' : ''} (${ago})\n`;
          if (task.error) {
            message += `  Error: ${task.error.substring(0, 100)}\n`;
          }
        }
        message += '\n';
      }
    }

    // ========================================
    // SECTION 3: Usage Tips
    // ========================================
    message += `### 💡 Usage Tips\n\n`;
    message += `- **Check results**: Use \`codex_local_results\` with task ID\n`;
    message += `- **See all tasks**: Set \`showAll: true\` parameter\n`;
    message += `- **Cloud tasks**: Use \`codex_cloud_check_reminder\` for cloud status\n`;

    return {
      content: [
        {
          type: 'text',
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
      name: '_codex_local_status',
      description:
        'Check what\'s running locally - like opening Task Manager. Shows you everything: active Codex processes (with PIDs and queue position), completed tasks, failed attempts, and current concurrency limits. Use this when: you want to see if tasks are stuck, check queue depth, debug concurrency issues, or find task IDs for recent work. Think of it as your local execution dashboard. Returns: process states, task registry entries, and timing information. Perfect for: troubleshooting slow execution, finding that task you ran 5 minutes ago, or checking if the queue is backed up.',
      inputSchema: {
        type: 'object',
        properties: {
          workingDir: {
            type: 'string',
            description:
              'Working directory to filter tasks by. Defaults to current directory. Only affects task registry section.',
          },
          showAll: {
            type: 'boolean',
            default: false,
            description:
              'Show all tasks from all directories (default: false, shows only current directory tasks)',
          },
        },
      },
    };
  }
}
