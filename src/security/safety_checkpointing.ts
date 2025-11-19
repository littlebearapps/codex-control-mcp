/**
 * Git Operations Safety - Auto-Checkpointing
 *
 * Creates safety checkpoints before risky git operations:
 * - Safety branch pointing to current HEAD
 * - Stash for dirty working tree
 * - Extended reflog retention
 */

import { spawn } from "child_process";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

export interface CheckpointResult {
  safety_branch: string;
  stash_ref?: string;
  head_oid: string;
  created_at: string;
  working_tree_was_dirty: boolean;
}

export class SafetyCheckpointing {
  /**
   * Sanitize operation name for use in git branch names
   * Removes/replaces all characters invalid in git branch names per git-check-ref-format
   */
  private sanitizeOperationName(operation: string): string {
    return operation
      .toLowerCase()
      .replace(/[~^:?*[\\\s@{}]/g, "-") // Replace invalid chars with dash
      .replace(/\.{2,}/g, "-") // Replace .. with dash
      .replace(/-+/g, "-") // Collapse multiple dashes
      .replace(/^-|-$/g, ""); // Remove leading/trailing dashes
  }

  /**
   * Create safety checkpoint before risky operation
   */
  async createCheckpoint(
    operation: string,
    workingDir: string,
  ): Promise<CheckpointResult> {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const headOid = await this.getHeadOid(workingDir);
    const shortSha = headOid.slice(0, 7);

    // Sanitize operation name for use in branch name
    const sanitizedOperation = this.sanitizeOperationName(operation);

    // Create safety branch name
    const safetyBranch = `safety/${sanitizedOperation}-${timestamp}-${shortSha}`;

    // Create safety branch pointing to current HEAD
    await this.execGit(workingDir, ["branch", safetyBranch, "HEAD"]);

    // Check if working tree is dirty
    const status = await this.execGit(workingDir, ["status", "--porcelain"]);
    const isDirty = status.stdout.trim().length > 0;

    let stashRef: string | undefined;
    if (isDirty) {
      // Stash uncommitted changes including untracked files
      const stashMessage = `auto-checkpoint: ${operation} at ${timestamp}`;
      await this.execGit(workingDir, [
        "stash",
        "push",
        "-u",
        "-m",
        stashMessage,
      ]);
      stashRef = "stash@{0}";
    }

    // Extend reflog retention to 90 days
    await this.execGit(workingDir, ["config", "gc.reflogExpire", "90.days"]);
    await this.execGit(workingDir, [
      "config",
      "gc.reflogExpireUnreachable",
      "90.days",
    ]);

    const result: CheckpointResult = {
      safety_branch: safetyBranch,
      stash_ref: stashRef,
      head_oid: headOid,
      created_at: new Date().toISOString(),
      working_tree_was_dirty: isDirty,
    };

    // Log checkpoint for audit trail
    this.logCheckpoint(result, operation, workingDir);

    return result;
  }

  /**
   * Get current HEAD commit OID
   */
  private async getHeadOid(workingDir: string): Promise<string> {
    const result = await this.execGit(workingDir, ["rev-parse", "HEAD"]);
    return result.stdout.trim();
  }

  /**
   * Execute git command safely
   */
  private async execGit(
    workingDir: string,
    args: string[],
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn("git", args, {
        cwd: workingDir,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0", // Disable git prompts
        },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Git command failed (exit ${code}): ${stderr}`));
        }
      });
    });
  }

  /**
   * Log checkpoint to audit trail
   */
  private logCheckpoint(
    checkpoint: CheckpointResult,
    operation: string,
    workingDir: string,
  ): void {
    try {
      const logDir = path.join(os.homedir(), ".config", "mcp-delegator");
      const logFile = path.join(logDir, "checkpoints.log");

      // Create directory if it doesn't exist
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logEntry = {
        timestamp: checkpoint.created_at,
        operation: operation,
        working_dir: workingDir,
        safety_branch: checkpoint.safety_branch,
        stash_ref: checkpoint.stash_ref,
        head_oid: checkpoint.head_oid,
        working_tree_was_dirty: checkpoint.working_tree_was_dirty,
      };

      // Append to log file
      fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n");
    } catch (error) {
      // Log error but don't fail checkpoint creation
      console.error("Failed to write checkpoint log:", error);
    }
  }

  /**
   * Format recovery instructions for user
   */
  formatRecoveryInstructions(checkpoint: CheckpointResult): string {
    let instructions = `✅ Safety checkpoint created at: ${checkpoint.safety_branch}\n\n`;

    instructions += `To rollback if needed:\n`;
    instructions += `  git reset --hard ${checkpoint.safety_branch}\n`;

    if (checkpoint.stash_ref) {
      instructions += `\nTo restore uncommitted changes:\n`;
      instructions += `  git stash pop ${checkpoint.stash_ref}\n`;
    }

    instructions += `\nTo view checkpoint details:\n`;
    instructions += `  git show ${checkpoint.safety_branch}\n`;

    return instructions;
  }

  /**
   * Cleanup old safety branches (older than 30 days)
   */
  async cleanupOldCheckpoints(
    workingDir: string,
    daysToKeep: number = 30,
  ): Promise<number> {
    try {
      // List all safety branches
      const result = await this.execGit(workingDir, [
        "for-each-ref",
        "--format=%(refname:short) %(creatordate:unix)",
        "refs/heads/safety/",
      ]);

      const lines = result.stdout.trim().split("\n").filter(Boolean);
      const cutoffTime = Date.now() / 1000 - daysToKeep * 24 * 60 * 60;
      let deletedCount = 0;

      for (const line of lines) {
        const [branchName, timestampStr] = line.split(" ");
        const timestamp = parseInt(timestampStr, 10);

        if (timestamp < cutoffTime) {
          try {
            await this.execGit(workingDir, ["branch", "-D", branchName]);
            deletedCount++;
          } catch (error) {
            console.error(
              `Failed to delete old safety branch ${branchName}:`,
              error,
            );
          }
        }
      }

      return deletedCount;
    } catch (error) {
      console.error("Failed to cleanup old checkpoints:", error);
      return 0;
    }
  }
}
