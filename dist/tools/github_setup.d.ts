/**
 * GitHub Setup Helper Tool
 *
 * Provides interactive guide for configuring GitHub integration with Codex Cloud.
 * Generates custom setup scripts, token creation instructions, and test tasks.
 */
/**
 * Input interface for GitHub setup guide
 */
export interface GitHubSetupInput {
    /** GitHub repository URL (e.g., https://github.com/user/repo) */
    repoUrl: string;
    /** Technology stack (node, python, go, rust) */
    stack: "node" | "python" | "go" | "rust";
    /** Git user name (optional, defaults to "Codex Agent") */
    gitUserName?: string;
    /** Git user email (optional, defaults to "codex@example.com") */
    gitUserEmail?: string;
    /** Optional response format */
    format?: "json" | "markdown";
}
/**
 * Tool result interface
 */
export interface GitHubSetupResult {
    content: Array<{
        type: "text";
        text: string;
    }>;
    isError?: boolean;
}
/**
 * GitHub Setup Helper Tool
 *
 * Generates custom GitHub integration guides based on:
 * - Repository URL
 * - Technology stack
 * - User preferences (git config)
 *
 * Output includes:
 * - Fine-grained token creation instructions
 * - Codex Cloud environment configuration
 * - Custom setup and maintenance scripts
 * - Test task for verification
 * - Troubleshooting guide
 */
export declare class GitHubSetupTool {
    /**
     * Get tool schema for MCP registration
     */
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                repoUrl: {
                    type: string;
                    description: string;
                };
                stack: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                gitUserName: {
                    type: string;
                    description: string;
                };
                gitUserEmail: {
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
    /**
     * Execute tool to generate custom setup guide
     */
    execute(input: GitHubSetupInput): Promise<GitHubSetupResult>;
}
//# sourceMappingURL=github_setup.d.ts.map