/**
 * Apply Tool - Execute Mutations with Confirmation
 *
 * Executes file-modifying tasks but REQUIRES explicit confirmation.
 * Prevents accidental mutations by requiring confirm=true parameter.
 */
import { ErrorMapper } from "../executor/error_mapper.js";
import { InputValidator } from "../security/input_validator.js";
import { globalRedactor } from "../security/redactor.js";
import { localTaskRegistry } from "../state/local_task_registry.js";
export class ApplyTool {
  processManager;
  constructor(processManager) {
    this.processManager = processManager;
  }
  /**
   * Execute the apply tool (mutation mode)
   */
  async execute(input) {
    // Default to workspace-write mode
    const mode = input.mode || "workspace-write";
    // CRITICAL: Require explicit confirmation
    if (input.confirm !== true) {
      return {
        content: [
          {
            type: "text",
            text: `⚠️ Confirmation Required\n\nThis operation will modify files in your project.\n\n**Task**: ${input.task}\n**Mode**: ${mode}\n\n**To proceed**, call this tool again with \`confirm=true\`.\n\n**Tip**: Use \`codex_plan\` first to preview changes.`,
          },
        ],
        isError: true,
      };
    }
    // Validate inputs
    const validation = InputValidator.validateAll({
      task: input.task,
      mode,
      model: input.model,
      outputSchema: input.outputSchema,
      workingDir: input.workingDir,
      confirm: input.confirm,
    });
    if (!validation.valid) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Validation Error: ${validation.error}`,
          },
        ],
        isError: true,
      };
    }
    // Execute Codex task in mutation mode
    const options = {
      task: input.task,
      mode,
      model: input.model,
      outputSchema: input.outputSchema,
      workingDir: input.workingDir,
      envPolicy: input.envPolicy,
      envAllowList: input.envAllowList,
    };
    try {
      // ASYNC MODE: Return immediately with task ID
      if (input.async) {
        const taskId = `local-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const promise = this.processManager.execute(options);
        // Register task for status tracking
        localTaskRegistry.registerTask(taskId, input.task, promise, {
          mode,
          model: input.model,
          workingDir: input.workingDir,
        });
        return {
          content: [
            {
              type: "text",
              text: `✅ Codex Apply Task Started (Async)\n\n**Task ID**: \`${taskId}\`\n\n**Task**: ${input.task}\n\n**Mode**: ${mode}\n\n**Status**: Running in background (file modifications will be applied)\n\n💡 Use \`codex_local_status\` to check progress and \`codex_local_results\` to get details when complete.\n\n⚠️ **Note**: This task WILL modify files. Monitor with git status after completion.`,
            },
          ],
        };
      }
      // SYNC MODE: Wait for completion (original behavior)
      const result = await this.processManager.execute(options);
      // Redact secrets from output
      const redactedOutput = globalRedactor.redactOutput({
        stdout: result.stdout,
        stderr: result.stderr,
      });
      // Check for success
      if (!result.success) {
        const error = ErrorMapper.mapProcessError(result);
        return {
          content: [
            {
              type: "text",
              text: `❌ Apply Failed\n\n**Error**: ${error.message}\n\n**Code**: ${error.code}\n\n**Details**:\n\`\`\`json\n${JSON.stringify(error.details, null, 2)}\n\`\`\``,
            },
          ],
          isError: true,
        };
      }
      // Extract meaningful information from events
      const summary = ErrorMapper.extractSummary(result.events);
      const fileChanges = ErrorMapper.extractFileChanges(result.events);
      const commands = ErrorMapper.extractCommands(result.events);
      // Build result message
      let message = `✅ Changes Applied\n\n`;
      message += `**Task**: ${input.task}\n`;
      message += `**Mode**: ${mode}\n\n`;
      message += `**Summary**: ${summary}\n\n`;
      if (fileChanges.length > 0) {
        message += `**Files Modified** (${fileChanges.length}):\n`;
        for (const change of fileChanges) {
          message += `- ${change.operation}: \`${change.path}\`\n`;
        }
        message += "\n";
      }
      if (commands.length > 0) {
        message += `**Commands Executed** (${commands.length}):\n`;
        for (const cmd of commands) {
          message += `- \`${cmd.command}\` (exit ${cmd.exitCode})\n`;
        }
        message += "\n";
      }
      message += `**Events**: ${result.events.length} events captured\n`;
      message += `**Exit Code**: ${result.exitCode}\n`;
      // Include Codex output (explanations, reasoning, etc.)
      if (redactedOutput.stdout.trim()) {
        const maxStdoutLength = 10000; // Prevent huge responses
        const truncatedStdout = redactedOutput.stdout.substring(
          0,
          maxStdoutLength,
        );
        const wasTruncated = redactedOutput.stdout.length > maxStdoutLength;
        message += `\n**Codex Output**:\n\`\`\`\n${truncatedStdout}\n\`\`\`\n`;
        if (wasTruncated) {
          message += `\n*(Output truncated - showing first ${maxStdoutLength} characters)*\n`;
        }
      }
      // Include stderr if present (warnings, debug info)
      if (redactedOutput.stderr.trim()) {
        message += `\n**Warnings/Debug Info**:\n\`\`\`\n${redactedOutput.stderr.substring(0, 1000)}\n\`\`\`\n`;
      }
      // Remind about git
      message += `\n**Next Steps**:\n`;
      message += `- Review changes: \`git diff\`\n`;
      message += `- Run tests: \`npm test\` or equivalent\n`;
      message += `- Commit changes: \`git add . && git commit -m "..."\`\n`;
      return {
        content: [
          {
            type: "text",
            text: message,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
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
      name: "codex_cli_apply",
      description:
        "Execute a local Codex task via CLI that modifies files. REQUIRES confirm=true to prevent accidental changes. Use codex_cli_plan first to preview.",
      inputSchema: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description:
              'Task description for Codex (e.g., "add error handling to main.ts")',
          },
          mode: {
            type: "string",
            enum: ["workspace-write", "danger-full-access"],
            default: "workspace-write",
            description:
              "Execution mode: workspace-write (standard mutations), danger-full-access (unrestricted)",
          },
          confirm: {
            type: "boolean",
            default: false,
            description: "REQUIRED: Set to true to confirm file modifications",
          },
          model: {
            type: "string",
            description:
              'OpenAI model to use (e.g., "gpt-4o", "o1", "o3-mini"). Defaults to Codex default.',
          },
          outputSchema: {
            type: "object",
            description: "Optional JSON schema for structured output",
          },
          workingDir: {
            type: "string",
            description:
              "Absolute path to working directory (defaults to current directory)",
          },
          envPolicy: {
            type: "string",
            enum: ["inherit-all", "inherit-none", "allow-list"],
            default: "inherit-none",
            description:
              "Environment variable policy: inherit-none (default, most secure), inherit-all (all vars), allow-list (specific vars only)",
          },
          envAllowList: {
            type: "array",
            items: { type: "string" },
            description:
              'List of environment variables to pass to Codex Cloud (only used with envPolicy=allow-list). Example: ["OPENAI_API_KEY", "DATABASE_URL"]',
          },
          async: {
            type: "boolean",
            default: false,
            description:
              "Run task in background (async mode). Set to true to return immediately with a task ID, then use codex_local_status and codex_local_results to check progress. Note: File modifications will still be applied.",
          },
        },
        required: ["task", "confirm"],
      },
    };
  }
}
//# sourceMappingURL=cli_apply.js.map
