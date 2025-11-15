/**
 * Git Verification Layer for Codex Control MCP
 *
 * Purpose: Verify git operations actually succeeded after Codex execution
 * Root Cause: Codex SDK suppresses stdout/stderr for non-zero exit codes (Issue #1367)
 * Solution: Run independent git commands to check branch, commits, staging
 */
export interface GitVerificationResult {
    branchExists: boolean;
    expectedBranch?: string;
    actualBranch?: string;
    commitExists: boolean;
    expectedCommitMessage?: string;
    actualCommitMessage?: string;
    commitHash?: string;
    filesStaged: boolean;
    unstagedFiles: string[];
    stagedFiles: string[];
    workingTreeClean: boolean;
    modifiedFiles: string[];
    untrackedFiles: string[];
    errors: string[];
    warnings: string[];
    recommendations: string[];
}
/**
 * Verify git operations after Codex execution
 */
export declare function verifyGitOperations(workingDir: string, taskDescription: string): Promise<GitVerificationResult>;
/**
 * Format git verification results for user display
 */
export declare function formatGitVerification(verification: GitVerificationResult): string;
//# sourceMappingURL=git_verifier.d.ts.map