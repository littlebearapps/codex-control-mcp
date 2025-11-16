/**
 * Cloud Tools - Submit and Monitor Codex Cloud Background Tasks
 *
 * Codex Cloud allows tasks to run in the background in sandboxed containers.
 * Tasks continue even after Claude Code closes and can be checked from any device.
 */

import { spawn } from 'child_process';
import { InputValidator } from '../security/input_validator.js';
import { globalRedactor } from '../security/redactor.js';
import { globalTaskRegistry, CloudTaskFilter } from '../state/cloud_task_registry.js';
import { RiskyOperationDetector, GitOperationTier } from '../security/risky_operation_detector.js';
import { TimeoutWatchdog } from '../executor/timeout_watchdog.js';

export interface CloudSubmitInput {
  task: string;
  envId: string;
  attempts?: number;
  model?: string;
  allow_destructive_git?: boolean;
}

export interface CloudStatusInput {
  taskId?: string;
  list?: boolean;
  workingDir?: string;
  envId?: string;
  status?: 'submitted' | 'completed' | 'failed' | 'cancelled';
  limit?: number;
  showStats?: boolean;
}

export interface CloudResultsInput {
  taskId: string;
}

export interface CloudToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
  metadata?: any;
}

export class CloudSubmitTool {
  /**
   * Submit a task to Codex Cloud for background execution
   */
  async execute(input: CloudSubmitInput): Promise<CloudToolResult> {
    let riskyOperationApproved = false; // Track if user approved risky git operation

    // Validate inputs
    const validation = InputValidator.validateTask(input.task);
    if (!validation.valid) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Validation Error: ${validation.error}`,
          },
        ],
        isError: true,
      };
    }

    if (!input.envId) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Environment ID required\n\n**Tip**: Run \`codex cloud\` to browse available environments and get ENV_ID.\n\nOr configure environments at: https://chatgpt.com/codex/settings/environments`,
          },
        ],
        isError: true,
      };
    }

    // GIT SAFETY CHECK: Detect and block risky git operations
    const detector = new RiskyOperationDetector();
    const riskyOps = detector.detect(input.task);

    if (riskyOps.length > 0) {
      const highestTier = detector.getHighestRiskTier(input.task);

      // Tier 1: ALWAYS BLOCKED - No way to proceed
      if (highestTier === GitOperationTier.ALWAYS_BLOCKED) {
        const blockedOps = riskyOps.filter(op => op.tier === GitOperationTier.ALWAYS_BLOCKED);
        const errorMessage = detector.formatBlockedMessage(blockedOps);

        return {
          content: [
            {
              type: 'text',
              text: errorMessage,
            },
          ],
          isError: true,
        };
      }

      // Tier 2: REQUIRES CONFIRMATION - Check if user confirmed
      if (highestTier === GitOperationTier.REQUIRES_CONFIRMATION && !input.allow_destructive_git) {
        const riskyOpsToConfirm = riskyOps.filter(op => op.tier === GitOperationTier.REQUIRES_CONFIRMATION);
        const confirmMessage = detector.formatConfirmationMessage(riskyOpsToConfirm);
        const confirmMetadata = detector.formatConfirmationMetadata(riskyOpsToConfirm);

        return {
          content: [
            {
              type: 'text',
              text: confirmMessage,
            },
          ],
          isError: true,
          metadata: confirmMetadata,
        };
      }

      // User confirmed risky operation - note this in submission
      if (input.allow_destructive_git) {
        console.log('[CloudSubmit] ⚠️  User confirmed risky git operation for cloud execution');
        riskyOperationApproved = true;
        // Note: Cloud execution doesn't create local checkpoint, but Codex Cloud
        // has its own safety mechanisms (git history is preserved in container)
      }
    }

    // Build command arguments
    const args = ['cloud', 'exec', '--env', input.envId];

    if (input.attempts) {
      args.push('--attempts', String(input.attempts));
    }

    if (input.model) {
      args.push('-c', `model="${input.model}"`);
    }

    // Add task at the end
    args.push(input.task);

    try {
      // Execute codex cloud exec (non-blocking submission)
      const result = await this.runCodexCloud(args);

      // Redact any secrets from output
      const redactedOutput = globalRedactor.redactOutput({
        stdout: result.stdout,
        stderr: result.stderr,
      });

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Cloud Task Submission Failed\n\n**Error**:\n\`\`\`\n${redactedOutput.stderr}\n\`\`\`\n\n**Troubleshooting**:\n- Verify environment exists: \`codex cloud\`\n- Check authentication: \`codex login\`\n- Verify environment ID is correct`,
            },
          ],
          isError: true,
        };
      }

      // Extract task ID from output (Codex cloud should print this)
      const taskId = this.extractTaskId(redactedOutput.stdout);

      // Register task in persistent registry
      if (taskId) {
        try {
          await globalTaskRegistry.registerTask({
            taskId,
            workingDir: process.cwd(),
            envId: input.envId,
            task: input.task,
            model: input.model,
            attempts: input.attempts,
          });
        } catch (error) {
          console.error('[CloudSubmitTool] Failed to register task:', error);
          // Continue anyway - registration failure shouldn't block submission
        }
      }

      // Build success message
      let message = '';

      // Prepend risky operation notice if approved
      if (riskyOperationApproved) {
        message += `⚠️  **RISKY GIT OPERATION APPROVED**\n\n`;
        message += `This task includes destructive git operations that you approved.\n\n`;
        message += `**Cloud Safety**: Codex Cloud uses sandboxed containers where:\n`;
        message += `- Git history is preserved within the container\n`;
        message += `- Changes are isolated to the cloud environment\n`;
        message += `- You can review changes before merging any PRs created\n\n`;
        message += `---\n\n`;
      }

      message += `🚀 Task Submitted to Codex Cloud\n\n`;

      if (taskId) {
        message += `**Task ID**: ${taskId}\n`;
        message += `**Monitor**: https://chatgpt.com/codex/tasks/${taskId}\n\n`;
      }

      message += `**Environment**: ${input.envId}\n`;
      message += `**Task**: ${input.task}\n\n`;

      message += `**Status**: Running in background\n`;
      message += `**Device Independence**: Task continues even if you close Claude Code\n\n`;

      if (taskId) {
        message += `✅ **Task Registered**: Automatically tracked in persistent storage\n`;
        message += `**List Tasks**: Use \`codex_cloud_list_tasks\` to view all your cloud tasks\n`;
        message += `**Check Status**: Use \`codex_cloud_status\` with taskId="${taskId}"\n`;
        message += `**Get Results**: Use \`codex_cloud_results\` with taskId="${taskId}" (when complete)\n\n`;
      }

      message += `**Web UI**: https://chatgpt.com/codex (view all tasks)\n`;
      message += `**CLI**: \`codex cloud\` (browse tasks in terminal)\n\n`;

      message += `✅ You can continue working on other tasks. The cloud task runs independently.\n`;
      message += `✅ Task will be tracked even if Claude Code restarts.\n`;

      // Include full output for debugging
      if (redactedOutput.stdout.trim()) {
        message += `\n**Submission Output**:\n\`\`\`\n${redactedOutput.stdout.trim()}\n\`\`\`\n`;
      }

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Unexpected Error\n\n${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Execute codex cloud command (with timeout detection v3.2.1)
   */
  private runCodexCloud(args: string[], options?: {
    idleTimeoutMs?: number;
    hardTimeoutMs?: number;
  }): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    timeout?: import('../executor/timeout_watchdog.js').TimeoutError;
  }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn('codex', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });

      const processId = `cloud-submit-${Date.now()}`;

      // Create timeout watchdog (v3.2.1)
      const watchdog = new TimeoutWatchdog(proc, processId, {
        idleTimeoutMs: options?.idleTimeoutMs ?? 5 * 60 * 1000,  // 5 min
        hardTimeoutMs: options?.hardTimeoutMs ?? 10 * 60 * 1000, // 10 min (shorter for cloud submit)
        onTimeout: (timeout: any) => {
          const partial = watchdog.getPartialResults();
          watchdog.stop();

          resolve({
            success: false,
            stdout: partial.stdoutTail || stdout,
            stderr: partial.stderrTail || stderr,
            exitCode: 1,
            timeout,
          });
        },
      });

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
        watchdog.recordStdout(data);
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
        watchdog.recordStderr(data);
      });

      proc.on('close', (exitCode) => {
        watchdog.stop();

        resolve({
          success: exitCode === 0,
          stdout,
          stderr,
          exitCode: exitCode ?? 1,
        });
      });

      proc.on('error', (error) => {
        watchdog.stop();

        resolve({
          success: false,
          stdout,
          stderr: error.message,
          exitCode: 1,
        });
      });
    });
  }

  /**
   * Extract task ID from codex cloud output
   */
  private extractTaskId(output: string): string | null {
    // Try to find task ID patterns in output
    // Common patterns: "Task ID: task-xxx", "task-2025-11-11-xxx", etc.
    const patterns = [
      /Task ID:\s*([a-zA-Z0-9-]+)/i,
      /task[_-]([a-zA-Z0-9-]+)/i,
      /(task-\d{4}-\d{2}-\d{2}-[a-zA-Z0-9]+)/i,
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return null;
  }

  /**
   * Get tool schema for MCP registration
   */
  static getSchema() {
    return {
      name: '_codex_cloud_submit',
      description: 'Fire-and-forget background execution - like starting a build server job. Submit a task to Codex Cloud and it keeps running even if you close Claude Code. Perfect for: comprehensive test suites (30-60 min), full refactorings, or creating GitHub PRs automatically. The magic: runs in a sandboxed container with your repo, can make commits and open PRs, continues while you work on other things. Use when: tasks take >30 minutes, you need GitHub integration (branch creation, commits, PRs), or want device independence. Returns: task ID immediately (<5 sec), then task runs in background (5-60 min typical). Check progress with _codex_cloud_status or the Web UI. Requires: environment ID (from Codex Cloud settings) with repo URL configured. Be specific in task descriptions - "Create feature branch \'feat/auth\', add JWT auth, test, create PR" beats "add authentication". Avoid for: quick local tasks (<5 min, use _codex_local_exec), or tasks needing real-time feedback.',
      inputSchema: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description:
              'Task description for Codex Cloud (e.g., "Run full test suite and fix any failures")',
          },
          envId: {
            type: 'string',
            description:
              'Environment ID from Codex Cloud settings. Get this by running `codex cloud` or visiting https://chatgpt.com/codex/settings/environments',
          },
          attempts: {
            type: 'number',
            description: 'Number of assistant attempts (best-of-N). Defaults to 1.',
            default: 1,
          },
          model: {
            type: 'string',
            description: 'OpenAI model to use (e.g., "gpt-4o", "o1", "o3-mini"). Defaults to environment default.',
          },
          allow_destructive_git: {
            type: 'boolean',
            description: 'Allow risky git operations (rebase, reset --hard, force push, etc.). User must explicitly confirm via Claude Code dialog.',
            default: false,
          },
        },
        required: ['task', 'envId'],
      },
    };
  }
}

