/**
 * Plan Tool - Preview Codex Task Without Execution
 *
 * Shows what Codex would do without actually executing.
 * Useful for understanding proposed changes before applying them.
 */
import { ProcessManager } from "../executor/process_manager.js";
export interface PlanToolInput {
  task: string;
  model?: string;
  workingDir?: string;
  envPolicy?: "inherit-all" | "inherit-none" | "allow-list";
  envAllowList?: string[];
  async?: boolean;
}
export interface PlanToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}
export declare class PlanTool {
  private processManager;
  constructor(processManager: ProcessManager);
  /**
   * Execute the plan tool (dry-run)
   */
  execute(input: PlanToolInput): Promise<PlanToolResult>;
  /**
   * Get tool schema for MCP registration
   */
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
        model: {
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
//# sourceMappingURL=plan.d.ts.map
