/**
 * Cloud Tools - Submit and Monitor Codex Cloud Background Tasks
 *
 * Codex Cloud allows tasks to run in the background in sandboxed containers.
 * Tasks continue even after Claude Code closes and can be checked from any device.
 */
import { ToolExecuteExtra } from '../types/progress.js';
export interface CloudSubmitInput {
    task: string;
    envId: string;
    attempts?: number;
    model?: string;
    allow_destructive_git?: boolean;
    format?: 'json' | 'markdown';
}
export interface CloudStatusInput {
    taskId?: string;
    list?: boolean;
    workingDir?: string;
    envId?: string;
    status?: 'submitted' | 'completed' | 'failed' | 'cancelled';
    limit?: number;
    showStats?: boolean;
    format?: 'json' | 'markdown';
}
export interface CloudResultsInput {
    taskId: string;
    format?: 'json' | 'markdown';
    include_output?: boolean;
    max_output_bytes?: number;
}
export interface CloudToolResult {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError?: boolean;
    metadata?: any;
}
export declare class CloudSubmitTool {
    /**
     * Submit a task to Codex Cloud for background execution
     */
    execute(input: CloudSubmitInput, extra?: ToolExecuteExtra): Promise<CloudToolResult>;
    /**
     * Execute codex cloud command (with timeout detection v3.2.1)
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
                allow_destructive_git: {
                    type: string;
                    description: string;
                    default: boolean;
                };
                format: {
                    type: string;
                    enum: string[];
                    default: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
}
export declare class CloudStatusTool {
    /**
     * Unified cloud task status checking
     *
     * Modes:
     * 1. No params → Show pending tasks (check_reminder)
     * 2. taskId → Show specific task status
     * 3. list: true → List all tasks with optional filters
     */
    execute(input?: CloudStatusInput): Promise<CloudToolResult>;
    /**
     * MODE 1: Show pending (submitted) tasks
     */
    private showPendingTasks;
    /**
     * MODE 2: Show specific task status
     */
    private showSpecificTask;
    /**
     * MODE 3: List all tasks with optional filtering
     */
    private listAllTasks;
    /**
     * JSON status_snapshot generator
     */
    private jsonSnapshot;
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
                taskId: {
                    type: string;
                    description: string;
                };
                list: {
                    type: string;
                    description: string;
                    default: boolean;
                };
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
                format: {
                    type: string;
                    enum: string[];
                    default: string;
                    description: string;
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
                format: {
                    type: string;
                    enum: string[];
                    default: string;
                    description: string;
                };
                include_output: {
                    type: string;
                    description: string;
                    default: boolean;
                };
                max_output_bytes: {
                    type: string;
                    description: string;
                    default: number;
                };
            };
            required: string[];
        };
    };
}
//# sourceMappingURL=cloud.d.ts.map