/**
 * Cloud Wait Tool - Server-side polling for cloud tasks
 *
 * Waits for cloud task completion with automatic progress updates.
 * Uses Codex CLI to check status periodically.
 */
/**
 * Cloud wait tool handler
 */
export declare function handleCloudWait(params: {
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
    web_ui_url: string;
}>;
/**
 * MCP Tool Class
 */
export declare class CloudWaitTool {
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
//# sourceMappingURL=cloud_wait.d.ts.map