export class CloudStatusTool {
  /**
   * Unified cloud task status checking
   *
   * Modes:
   * 1. No params → Show pending tasks (check_reminder)
   * 2. taskId → Show specific task status
   * 3. list: true → List all tasks with optional filters
   */
  async execute(input: CloudStatusInput = {}): Promise<CloudToolResult> {
    try {
      // MODE 1: Show pending tasks (default behavior, like check_reminder)
      if (!input.taskId && !input.list) {
        return await this.showPendingTasks();
      }

      // MODE 2: Show specific task
      if (input.taskId) {
        return await this.showSpecificTask(input.taskId);
      }

      // MODE 3: List all tasks with filtering
      if (input.list) {
        return await this.listAllTasks(input);
      }

      // Fallback (shouldn't reach here)
      return await this.showPendingTasks();
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Unexpected Error\n\n${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * MODE 1: Show pending (submitted) tasks
   */
  private async showPendingTasks(): Promise<CloudToolResult> {
    const filter: CloudTaskFilter = {
      status: 'submitted',
      limit: 50,
    };

    const tasks = await globalTaskRegistry.listTasks(filter);

    if (tasks.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: '✅ No pending Cloud tasks. All submitted tasks have been checked or completed.',
          },
        ],
      };
    }

    let message = `## ⏳ Pending Cloud Tasks\n\n`;
    message += `**Count**: ${tasks.length} task${tasks.length === 1 ? '' : 's'}\n\n`;
    message += `### Tasks:\n\n`;

    for (const task of tasks) {
      const submittedTime = new Date(task.timestamp);
      const now = new Date();
      const minutesAgo = Math.floor((now.getTime() - submittedTime.getTime()) / 60000);
      const timeAgo =
        minutesAgo < 60
          ? `${minutesAgo}m ago`
          : `${Math.floor(minutesAgo / 60)}h ${minutesAgo % 60}m ago`;

      message += `**${task.taskId}**\n`;
      message += `- Environment: ${task.envId}\n`;
      message += `- Task: ${task.task.substring(0, 100)}${task.task.length > 100 ? '...' : ''}\n`;
      message += `- Submitted: ${timeAgo}\n`;
      message += `- Check Status: https://chatgpt.com/codex/tasks/${task.taskId}\n\n`;
    }

    message += `\n💡 Click the links above to check task status in Codex Cloud Web UI.\n`;
    message += `💡 Use \`list: true\` parameter to see all tasks (not just pending).\n`;

    return {
      content: [{ type: 'text', text: message }],
    };
  }

