/**
 * Run Tool - Execute Codex Tasks (Read-Only by Default)
 *
 * Executes a Codex task with read-only mode by default.
 * Returns structured results with events, summary, and file changes.
 */
import { ProcessManager } from '../executor/process_manager.js';
export interface RunToolInput {
    task: string;
    mode?: 'read-only' | 'workspace-write' | 'danger-full-access';
    outputSchema?: any;
    model?: string;
    workingDir?: string;
    envPolicy?: 'inherit-all' | 'inherit-none' | 'allow-list';
    envAllowList?: string[];
    async?: boolean;
}
export interface RunToolResult {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError?: boolean;
}
export declare class RunTool {
    private processManager;
    constructor(processManager: ProcessManager);
    /**
     * Execute the run tool
     */
    execute(input: RunToolInput): Promise<RunToolResult>;
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
                mode: {
                    type: string;
                    enum: string[];
                    default: string;
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
//# sourceMappingURL=cli_run.d.ts.map