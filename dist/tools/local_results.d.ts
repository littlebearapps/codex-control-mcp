/**
 * Local Results Tool - Get Async Task Results
 *
 * Retrieve results from completed async local Codex tasks.
 */
export interface LocalResultsInput {
    task_id: string;
    format?: "json" | "markdown";
    include_output?: boolean;
    include_events?: boolean;
    max_output_bytes?: number;
}
export interface LocalResultsResult {
    content: Array<{
        type: "text";
        text: string;
    }>;
    isError?: boolean;
}
export declare class LocalResultsTool {
    execute(input: LocalResultsInput): Promise<LocalResultsResult>;
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
                format: {
                    type: string;
                    enum: string[];
                    default: string;
                    description: string;
                };
                include_output: {
                    type: string;
                    description: string;
                };
                max_output_bytes: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
}
//# sourceMappingURL=local_results.d.ts.map