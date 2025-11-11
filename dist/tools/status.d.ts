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
    /**
     * Execute the status tool
     */
    execute(_input: StatusToolInput): Promise<StatusToolResult>;
    /**
     * Get tool schema for MCP registration
     */
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {};
            required: never[];
        };
    };
}
//# sourceMappingURL=status.d.ts.map