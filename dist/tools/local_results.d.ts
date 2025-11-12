/**
 * Local Results Tool - Get Async Task Results
 *
 * Retrieve results from completed async local Codex tasks.
 */
export interface LocalResultsInput {
    taskId: string;
}
export interface LocalResultsResult {
    content: Array<{
        type: 'text';
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
                taskId: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
}
//# sourceMappingURL=local_results.d.ts.map