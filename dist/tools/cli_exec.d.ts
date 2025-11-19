/**
 * Unified CLI Execution Tool
 *
 * Consolidates codex_cli_run, codex_cli_plan, and codex_cli_apply into one tool.
 * Supports all execution modes with safety gating for mutations.
 */
import { ProcessManager } from "../executor/process_manager.js";
export interface CliExecToolInput {
  task: string;
  mode?: "read-only" | "preview" | "workspace-write" | "danger-full-access";
  confirm?: boolean;
  outputSchema?: any;
  model?: string;
  workingDir?: string;
  envPolicy?: "inherit-all" | "inherit-none" | "allow-list";
  envAllowList?: string[];
  async?: boolean;
}
export interface CliExecToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}
export declare class CliExecTool {
  private processManager;
  constructor(processManager: ProcessManager);
  execute(input: CliExecToolInput): Promise<CliExecToolResult>;
  private formatPreviewResult;
  private formatExecutionResult;
  static getSchema(): {
    name: string;
    description: string;
    inputSchema: {
      type: string;
      properties: {
        task: {
          type: string;
          description: string;
        };
        mode: {
          type: string;
          enum: string[];
          default: string;
          description: string;
        };
        confirm: {
          type: string;
          description: string;
        };
        model: {
          type: string;
          description: string;
        };
        outputSchema: {
          type: string;
          description: string;
        };
        workingDir: {
          type: string;
          description: string;
        };
        envPolicy: {
          type: string;
          enum: string[];
          default: string;
          description: string;
        };
        envAllowList: {
          type: string;
          items: {
            type: string;
          };
          description: string;
        };
        async: {
          type: string;
          default: boolean;
          description: string;
        };
      };
      required: string[];
    };
  };
}
//# sourceMappingURL=cli_exec.d.ts.map
