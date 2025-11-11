/**
 * Status Tool - Monitor Active Codex Sessions
 *
 * Provides information about:
 * - Active Codex processes
 * - Process queue status
 * - Recent session logs
 */

import { ProcessManager } from '../executor/process_manager.js';

export interface StatusToolInput {
  // No input required - returns current status
}

export interface StatusToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

export class StatusTool {
  private processManager: ProcessManager;

  constructor(processManager: ProcessManager) {
    this.processManager = processManager;
  }

  /**
   * Execute the status tool
   */
  async execute(_input: StatusToolInput): Promise<StatusToolResult> {
    const stats = this.processManager.getStats();

    let message = `📊 Codex Control Status\n\n`;
    message += `**Active Processes**: ${stats.activeProcesses}\n`;
    message += `**Queued Tasks**: ${stats.queued}\n`;
    message += `**Running Tasks**: ${stats.running}\n`;
    message += `**Max Concurrency**: ${stats.maxConcurrency}\n\n`;

    if (stats.activeProcesses === 0 && stats.queued === 0) {
      message += `✅ No active Codex tasks\n`;
    } else if (stats.running >= stats.maxConcurrency) {
      message += `⚠️ At max concurrency. New tasks will queue.\n`;
    } else {
      message += `✅ Ready to accept more tasks\n`;
    }

    // Add usage tips
    message += `\n**Available Tools**:\n`;
    message += `- \`codex_run\` - Execute read-only tasks (analysis, tests)\n`;
    message += `- \`codex_plan\` - Preview changes without executing\n`;
    message += `- \`codex_apply\` - Apply file modifications (requires confirm=true)\n`;
    message += `- \`codex_status\` - View this status\n`;

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
   * Get tool schema for MCP registration
   */
  static getSchema() {
    return {
      name: 'codex_status',
      description: 'Get status of Codex Control MCP server, including active processes and queue status',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    };
  }
}
