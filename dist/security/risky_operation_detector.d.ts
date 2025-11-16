/**
 * Git Operations Safety - Risky Operation Detector
 *
 * Simple three-tier classification system for git operations:
 * - ALWAYS_BLOCKED: Truly destructive, no recovery possible
 * - REQUIRES_CONFIRMATION: Risky but recoverable with checkpoint
 * - SAFE: Normal workflow operations
 */
export declare enum GitOperationTier {
    ALWAYS_BLOCKED = "always_blocked",
    REQUIRES_CONFIRMATION = "requires_confirmation",
    SAFE = "safe"
}
export interface RiskyOperation {
    operation: string;
    tier: GitOperationTier;
    risk_description: string;
    safer_alternative: string;
}
/**
 * Safe operations - these are always allowed
 * (Listed for documentation purposes only)
 *
 * Examples:
 * - git status/log/diff/show/blame
 * - git add/commit (without --amend)
 * - git push (fast-forward only)
 * - git pull/fetch/branch/checkout
 * - git merge/stash/cherry-pick
 * - create repository/branch
 */
export declare class RiskyOperationDetector {
    /**
     * Detect risky git operations in a task description
     */
    detect(task: string): RiskyOperation[];
    /**
     * Normalize task description for consistent pattern matching
     */
    private normalizeTask;
    /**
     * Check if task contains any risky operations
     */
    hasRiskyOperations(task: string): boolean;
    /**
     * Get the highest risk tier detected in task
     */
    getHighestRiskTier(task: string): GitOperationTier | null;
    /**
     * Format blocked message for ALWAYS_BLOCKED operations
     */
    formatBlockedMessage(operations: RiskyOperation[]): string;
    /**
     * Format confirmation message for REQUIRES_CONFIRMATION operations
     */
    formatConfirmationMessage(operations: RiskyOperation[]): string;
    /**
     * Format confirmation metadata for REQUIRES_CONFIRMATION operations
     * Returns structured data for AI agents to use with AskUserQuestion
     */
    formatConfirmationMetadata(operations: RiskyOperation[]): any;
}
//# sourceMappingURL=risky_operation_detector.d.ts.map