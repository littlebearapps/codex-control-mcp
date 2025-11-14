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
export type IntentType =
  | 'execute' // Run a new task
  | 'status' // Check task status
  | 'wait' // Wait for task completion
  | 'cancel' // Cancel a running task
  | 'fetch' // Get task results
  | 'setup'; // Setup/configuration

/**
 * Setup target
 */
export type SetupTarget = 'github' | 'environment';

/**
 * Parsed intent
 */
export interface Intent {
  type: IntentType;
  taskId?: string | null; // Extracted task ID (T-local-* or T-cloud-*)
  task?: string; // Original instruction (for execute)
  target?: SetupTarget; // For setup operations
  raw: string; // Original instruction
}

/**
 * Structured hints for fast-path routing
 */
export interface IntentHints {
  operation?: 'run' | 'check' | 'wait' | 'cancel' | 'setup' | 'results';
  taskId?: string;
  mode?: 'auto' | 'local' | 'cloud';
}

/**
 * Intent Parser
 */
export class IntentParser {
  /**
   * Parse natural language instruction into intent
   */
  parse(instruction: string, hints?: IntentHints): Intent {
    // Fast-path: Use structured hints if provided
    if (hints?.operation) {
      return this.parseWithHints(instruction, hints);
    }

    // Natural language parsing with priority ordering
    const lower = instruction.toLowerCase();
    const taskId = this.extractTaskId(instruction);

    // Priority 1: Setup operations (most specific keywords)
    if (this.isSetupIntent(lower)) {
      const target = this.extractSetupTarget(lower);
      return { type: 'setup', target, raw: instruction };
    }

    // Priority 2: Task-specific operations (task ID present)
    if (taskId) {
      const taskIntent = this.parseTaskSpecificIntent(lower, taskId, instruction);
      if (taskIntent) return taskIntent;
    }

    // Priority 3: Implicit queries (no task ID, but query keywords)
    const implicitIntent = this.parseImplicitQueryIntent(lower, instruction);
    if (implicitIntent) return implicitIntent;

    // Priority 4: Execution (default fallback)
    return { type: 'execute', task: instruction, raw: instruction };
  }

  /**
   * Parse with structured hints (fast-path)
   */
  private parseWithHints(instruction: string, hints: IntentHints): Intent {
    const taskId = hints.taskId || this.extractTaskId(instruction);

    switch (hints.operation) {
      case 'run':
        return { type: 'execute', task: instruction, raw: instruction };
      case 'check':
        return { type: 'status', taskId, raw: instruction };
      case 'wait':
        return { type: 'wait', taskId, raw: instruction };
      case 'cancel':
        return { type: 'cancel', taskId, raw: instruction };
      case 'results':
        return { type: 'fetch', taskId, raw: instruction };
      case 'setup':
        return { type: 'setup', target: 'github', raw: instruction };
      default:
        // Fall back to natural language parsing
        return this.parse(instruction);
    }
  }

  /**
   * Check if instruction is a setup intent
   */
  private isSetupIntent(lower: string): boolean {
    const setupPatterns = [
      /\bset\s*up\b/,
      /\bconfigure\b/,
      /\bgithub\s+(integration|setup)/,
      /\blist\s+(environment|config)/,
      /\bshow\b.*\b(environment|config)/, // "show available environments", "show config", etc.
    ];

    return setupPatterns.some(pattern => pattern.test(lower));
  }

  /**
   * Extract setup target
   */
  private extractSetupTarget(lower: string): SetupTarget {
    if (/github/.test(lower)) {
      return 'github';
    }
    return 'environment';
  }

  /**
   * Parse task-specific intent (task ID present)
   */
  private parseTaskSpecificIntent(
    lower: string,
    taskId: string,
    instruction: string
  ): Intent | null {
    // Cancel operation
    if (this.isCancelIntent(lower)) {
      return { type: 'cancel', taskId, raw: instruction };
    }

    // Wait operation
    if (this.isWaitIntent(lower)) {
      return { type: 'wait', taskId, raw: instruction };
    }

    // Fetch results
    if (this.isFetchIntent(lower)) {
      return { type: 'fetch', taskId, raw: instruction };
    }

    // Default to status check for task ID
    return { type: 'status', taskId, raw: instruction };
  }

