/**
 * Apply Tool - Execute Mutations with Confirmation
 *
 * Executes file-modifying tasks but REQUIRES explicit confirmation.
 * Prevents accidental mutations by requiring confirm=true parameter.
 */
import { ProcessManager } from '../executor/process_manager.js';
export interface ApplyToolInput {
    task: string;
    mode?: 'workspace-write' | 'danger-full-access';
    confirm?: boolean;
    outputSchema?: any;
    model?: string;
    workingDir?: string;
    envPolicy?: 'inherit-all' | 'inherit-none' | 'allow-list';
    envAllowList?: string[];
    async?: boolean;
}
export interface ApplyToolResult {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError?: boolean;
}
export declare class ApplyTool {
    private processManager;
    constructor(processManager: ProcessManager);
    /**
     * Execute the apply tool (mutation mode)
     */
    execute(input: ApplyToolInput): Promise<ApplyToolResult>;
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
                confirm: {
                    type: string;
                    default: boolean;
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
//# sourceMappingURL=cli_apply.d.ts.map