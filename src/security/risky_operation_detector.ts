/**
 * Git Operations Safety - Risky Operation Detector
 *
 * Simple three-tier classification system for git operations:
 * - ALWAYS_BLOCKED: Truly destructive, no recovery possible
 * - REQUIRES_CONFIRMATION: Risky but recoverable with checkpoint
 * - SAFE: Normal workflow operations
 */

export enum GitOperationTier {
  ALWAYS_BLOCKED = "always_blocked",
  REQUIRES_CONFIRMATION = "requires_confirmation",
  SAFE = "safe",
}

export interface RiskyOperation {
  operation: string;
  tier: GitOperationTier;
  risk_description: string;
  safer_alternative: string;
}

/**
 * Tier 1: ALWAYS BLOCKED - Truly destructive operations
 * These can cause irreversible data loss and are too dangerous to allow via AI agents
 */
const ALWAYS_BLOCKED_PATTERNS = [
  {
    pattern: /git\s+gc\s+--prune=now/i,
    operation: "git gc --prune=now",
    risk_description:
      "Irreversibly prunes unreachable objects, destroying reflog recovery ability",
    safer_alternative: "Use default gc settings or gc without --prune=now",
  },
  {
    pattern: /git\s+reflog\s+expire\s+--expire-unreachable=now/i,
    operation: "git reflog expire --expire-unreachable=now",
    risk_description:
      "Destroys reflog entries, making recovery from mistakes impossible",
    safer_alternative: "Keep default reflog expiration (90 days)",
  },
  {
    pattern:
      /((push\s+(-f|--force)|push.*--force).*\b(main|master|trunk|release)|\b(main|master|trunk|release).*(push\s+(-f|--force)|push.*--force))/i,
    operation: "git push --force to protected branch",
    risk_description:
      "Overwrites history on protected branch, breaks all collaborators' clones",
    safer_alternative:
      "Create a pull request instead, or push to feature branch",
  },
  {
    pattern:
      /(filter-repo.*\b(main|master|trunk|release)|\b(main|master|trunk|release).*filter-repo)/i,
    operation: "git filter-repo on protected branch",
    risk_description: "Rewrites entire repository history on protected branch",
    safer_alternative: "Work on a separate branch or create backup first",
  },
  {
    pattern: /git\s+reset\s+HEAD~\d+/i,
    operation: "git reset HEAD~N",
    risk_description:
      "Removes commits from branch history - high risk of losing unpushed work permanently",
    safer_alternative:
      "Use git revert to create new commits that undo changes, or git reset --soft to keep changes staged",
  },
  {
    pattern: /(delete|remove|rm)\s+(the\s+)?(this\s+)?(git\s+)?repo(sitory)?/i,
    operation: "delete git repository",
    risk_description:
      "Permanently destroys entire repository including all history - irreversible without remote backup",
    safer_alternative:
      "Archive repository to backup location, or rename instead of deleting",
  },
  {
    pattern: /git\s+reset\s+--hard/i,
    operation: "git reset --hard",
    risk_description:
      "Permanently discards uncommitted changes in working directory - no recovery possible",
    safer_alternative:
      "Use git reset --mixed to keep changes, or git stash to save them first",
  },
  {
    pattern: /git\s+clean\s+-[fdxFDX]*[fdx]/i,
    operation: "git clean -fdx",
    risk_description:
      "Permanently deletes untracked files and directories - no recovery possible for untracked files",
    safer_alternative:
      "Use git clean -n first to preview what will be deleted, or move files to backup",
  },
  {
    pattern: /git\s+checkout\s+(--force|-f)\b/i,
    operation: "git checkout --force",
    risk_description:
      "Discards uncommitted changes when switching branches - no recovery possible",
    safer_alternative: "Use git stash before checkout, or commit changes first",
  },
  {
    pattern: /git\s+stash\s+(drop|clear)/i,
    operation: "git stash drop/clear",
    risk_description:
      "Permanently removes stashed changes - stash reflog expires quickly",
    safer_alternative:
      "Apply stash first to verify, or use git stash branch to save as a branch",
  },
  {
    pattern: /git\s+worktree\s+remove\s+(--force|-f)/i,
    operation: "git worktree remove --force",
    risk_description:
      "Removes worktree with uncommitted changes - no recovery possible",
    safer_alternative:
      "Commit or stash changes in worktree before removing, or remove --force flag",
  },
];

/**
 * Tier 2: REQUIRES CONFIRMATION - Risky but recoverable
 * These rewrite history or modify working tree but can be recovered via reflog/checkpoint
 */
const REQUIRES_CONFIRMATION_PATTERNS = [
  {
    pattern: /(git\s+)?rebase/i,
    operation: "git rebase",
    risk_description: "Rewrites commit history, changes all commit hashes",
    safer_alternative:
      "Use git merge to preserve history and avoid hash changes",
  },
  {
    pattern:
      /git\s+(push\s+(-f|--force)|push.*--force)(?!.*\b(main|master|trunk|release)\b)/i,
    operation: "git push --force",
    risk_description:
      "Overwrites remote branch history, can affect collaborators",
    safer_alternative:
      "Coordinate with team or use --force-with-lease for safer force push",
  },
  {
    pattern: /git\s+(commit\s+)?--amend/i,
    operation: "git commit --amend",
    risk_description:
      "Changes commit hash, problematic if commit already pushed",
    safer_alternative: "Create a new commit instead of amending",
  },
  {
    pattern: /git\s+branch\s+-D\b/i,
    operation: "git branch -D",
    risk_description:
      "Force deletes branch even if unmerged - can lose commits if not pushed to remote",
    safer_alternative:
      "Use git branch -d (lowercase) to safely delete only merged branches, or push branch first",
  },
];

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

