/**
 * Local Status Tool - Check Async Task Status
 *
 * Check status of async local Codex tasks (CLI/SDK).
 * Shows running and recently completed tasks.
 */
export interface LocalStatusInput {
    taskId?: string;
    showAll?: boolean;
}
export interface LocalStatusResult {
    content: Array<{
        type: 'text';
        text: string;
    }>;
}
export declare class LocalStatusTool {
    execute(input?: LocalStatusInput): Promise<LocalStatusResult>;
    private getElapsedTime;
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
                    default: boolean;
                    description: string;
                };
            };
        };
    };
}
//# sourceMappingURL=local_status.d.ts.map