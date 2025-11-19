/**
 * Intent Parser Component
 *
 * Rule-based decision tree for parsing natural language instructions.
 * Designed for Codex Control's constrained domain (~10 verbs, ~5 entities).
 *
 * Priority ordering:
 * 1. Setup operations (most specific keywords)
 * 2. Task-specific operations (task ID present)
 * 3. Implicit queries (no task ID, but query keywords)
 * 4. Execution (default fallback)
 */
/**
 * Intent type
 */
export type IntentType = "execute" | "status" | "wait" | "cancel" | "fetch" | "setup";
/**
 * Setup target
 */
export type SetupTarget = "github" | "environment";
/**
 * Parsed intent
 */
export interface Intent {
    type: IntentType;
    taskId?: string | null;
    task?: string;
    target?: SetupTarget;
    raw: string;
}
/**
 * Structured hints for fast-path routing
 */
export interface IntentHints {
    operation?: "run" | "check" | "wait" | "cancel" | "setup" | "results";
    taskId?: string;
    mode?: "auto" | "local" | "cloud";
}
/**
 * Intent Parser
 */
export declare class IntentParser {
    /**
     * Parse natural language instruction into intent
     */
    parse(instruction: string, hints?: IntentHints): Intent;
    /**
     * Parse with structured hints (fast-path)
     */
    private parseWithHints;
    /**
     * Check if instruction is a setup intent
     */
    private isSetupIntent;
    /**
     * Extract setup target
     */
    private extractSetupTarget;
    /**
     * Parse task-specific intent (task ID present)
     */
    private parseTaskSpecificIntent;
    /**
     * Parse implicit query intent (no task ID, but query keywords)
     */
    private parseImplicitQueryIntent;
    /**
     * Check if instruction is a cancel intent
     */
    private isCancelIntent;
    /**
     * Check if instruction is a wait intent
     */
    private isWaitIntent;
    /**
     * Check if instruction is a fetch intent
     */
    private isFetchIntent;
    /**
     * Check if instruction is a status intent
     */
    private isStatusIntent;
    /**
     * Extract task ID from instruction
     *
     * Supports formats:
     * - T-local-abc123
     * - T-cloud-def456
     */
    extractTaskId(text: string): string | null;
    /**
     * Validate task ID format
     */
    isValidTaskId(taskId: string): boolean;
    /**
     * Get intent type as human-readable string
     */
    getIntentDescription(intent: Intent): string;
    /**
     * Check if intent needs disambiguation (no task ID for task-specific operation)
     */
    needsDisambiguation(intent: Intent): boolean;
}
export declare const globalIntentParser: IntentParser;
//# sourceMappingURL=intent_parser.d.ts.map