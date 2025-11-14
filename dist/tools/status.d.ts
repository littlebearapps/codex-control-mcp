/**
 * Unified Status Tool - Process Manager + Task Registry
 *
 * Shows both real-time process state AND persistent task history.
 * Consolidates codex_cli_status and codex_local_status into one tool.
 */
import { ProcessManager } from '../executor/process_manager.js';
export interface StatusToolInput {
    workingDir?: string;
    showAll?: boolean;
}
export interface StatusToolResult {
    content: Array<{
        type: 'text';
        text: string;
    }>;
}
export declare class StatusTool {
    private processManager;
    constructor(processManager: ProcessManager);
    execute(input: StatusToolInput): Promise<StatusToolResult>;
    private formatTimeAgo;
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                workingDir: {
                    type: string;
                    description: string;
                };
                showAll: {
                    type: string;
                    default: boolean;
                    description: string;
                };
            };
        };
    };
}
//# sourceMappingURL=status.d.ts.map