/**
 * Cloud Wait Tool - Block until completion and return results summary
 */
export interface CloudWaitInput {
    task_id: string;
    timeout_sec?: number;
    include_output?: boolean;
    format?: 'json' | 'markdown';
}
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
                    default: number;
                };
                include_output: {
                    type: string;
                    description: string;
                    default: boolean;
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
    execute(input: CloudWaitInput): Promise<{
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
//# sourceMappingURL=cloud_wait.d.ts.map