export class RiskyOperationDetector {
  /**
   * Detect risky git operations in a task description
   */
  detect(task: string): RiskyOperation[] {
    const detected: RiskyOperation[] = [];

    // Normalize task for pattern matching
    const normalized = this.normalizeTask(task);

    // Check Tier 1: ALWAYS BLOCKED
    for (const pattern of ALWAYS_BLOCKED_PATTERNS) {
      if (pattern.pattern.test(normalized)) {
        detected.push({
          operation: pattern.operation,
          tier: GitOperationTier.ALWAYS_BLOCKED,
          risk_description: pattern.risk_description,
          safer_alternative: pattern.safer_alternative,
        });
      }
    }

    // Check Tier 2: REQUIRES CONFIRMATION
    for (const pattern of REQUIRES_CONFIRMATION_PATTERNS) {
      if (pattern.pattern.test(normalized)) {
        detected.push({
          operation: pattern.operation,
          tier: GitOperationTier.REQUIRES_CONFIRMATION,
          risk_description: pattern.risk_description,
          safer_alternative: pattern.safer_alternative,
        });
      }
    }

    return detected;
  }

  /**
   * Normalize task description for consistent pattern matching
   */
  private normalizeTask(task: string): string {
    // Normalize whitespace
    let normalized = task.replace(/\s+/g, " ").trim();

    // Resolve common git command aliases
    normalized = normalized.replace(/git\s+amend\b/gi, "git commit --amend");

    return normalized;
  }

  /**
   * Check if task contains any risky operations
   */
  hasRiskyOperations(task: string): boolean {
    return this.detect(task).length > 0;
  }

  /**
   * Get the highest risk tier detected in task
   */
  getHighestRiskTier(task: string): GitOperationTier | null {
    const detected = this.detect(task);

    if (detected.length === 0) {
      return null;
    }

    // ALWAYS_BLOCKED is highest priority
    if (detected.some((op) => op.tier === GitOperationTier.ALWAYS_BLOCKED)) {
      return GitOperationTier.ALWAYS_BLOCKED;
    }

    // REQUIRES_CONFIRMATION is next
    if (
      detected.some((op) => op.tier === GitOperationTier.REQUIRES_CONFIRMATION)
    ) {
      return GitOperationTier.REQUIRES_CONFIRMATION;
    }

    return GitOperationTier.SAFE;
  }

  /**
   * Format blocked message for ALWAYS_BLOCKED operations
   */
  formatBlockedMessage(operations: RiskyOperation[]): string {
    const opList = operations.map((op) => op.operation).join(", ");
    const risks = operations
      .map((op) => `  • ${op.risk_description}`)
      .join("\n");
    const alternatives = operations
      .map((op) => `  • ${op.safer_alternative}`)
      .join("\n");

    return `❌ BLOCKED: ${opList}

These operations are too destructive and cannot be executed via AI agents.

Risks:
${risks}

Safer alternatives:
${alternatives}

These operations require manual execution outside of AI agent workflows.`;
  }

  /**
   * Format confirmation message for REQUIRES_CONFIRMATION operations
   */
  formatConfirmationMessage(operations: RiskyOperation[]): string {
    const opList = operations.map((op) => op.operation).join(", ");
    const risks = operations
      .map((op) => `  • ${op.risk_description}`)
      .join("\n");
    const alternatives = operations
      .map((op) => `  • ${op.safer_alternative}`)
      .join("\n");

    return `⚠️  RISKY GIT OPERATION: ${opList}

Risks:
${risks}

Safer alternatives:
${alternatives}

To proceed, user must explicitly confirm this risky operation.
A safety checkpoint will be created automatically before execution.`;
  }

  /**
   * Format confirmation metadata for REQUIRES_CONFIRMATION operations
   * Returns structured data for AI agents to use with AskUserQuestion
   */
  formatConfirmationMetadata(operations: RiskyOperation[]): any {
    const opList = operations.map((op) => op.operation).join(", ");

    return {
      requires_user_confirmation: true,
      tier: GitOperationTier.REQUIRES_CONFIRMATION,
      operations: operations.map((op) => ({
        operation: op.operation,
        risk: op.risk_description,
        alternative: op.safer_alternative,
      })),
      confirmation_prompt: {
        question: `Do you want to proceed with this risky git operation: ${opList}?`,
        header: "Risky Git Op",
        options: [
          {
            value: "approve",
            label: "Yes, proceed with safety checkpoint",
            description: `Execute ${opList} after creating automatic safety checkpoint (git-safety-* branch)`,
          },
          {
            value: "deny",
            label: "No, cancel operation",
            description: "Do not execute this destructive operation",
          },
        ],
      },
    };
  }
}
