/**
 * Status Tool - Monitor Active Codex Sessions
 *
 * Provides information about:
 * - Active Codex processes (CLI-based and SDK-based)
 * - Process queue status
 * - System-wide process detection
 */

import { spawn } from 'child_process';
import { ProcessManager } from '../executor/process_manager.js';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
   * Detect all codex processes running on the system
   * Includes both ProcessManager-tracked and SDK-spawned processes
   */
  private async detectSystemProcesses(): Promise<Array<{
    pid: string;
    cpu: string;
    mem: string;
    started: string;
    command: string;
  }>> {
    return new Promise((resolve) => {
      const proc = spawn('ps', ['aux']);
      let output = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', () => {
        const lines = output.split('\n');
        const codexProcesses = lines
          .filter(line => line.includes('codex exec'))
          .filter(line => !line.includes('grep'))
          .map(line => {
            const parts = line.split(/\s+/);
            return {
              pid: parts[1] || 'unknown',
              cpu: parts[2] || '0',
              mem: parts[3] || '0',
              started: parts[8] || 'unknown',
              command: parts.slice(10).join(' ').substring(0, 80)
            };
          });

        resolve(codexProcesses);
      });

      proc.on('error', () => {
        // If ps fails, return empty array
        resolve([]);
      });
    });
  }

  /**
   * Execute the status tool
   */
  async execute(_input: StatusToolInput): Promise<StatusToolResult> {
    const stats = this.processManager.getStats();
    const systemProcesses = await this.detectSystemProcesses();

    // Calculate total processes (CLI-tracked + SDK-spawned)
    const totalProcesses = systemProcesses.length;
    const sdkProcesses = Math.max(0, totalProcesses - stats.activeProcesses);

    let message = `📊 Codex Control Status\n\n`;
    message += `**Total Codex Processes**: ${totalProcesses}\n`;
    message += `  - CLI-tracked: ${stats.activeProcesses}\n`;
    message += `  - SDK-spawned: ${sdkProcesses}\n`;
    message += `**Queued Tasks**: ${stats.queued}\n`;
    message += `**Running Tasks**: ${stats.running}\n`;
    message += `**Max Concurrency**: ${stats.maxConcurrency}\n\n`;

    // System-wide process details
    if (systemProcesses.length > 0) {
      message += `**System-Wide Process Details**:\n`;
      for (const proc of systemProcesses) {
        message += `- PID ${proc.pid} | Started ${proc.started} | CPU ${proc.cpu}% | Mem ${proc.mem}%\n`;
        message += `  ${proc.command}\n`;
      }
      message += `\n`;
    }

    // Status indicators
    if (totalProcesses === 0 && stats.queued === 0) {
      message += `✅ No active Codex tasks\n`;
    } else if (sdkProcesses > 0) {
      message += `⚠️ Detected ${sdkProcesses} SDK-spawned process(es) - not tracked by ProcessManager\n`;
      message += `💡 SDK processes are spawned by codex_local_exec and codex_local_resume\n`;
    } else if (stats.running >= stats.maxConcurrency) {
      message += `⚠️ At max concurrency. New tasks will queue.\n`;
    } else {
      message += `✅ Ready to accept more tasks\n`;
    }

    // Add usage tips
    message += `\n**Available Tools** (13 total):\n`;
    message += `\n**Local CLI Execution**:\n`;
    message += `- \`codex_run\` - Execute read-only tasks (analysis, tests)\n`;
    message += `- \`codex_plan\` - Preview changes without executing\n`;
    message += `- \`codex_apply\` - Apply file modifications (requires confirm=true)\n`;
    message += `- \`codex_status\` - View this status\n`;
    message += `\n**Local SDK Execution** (streaming, thread persistence):\n`;
    message += `- \`codex_local_exec\` - Real-time streaming execution with thread ID\n`;
    message += `- \`codex_local_resume\` - Resume previous thread for follow-up tasks\n`;
    message += `\n**Cloud Execution** (background, sandboxed):\n`;
    message += `- \`codex_cloud_submit\` - Submit task to Codex Cloud\n`;
    message += `- \`codex_cloud_list_tasks\` - List all tracked cloud tasks\n`;
    message += `- \`codex_cloud_status\` - Check cloud task status\n`;
    message += `- \`codex_cloud_results\` - Get cloud task results\n`;
    message += `- \`codex_cloud_check_reminder\` - Check for pending cloud tasks\n`;
    message += `\n**Configuration & Setup**:\n`;
    message += `- \`codex_cloud_list_environments\` - List available Codex Cloud environments\n`;
    message += `- \`codex_cloud_github_setup\` - Generate GitHub integration guide\n`;

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
      name: 'codex_cli_status',
      description: 'Get status of local Codex CLI execution, including active processes and queue status',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    };
  }
}
