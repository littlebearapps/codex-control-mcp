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

export interface CloudSubmitInput {
  task: string;
  envId: string;
  attempts?: number;
  model?: string;
}

export interface CloudStatusInput {
  taskId?: string;
  showAll?: boolean;
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
}

export class CloudSubmitTool {
  /**
   * Submit a task to Codex Cloud for background execution
   */
  async execute(input: CloudSubmitInput): Promise<CloudToolResult> {
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
      let message = `🚀 Task Submitted to Codex Cloud\n\n`;

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
   * Execute codex cloud command
   */
  private runCodexCloud(args: string[]): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn('codex', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (exitCode) => {
        resolve({
          success: exitCode === 0,
          stdout,
          stderr,
          exitCode: exitCode ?? 1,
        });
      });

      proc.on('error', (error) => {
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
      name: 'codex_cloud_submit',
      description: `Submit a task to Codex Cloud for background execution. Task runs in sandboxed cloud container and continues even if Claude Code closes.

PREREQUISITES:
- Environment configured at https://chatgpt.com/codex/settings/environments
- Environment must have repository URL and default branch
- For GitHub operations: GITHUB_TOKEN secret configured (see MCP resources for setup templates)

WORKFLOW:
1. Get environment ID from user or list environments with codex_cloud_list_tasks
2. Write detailed task description:
   - Specify exact branch name (e.g., "feature/user-authentication")
   - List testing requirements explicitly
   - Define success criteria
   - Include PR title and description if creating PR
3. Submit task (takes 1-5 seconds, then runs in background)
4. Task continues even if Claude Code closes (5-30 min typical)
5. Check results with codex_cloud_list_tasks or codex_cloud_status

TASK DESCRIPTION BEST PRACTICES:
✓ "Create feature branch 'feature/add-auth' from main, implement JWT authentication, add tests, create PR titled 'Add JWT Authentication'"
✗ "Add authentication" (too vague)

GITHUB CAPABILITIES (with proper setup):
✓ Read repository code
✓ Create feature branches
✓ Commit and push changes
✓ Create and update pull requests
✓ View CI test results
✗ Merge PRs (requires manual approval)

SETUP GITHUB (one-time per environment):
- Visit environment settings to configure GITHUB_TOKEN secret
- Test with simple branch creation task`,
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
        },
        required: ['task', 'envId'],
      },
    };
  }
}