  /**
   * Parse implicit query intent (no task ID, but query keywords)
   */
  private parseImplicitQueryIntent(lower: string, instruction: string): Intent | null {
    // Status check
    if (this.isStatusIntent(lower)) {
      return { type: 'status', taskId: null, raw: instruction };
    }

    // Wait operation
    if (this.isWaitIntent(lower)) {
      return { type: 'wait', taskId: null, raw: instruction };
    }

    // Fetch results
    if (this.isFetchIntent(lower)) {
      return { type: 'fetch', taskId: null, raw: instruction };
    }

    return null;
  }

  /**
   * Check if instruction is a cancel intent
   */
  private isCancelIntent(lower: string): boolean {
    const cancelPatterns = [
      /\bcancel\b/,
      /\bstop\b/,
      /\babort\b/,
      /\bkill\b/,
      /\bterminate\b/,
    ];

    return cancelPatterns.some(pattern => pattern.test(lower));
  }

  /**
   * Check if instruction is a wait intent
   */
  private isWaitIntent(lower: string): boolean {
    const waitPatterns = [
      /\bwait\s+(for|until)\b/,
      /\bwait\b.*\bcomplete/,
      /\bwait\b.*\bfinish/,
      /\bpoll\s+until\b/,
    ];

    return waitPatterns.some(pattern => pattern.test(lower));
  }

  /**
   * Check if instruction is a fetch intent
   */
  private isFetchIntent(lower: string): boolean {
    const fetchPatterns = [
      /\b(show|get|fetch|retrieve)\b.*\b(result|output)s?\b/, // Allow optional words between verb and result/output
      /\bresult\s+(of|for)\b/,
      /\boutput\s+(of|for)\b/,
      /\bwhat\s+(did|was|were)\b.*\b(result|output)/,
    ];

    return fetchPatterns.some(pattern => pattern.test(lower));
  }

  /**
   * Check if instruction is a status intent
   */
  private isStatusIntent(lower: string): boolean {
    const statusPatterns = [
      /\bcheck\s+(my|the|task|status)/,
      /\bstatus\s+(of|for|check)/,
      /\bhow\s+is\b.*\b(doing|going)/,
      /\bis\s+(it|task)\s+(done|complete|finished)/,
      /\bwhat'?s\s+(the\s+)?status/,
    ];

    return statusPatterns.some(pattern => pattern.test(lower));
  }

  /**
   * Extract task ID from instruction
   *
   * Supports formats:
   * - T-local-abc123
   * - T-cloud-def456
   */
  extractTaskId(text: string): string | null {
    // Match pattern: T-local-abc123 or T-cloud-def456
    const match = text.match(/T-(local|cloud)-[a-z0-9]+/i);
    return match ? match[0] : null;
  }

  /**
   * Validate task ID format
   */
  isValidTaskId(taskId: string): boolean {
    return /^T-(local|cloud)-[a-z0-9]+$/i.test(taskId);
  }

  /**
   * Get intent type as human-readable string
   */
  getIntentDescription(intent: Intent): string {
    switch (intent.type) {
      case 'execute':
        return 'Execute new task';
      case 'status':
        return intent.taskId
          ? `Check status of ${intent.taskId}`
          : 'Check status (needs disambiguation)';
      case 'wait':
        return intent.taskId
          ? `Wait for ${intent.taskId} to complete`
          : 'Wait for task completion (needs disambiguation)';
      case 'cancel':
        return intent.taskId
          ? `Cancel ${intent.taskId}`
          : 'Cancel task (needs disambiguation)';
      case 'fetch':
        return intent.taskId
          ? `Get results for ${intent.taskId}`
          : 'Get task results (needs disambiguation)';
      case 'setup':
        return `Setup ${intent.target || 'configuration'}`;
      default:
        return 'Unknown intent';
    }
  }

  /**
   * Check if intent needs disambiguation (no task ID for task-specific operation)
   */
  needsDisambiguation(intent: Intent): boolean {
    const taskSpecificTypes: IntentType[] = ['status', 'wait', 'cancel', 'fetch'];
    return taskSpecificTypes.includes(intent.type) && !intent.taskId;
  }
}

// Singleton instance
export const globalIntentParser = new IntentParser();
