/**
 * Git Operations Safety - Auto-Checkpointing
 *
 * Creates safety checkpoints before risky git operations:
 * - Safety branch pointing to current HEAD
 * - Stash for dirty working tree
 * - Extended reflog retention
 */
export interface CheckpointResult {
    safety_branch: string;
    stash_ref?: string;
    head_oid: string;
    created_at: string;
    working_tree_was_dirty: boolean;
}
export declare class SafetyCheckpointing {
    /**
     * Sanitize operation name for use in git branch names
     * Removes/replaces all characters invalid in git branch names per git-check-ref-format
     */
    private sanitizeOperationName;
    /**
     * Create safety checkpoint before risky operation
     */
    createCheckpoint(operation: string, workingDir: string): Promise<CheckpointResult>;
    /**
     * Get current HEAD commit OID
     */
    private getHeadOid;
    /**
     * Execute git command safely
     */
    private execGit;
    /**
     * Log checkpoint to audit trail
     */
    private logCheckpoint;
    /**
     * Format recovery instructions for user
     */
    formatRecoveryInstructions(checkpoint: CheckpointResult): string;
    /**
     * Cleanup old safety branches (older than 30 days)
     */
    cleanupOldCheckpoints(workingDir: string, daysToKeep?: number): Promise<number>;
}
//# sourceMappingURL=safety_checkpointing.d.ts.map