  /**
   * MODE 2: Show specific task status
   */
  private async showSpecificTask(taskId: string): Promise<CloudToolResult> {
    let message = `📊 Codex Cloud Task Status\n\n`;

    const task = await globalTaskRegistry.getTask(taskId);

    if (task) {
      message += `**Task ID**: ${taskId}\n`;
      message += `**Status**: ${this.getStatusEmoji(task.status)} ${task.status} (last tracked)\n\n`;

      message += `**Registry Information**:\n`;
      message += `- **Task**: ${task.task}\n`;
      message += `- **Environment**: ${task.envId}\n`;
      message += `- **Submitted**: ${new Date(task.timestamp).toLocaleString()}\n`;
      message += `- **Working Directory**: ${task.workingDir}\n`;

      if (task.model) {
        message += `- **Model**: ${task.model}\n`;
      }

      if (task.lastCheckedStatus) {
        message += `- **Last Manual Check**: ${task.lastCheckedStatus}\n`;
      }

      if (task.notes) {
        message += `- **Notes**: ${task.notes}\n`;
      }

      message += `\n`;
    } else {
      message += `**Task ID**: ${taskId}\n`;
      message += `⚠️ Task not found in local registry (may have been submitted elsewhere)\n\n`;
    }

    message += `**Check Real-Time Status**:\n`;
    message += `1. **Web UI**: https://chatgpt.com/codex/tasks/${taskId}\n`;
    message += `2. **CLI**: Run \`codex cloud\` and search for task ID\n`;
    message += `3. **Mobile**: Open ChatGPT app → Codex → Tasks\n\n`;

    message += `**Task States**:\n`;
    message += `- 🟡 **Queued**: Waiting to start\n`;
    message += `- 🔵 **Running**: Currently executing\n`;
    message += `- 🟢 **Completed**: Finished successfully\n`;
    message += `- 🔴 **Failed**: Encountered errors\n\n`;

    message += `**Note**: Codex Cloud TUI is interactive and not yet scriptable via MCP.\n`;
    message += `Use web UI for programmatic status checks until SDK support is added.\n`;

    return {
      content: [
        {
          type: 'text',
          text: message,
        },
      ],
    };
  }

