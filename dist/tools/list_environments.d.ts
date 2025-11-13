export interface CodexEnvironment {
    name: string;
    repoUrl: string;
    stack: string;
    description?: string;
}
export interface ListEnvironmentsResult {
    content: Array<{
        type: 'text';
        text: string;
    }>;
}
export declare class ListEnvironmentsTool {
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {};
            required: never[];
        };
    };
    execute(): Promise<ListEnvironmentsResult>;
    /**
     * Helper method to generate example config
     */
    static getExampleConfig(): string;
}
//# sourceMappingURL=list_environments.d.ts.map