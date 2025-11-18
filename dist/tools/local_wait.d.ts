/**
 * Local Wait Tool - Block until completion and return results
 */
export interface LocalWaitInput {
    task_id: string;
    timeout_sec?: number;
    include_output?: boolean;
    max_output_bytes?: number;
    format?: 'json' | 'markdown';
}
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
                    default: number;
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
                format: {
                    type: string;
                    enum: string[];
                    default: string;
                };
            };
            required: string[];
        };
    };
    private isTerminal;
    execute(input: LocalWaitInput): Promise<import("./local_results.js").LocalResultsResult | {
        content: {
            type: string;
            text: string;
        }[];
        isError: boolean;
    } | {
        content: {
            type: string;
            text: string;
        }[];
        isError?: undefined;
    }>;
}
//# sourceMappingURL=local_wait.d.ts.map