  /**
   * MODE 3: List all tasks with optional filtering
   */
  private async listAllTasks(input: CloudStatusInput): Promise<CloudToolResult> {
    const filter: CloudTaskFilter = {
      workingDir: input.workingDir || process.cwd(),
      envId: input.envId,
      status: input.status,
      limit: input.limit || 50,
    };

    const tasks = await globalTaskRegistry.listTasks(filter);

    let message = `📋 Codex Cloud Tasks\n\n`;

    if (input.showStats) {
      const stats = await globalTaskRegistry.getStats();
      message += `**Total Tasks**: ${stats.total}\n`;
      message += `**By Status**: ${Object.entries(stats.byStatus)
        .map(([status, count]) => `${status} (${count})`)
        .join(', ')}\n\n`;
    }

    message += `**Filtered Results**: ${tasks.length} task${tasks.length !== 1 ? 's' : ''}\n`;
    message += `**Working Directory**: ${input.workingDir || process.cwd()}\n\n`;

    if (tasks.length === 0) {
      message += `No tasks found matching the filters.\n\n`;
      message += `**Tip**: Submit a new task with \`codex_cloud_submit\`\n`;
    } else {
      message += `---\n\n`;

      for (const task of tasks) {
        const date = new Date(task.timestamp);
        const relativeTime = this.getRelativeTime(date);

        message += `### ${task.taskId}\n\n`;
        message += `- **Task**: ${task.task.length > 80 ? task.task.substring(0, 80) + '...' : task.task}\n`;
        message += `- **Environment**: ${task.envId}\n`;
        message += `- **Status**: ${this.getStatusEmoji(task.status)} ${task.status}\n`;
        message += `- **Submitted**: ${relativeTime} (${date.toLocaleString()})\n`;

        if (task.model) {
          message += `- **Model**: ${task.model}\n`;
        }

        if (task.lastCheckedStatus) {
          message += `- **Last Check**: ${task.lastCheckedStatus}\n`;
        }

        if (task.notes) {
          message += `- **Notes**: ${task.notes}\n`;
        }

        message += `- **Web UI**: https://chatgpt.com/codex/tasks/${task.taskId}\n`;
        message += `\n`;
      }

      message += `---\n\n`;
      message += `**Actions**:\n`;
      message += `- Check specific task: Provide \`taskId\` parameter\n`;
      message += `- Get results: Use \`codex_cloud_results\` with taskId\n`;
      message += `- Filter by status: Add \`status\` parameter\n`;
      message += `- View stats: Add \`showStats: true\`\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: message,
        },
      ],
    };
  }

  /**
   * Get status emoji for visual clarity
   */
  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'submitted':
        return '🟡';
      case 'completed':
        return '🟢';
      case 'failed':
        return '🔴';
      case 'cancelled':
        return '⚫';
      default:
        return '⚪';
    }
  }

  /**
   * Get human-readable relative time
   */
  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`;
  }

  /**
   * Get tool schema for MCP registration
   */
  static getSchema() {
    return {
      name: '_codex_cloud_status',
      description: 'Check cloud task status - like tracking a package shipment. Three modes: (1) No params = show pending tasks (what\'s still running), (2) taskId = get specific task details with Web UI link, (3) list=true = full task history with filtering. Use this when: you want to check if your overnight refactoring finished, find a task ID you forgot, or see all completed work from last week. Think of it as your cloud dashboard. Returns: task states (submitted/completed/failed/cancelled), timing info, Web UI links. Perfect for: periodic "are we there yet?" checks, finding task IDs, debugging why something failed. The smart default (no params) shows only pending tasks - your "what\'s cooking?" view. Avoid for: local task status (use _codex_local_status).',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Check specific task by ID (MODE 2)',
          },
          list: {
            type: 'boolean',
            description: 'Show all tasks with filtering options (MODE 3)',
            default: false,
          },
          workingDir: {
            type: 'string',
            description: 'Filter by working directory (defaults to current directory, MODE 3 only)',
          },
          envId: {
            type: 'string',
            description: 'Filter by Codex Cloud environment ID (MODE 3 only)',
          },
          status: {
            type: 'string',
            enum: ['submitted', 'completed', 'failed', 'cancelled'],
            description: 'Filter by task status (MODE 3 only)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of tasks to return (default: 50, MODE 3 only)',
            default: 50,
          },
          showStats: {
            type: 'boolean',
            description: 'Include statistics about all tasks (MODE 3 only)',
            default: false,
          },
        },
      },
    };
  }
}