export class CloudStatusTool {
  /**
   * Check status of cloud tasks
   */
  async execute(input: CloudStatusInput): Promise<CloudToolResult> {
    try {
      let message = `📊 Codex Cloud Task Status\n\n`;

      if (input.taskId) {
        // Try to get task from registry
        const task = await globalTaskRegistry.getTask(input.taskId);

        if (task) {
          message += `**Task ID**: ${input.taskId}\n`;
          message += `**Status**: ${task.status} (last tracked)\n\n`;

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
          message += `**Task ID**: ${input.taskId}\n`;
          message += `⚠️ Task not found in local registry (may have been submitted elsewhere)\n\n`;
        }

        message += `**Check Real-Time Status**:\n`;
        message += `1. **Web UI**: https://chatgpt.com/codex/tasks/${input.taskId}\n`;
        message += `2. **CLI**: Run \`codex cloud\` and search for task ID\n`;
        message += `3. **Mobile**: Open ChatGPT app → Codex → Tasks\n\n`;
      } else {
        message += `**View All Tasks**:\n`;
        message += `1. **Tracked Locally**: Use \`codex_cloud_list_tasks\`\n`;
        message += `2. **Web UI**: https://chatgpt.com/codex\n`;
        message += `3. **CLI**: Run \`codex cloud\` (interactive browser)\n`;
        message += `4. **Mobile**: ChatGPT app → Codex → Tasks\n\n`;
      }

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
      name: 'codex_cloud_status',
      description: `Check status of Codex Cloud tasks. Provides links to web UI and instructions for viewing task status.

USAGE:
- Check specific task: Provide taskId from codex_cloud_submit
- Check all tasks: Set showAll=true to see task list

WORKFLOW:
1. Get task ID from codex_cloud_submit response
2. Check status to see if task is still running
3. View results with codex_cloud_results when completed

STATUS VALUES:
- "submitted": Task is queued or running
- "completed": Task finished successfully
- "failed": Task encountered error
- "cancelled": Task was manually stopped

WEB UI:
- View task details at https://chatgpt.com/codex
- See full logs, diffs, and PR links (if created)
- Monitor real-time progress`,
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Specific task ID to check (from codex_cloud_submit)',
          },
          showAll: {
            type: 'boolean',
            description: 'Show all tasks instead of specific task',
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
      name: 'codex_cloud_results',
      description: `Get results of a completed Codex Cloud task. Provides links to view output, diffs, and PRs created by the task.

USAGE:
- Get task ID from codex_cloud_submit response
- Check status with codex_cloud_status to verify completion
- Retrieve results once status is "completed"

RESULTS INCLUDE:
- Task summary (what was accomplished)
- Files modified (with diffs if available)
- Commands executed
- Pull request links (if PR was created)
- CI test results (if tests were run)
- Error messages (if task failed)

GITHUB PR WORKFLOW:
1. Task creates feature branch
2. Code changes are committed
3. PR is created automatically
4. View PR link in results
5. Check CI status in results
6. Manually review and merge PR

WEB UI:
- Full results at https://chatgpt.com/codex/tasks/{taskId}
- View complete logs, file diffs, and output
- Download artifacts if available`,
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

export interface CloudListTasksInput {
  workingDir?: string;
  envId?: string;
  status?: 'submitted' | 'completed' | 'failed' | 'cancelled';
  limit?: number;
  showStats?: boolean;
}

export class CloudListTasksTool {
  /**
   * List tracked cloud tasks with optional filtering
   */
  async execute(input: CloudListTasksInput = {}): Promise<CloudToolResult> {
    try {
      const filter: CloudTaskFilter = {
        workingDir: input.workingDir || process.cwd(), // Default to current directory
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
        message += `- Check status: \`codex_cloud_status\` with taskId\n`;
        message += `- Get results: \`codex_cloud_results\` with taskId\n`;
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
      name: 'codex_cloud_list_tasks',
      description: `List all tracked Codex Cloud tasks. Automatically filters by current working directory. Shows task history with status, timestamps, and web UI links. Tasks persist across Claude Code restarts.

USAGE:
- List all tasks: Call without parameters
- Filter by project: Set workingDir to specific project path
- Filter by environment: Set envId
- Filter by status: Use "submitted", "completed", "failed", or "cancelled"
- Show statistics: Set showStats=true for aggregate metrics

FILTERING OPTIONS:
- workingDir: See tasks for specific project (defaults to current directory)
- envId: See tasks for specific Codex Cloud environment
- status: See only tasks in specific state
- limit: Control how many tasks to return (default: 50)

TASK INFORMATION INCLUDES:
- Task ID (for codex_cloud_status and codex_cloud_results)
- Submit timestamp
- Current status
- Environment ID
- Task description
- Web UI link

USE CASES:
- Check recent task submissions
- Find task ID for follow-up queries
- Monitor task completion rates
- Debug failed tasks
- Track project activity

STATISTICS (showStats=true):
- Total tasks submitted
- Completion rate
- Average execution time
- Failed task count`,
      inputSchema: {
        type: 'object',
        properties: {
          workingDir: {
            type: 'string',
            description:
              'Filter by working directory. Defaults to current directory. Use to see tasks from specific projects.',
          },
          envId: {
            type: 'string',
            description: 'Filter by Codex Cloud environment ID.',
          },
          status: {
            type: 'string',
            enum: ['submitted', 'completed', 'failed', 'cancelled'],
            description: 'Filter by task status.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of tasks to return (default: 50).',
            default: 50,
          },
          showStats: {
            type: 'boolean',
            description: 'Include statistics about all tracked tasks (default: false).',
            default: false,
          },
        },
      },
    };
  }
}
