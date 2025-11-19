/**
 * Cloud Cancel Tool - Terminate running cloud tasks
 *
 * Cancels a cloud task via Codex CLI and updates local registry.
 */
/**
 * Cloud cancel tool handler
 */
export declare function handleCloudCancel(params: {
    task_id: string;
    reason?: string;
}): Promise<{
    success: boolean;
    task_id: string;
    status: string;
    message: string;
    error?: string;
    reason?: string;
    web_ui_url: string;
}>;
/**
 * MCP Tool Class
 */
export declare class CloudCancelTool {
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
    execute(params: any): Promise<{
        content: {
            type: string;
            text: string;
        }[];
        isError: boolean;
    } | {
        content: {
            type: "text";
            text: string;
        }[];
        isError?: undefined;
    }>;
}
//# sourceMappingURL=cloud_cancel.d.ts.map