/**
 * Cloud Tools - Submit and Monitor Codex Cloud Background Tasks
 *
 * Codex Cloud allows tasks to run in the background in sandboxed containers.
 * Tasks continue even after Claude Code closes and can be checked from any device.
 */
export interface CloudSubmitInput {
    task: string;
    envId: string;
    attempts?: number;
    model?: string;
}
export interface CloudStatusInput {
    taskId?: string;
    showAll?: boolean;
}
export interface CloudResultsInput {
    taskId: string;
}
export interface CloudToolResult {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError?: boolean;
}
export declare class CloudSubmitTool {
    /**
     * Submit a task to Codex Cloud for background execution
     */
    execute(input: CloudSubmitInput): Promise<CloudToolResult>;
    /**
     * Execute codex cloud command
     */
    private runCodexCloud;
    /**
     * Extract task ID from codex cloud output
     */
    private extractTaskId;
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
                envId: {
                    type: string;
                    description: string;
                };
                attempts: {
                    type: string;
                    description: string;
                    default: number;
                };
                model: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
}
export declare class CloudStatusTool {
    /**
     * Check status of cloud tasks
     */
    execute(input: CloudStatusInput): Promise<CloudToolResult>;
    /**
     * Get tool schema for MCP registration
     */
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                taskId: {
                    type: string;
                    description: string;
                };
                showAll: {
                    type: string;
                    description: string;
                    default: boolean;
                };
            };
        };
    };
}
export declare class CloudResultsTool {
    /**
     * Get results of completed cloud task
     */
    execute(input: CloudResultsInput): Promise<CloudToolResult>;
    /**
     * Get tool schema for MCP registration
     */
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                taskId: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
}
export interface CloudListTasksInput {
    workingDir?: string;
    envId?: string;
    status?: 'submitted' | 'completed' | 'failed' | 'cancelled';
    limit?: number;
    showStats?: boolean;
}
export declare class CloudListTasksTool {
    /**
     * List tracked cloud tasks with optional filtering
     */
    execute(input?: CloudListTasksInput): Promise<CloudToolResult>;
    /**
     * Get status emoji for visual clarity
     */
    private getStatusEmoji;
    /**
     * Get human-readable relative time
     */
    private getRelativeTime;
    /**
     * Get tool schema for MCP registration
     */
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
                envId: {
                    type: string;
                    description: string;
                };
                status: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                limit: {
                    type: string;
                    description: string;
                    default: number;
                };
                showStats: {
                    type: string;
                    description: string;
                    default: boolean;
                };
            };
        };
    };
}
//# sourceMappingURL=cloud.d.ts.map