/**
 * Cleanup Registry Tool - Clean up stuck and old tasks
 *
 * Provides manual cleanup of:
 * - Stuck tasks (pending/working for >1 hour)
 * - Old completed tasks (>24 hours)
 */
export interface CleanupRegistryToolInput {
    stuckTaskMaxAgeSeconds?: number;
    oldTaskMaxAgeHours?: number;
    dryRun?: boolean;
    format?: "json" | "markdown";
}
export interface CleanupRegistryToolResult {
    content: Array<{
        type: "text";
        text: string;
    }>;
}
export declare class CleanupRegistryTool {
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                stuckTaskMaxAgeSeconds: {
                    type: string;
                    description: string;
                    default: number;
                };
                oldTaskMaxAgeHours: {
                    type: string;
                    description: string;
                    default: number;
                };
                dryRun: {
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
    execute(input: CleanupRegistryToolInput): Promise<CleanupRegistryToolResult>;
}
//# sourceMappingURL=cleanup_registry.d.ts.map