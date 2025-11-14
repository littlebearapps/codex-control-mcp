/**
 * Local Wait Tool - Server-side polling with intelligent backoff
 *
 * Waits for local task completion with automatic progress updates.
 * Reduces tool call spam by handling polling internally.
 */
/**
 * Local wait tool handler
 */
export declare function handleLocalWait(params: {
    task_id: string;
    timeout_sec?: number;
    poll_interval_sec?: number;
}): Promise<{
    success: boolean;
    task_id: string;
    status: string;
    progress?: any;
    result?: string;
    error?: string;
    message: string;
    elapsed_ms: number;
    timed_out: boolean;
}>;
/**
 * MCP Tool Class
 */
export declare class LocalWaitTool {
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                task_id: {
                    type: string;
                    description: string;
                };
                timeout_sec: {
                    type: string;
                    description: string;
                };
                poll_interval_sec: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
    execute(params: any): Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
}
//# sourceMappingURL=local_wait.d.ts.map