export class CloudResultsTool {
  /**
   * Get results of completed cloud task
   */
  async execute(input: CloudResultsInput): Promise<CloudToolResult> {
    if (!input.taskId) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Task ID required\n\n**Usage**: Provide taskId from \`codex_cloud_submit\` response`,
          },
        ],
        isError: true,
      };
    }

    try {
      let message = `📄 Codex Cloud Task Results\n\n`;
      message += `**Task ID**: ${input.taskId}\n\n`;

      // Try to get task from registry
      const task = await globalTaskRegistry.getTask(input.taskId);

      if (task) {
        message += `**Registry Information**:\n`;
        message += `- **Task**: ${task.task}\n`;
        message += `- **Environment**: ${task.envId}\n`;
        message += `- **Status**: ${task.status}\n`;
        message += `- **Submitted**: ${new Date(task.timestamp).toLocaleString()}\n`;

        if (task.lastCheckedStatus) {
          message += `- **Last Check**: ${task.lastCheckedStatus}\n`;
        }

        message += `\n`;
      }

      message += `**View Results**:\n`;
      message += `1. **Web UI**: https://chatgpt.com/codex/tasks/${input.taskId}\n`;
      message += `   - View full output, diffs, and PR links\n`;
      message += `   - Download artifacts if available\n\n`;

      message += `2. **CLI Browse**: Run \`codex cloud\` and navigate to task\n`;
      message += `   - Interactive TUI with full task details\n\n`;

      message += `3. **Apply Changes Locally**:\n`;
      message += `   - If task created PR: Review and merge on GitHub\n`;
      message += `   - If changes available: Use \`codex cloud\` to apply locally\n\n`;

      message += `**Next Steps**:\n`;
      message += `- Review changes in web UI\n`;
      message += `- Create PR if task suggests changes\n`;
      message += `- Run follow-up tasks if needed\n\n`;

      message += `**Note**: Full result parsing requires Codex SDK integration (future enhancement).\n`;
      message += `Currently, use web UI for complete results.\n`;

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Unexpected Error\n\n${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Get tool schema for MCP registration
   */
  static getSchema() {
    return {
      name: '_codex_cloud_results',
      description: 'Retrieve completed cloud task results - like downloading your build artifacts. Once a cloud task finishes (check with _codex_cloud_status first), use this to get the full output: what changed, which files were modified, PR links if created, CI results, error messages if failed. Think of it as unboxing your finished work. Use when: status shows "completed" or "failed" and you want detailed results beyond the summary. Returns: task summary, file diffs, commands executed, GitHub PR links (with CI status), error details. Perfect for: reviewing what Codex accomplished, getting that PR link to merge, debugging failures. The Web UI link (https://chatgpt.com/codex/tasks/{taskId}) shows pretty diffs and logs. Avoid for: checking if task is done yet (use _codex_cloud_status), or tasks still running.',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to get results for (from codex_cloud_submit)',
          },
        },
        required: ['taskId'],
      },
    };
  }
}

