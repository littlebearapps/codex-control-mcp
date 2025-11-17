/**
 * Local Results Tool - Get Async Task Results
 *
 * Retrieve results from completed async local Codex tasks.
 */

import { globalTaskRegistry } from '../state/task_registry.js';
import { globalRedactor } from '../security/redactor.js';

export interface LocalResultsInput {
  task_id: string;
}

export interface LocalResultsResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export class LocalResultsTool {
  async execute(input: LocalResultsInput): Promise<LocalResultsResult> {
    const task = globalTaskRegistry.getTask(input.task_id);

    if (!task) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Task Not Found\n\n**Task ID**: \`${input.task_id}\`\n\nTask not found in registry.`,
          },
        ],
        isError: true,
      };
    }

    // Check if still running
    if (task.status === 'working') {
      return {
        content: [
          {
            type: 'text',
            text: `⏳ Task Still Running\n\n**Task ID**: \`${input.task_id}\`\n\n**Task**: ${task.instruction}\n\n**Started**: ${new Date(task.createdAt).toLocaleString()}\n\n💡 Check back later with \`_codex_local_status\` or wait for completion.`,
          },
        ],
      };
    }

    // Check if failed
    if (task.status === 'failed') {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Task Failed\n\n**Task ID**: \`${input.task_id}\`\n\n**Error**: ${task.error || 'Unknown error'}\n\n**Task**: ${task.instruction}`,
          },
        ],
        isError: true,
      };
    }

    // Task completed - return results
    const resultStr = task.result;
    if (!resultStr) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ No Results Available\n\n**Task ID**: \`${input.task_id}\`\n\nTask completed but results not available.`,
          },
        ],
        isError: true,
      };
    }

    // Parse result JSON from SQLite registry
    let resultData: any;
    try {
      resultData = JSON.parse(resultStr);
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Invalid Result Format\n\n**Task ID**: \`${input.task_id}\`\n\nCould not parse task result.`,
          },
        ],
        isError: true,
      };
    }

    // Build result message for SDK execution
    let message = `✅ Codex SDK Task Completed\n\n`;
    message += `**Task ID**: \`${input.task_id}\`\n\n`;
    message += `**Task**: ${task.instruction}\n\n`;

    if (resultData.threadId) {
      message += `**Thread ID**: \`${resultData.threadId}\`\n\n`;
      message += `💡 Use \`_codex_local_resume\` with this thread ID to continue work.\n\n`;
    }

    message += `**Status**: ${resultData.success ? '✅ Success' : '❌ Failed'}\n\n`;
    message += `**Events Captured**: ${resultData.eventCount || 0}\n\n`;

    // Include git verification results if available
    if (resultData.verificationOutput) {
      message += `${resultData.verificationOutput}\n\n`;
    } else if (resultData.gitVerification) {
      // Fallback to raw git verification data if formatted output not available
      const gitV = resultData.gitVerification;
      if (gitV.errors && gitV.errors.length > 0) {
        message += `**Git Verification Errors**:\n`;
        gitV.errors.forEach((err: string) => {
          message += `- ❌ ${err}\n`;
        });
        message += `\n`;
      }
      if (gitV.warnings && gitV.warnings.length > 0) {
        message += `**Git Verification Warnings**:\n`;
        gitV.warnings.forEach((warn: string) => {
          message += `- ⚠️ ${warn}\n`;
        });
        message += `\n`;
      }
      if (gitV.recommendations && gitV.recommendations.length > 0) {
        message += `**Recommended Actions**:\n`;
        gitV.recommendations.forEach((rec: string, i: number) => {
          message += `${i + 1}. ${rec}\n`;
        });
        message += `\n`;
      }
    }

    // Include Codex output (Issue 3.1 fix: Increased limit + smart truncation)
    if (resultData.finalOutput) {
      const output = globalRedactor.redact(resultData.finalOutput);
      const maxLength = 50000; // Increased from 10KB to 50KB
      const wasTruncated = output.length > maxLength;

      let displayOutput: string;
      if (wasTruncated) {
        // Smart truncation: Show first 40KB and last 5KB with separator
        const firstPortion = output.substring(0, 40000);
        const lastPortion = output.substring(output.length - 5000);
        const truncatedChars = output.length - 45000;
        const truncatedLines = output.substring(40000, output.length - 5000).split('\n').length;

        displayOutput = `${firstPortion}\n\n... [Truncated ${truncatedChars.toLocaleString()} characters (~${truncatedLines} lines)] ...\n\n${lastPortion}`;
      } else {
        displayOutput = output;
      }

      message += `**Codex Output**:\n\`\`\`\n${displayOutput}\n\`\`\`\n`;

      if (wasTruncated) {
        message += `\n*Output size: ${output.length.toLocaleString()} chars (showing first 40KB + last 5KB)*\n`;
      }
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

  static getSchema() {
    return {
      name: '_codex_local_results',
      description: 'Retrieve finished async task results - like checking your completed downloads. When you run a local task asynchronously (rare, as most local tasks are synchronous), use this to fetch the final output. Think of it as collecting your package from the post office after getting the "ready for pickup" notification. Use this when: you have a task ID from an async local execution and want the full results. Returns: complete output, analysis, and any generated artifacts. Perfect for: background local tasks that finished while you were doing other work. Avoid for: checking status of running tasks (use _codex_local_status), or most local tasks (which return results immediately).',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'Task ID from codex_run async execution',
          },
        },
        required: ['task_id'],
      },
    };
  }
}
