/**
 * Local Cancel Tool - Terminate running local tasks
 *
 * Stops a running local task by sending termination signal and updating status.
 */
/**
 * Local cancel tool handler
 */
export declare function handleLocalCancel(params: {
    task_id: string;
    reason?: string;
}): Promise<{
    success: boolean;
    task_id: string;
    status: string;
    message: string;
    error?: string;
    reason?: string;
}>;
/**
 * MCP Tool Class
 */
export declare class LocalCancelTool {
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
                reason: {
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
//# sourceMappingURL=local_cancel.d.ts.map