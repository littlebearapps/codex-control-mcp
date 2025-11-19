/**
 * Git Verification Layer for Codex Control MCP
 *
 * Purpose: Verify git operations actually succeeded after Codex execution
 * Root Cause: Codex SDK suppresses stdout/stderr for non-zero exit codes (Issue #1367)
 * Solution: Run independent git commands to check branch, commits, staging
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface GitVerificationResult {
  // Branch verification
  branchExists: boolean;
  expectedBranch?: string;
  actualBranch?: string;

  // Commit verification
  commitExists: boolean;
  expectedCommitMessage?: string;
  actualCommitMessage?: string;
  commitHash?: string;

  // Staging verification
  filesStaged: boolean;
  unstagedFiles: string[];
  stagedFiles: string[];

  // Working tree verification
  workingTreeClean: boolean;
  modifiedFiles: string[];
  untrackedFiles: string[];

  // Results
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

/**
 * Parse task description to extract expected git operations
 */
function parseGitExpectations(taskDescription: string): {
  expectBranch?: string;
  expectCommit?: boolean;
  expectCommitMessage?: string;
  expectFilesStaged?: string[];
  expectGitOperations: boolean;
} {
  const lower = taskDescription.toLowerCase();

  // Check if task involves git operations
  const gitKeywords = [
    "branch",
    "commit",
    "stage",
    "git add",
    "git checkout",
    "git commit",
  ];
  const expectGitOperations = gitKeywords.some((keyword) =>
    lower.includes(keyword),
  );

  const result: any = {
    expectGitOperations,
  };

  // Extract expected branch name
  // Patterns: "create branch feature/branch-name", "checkout -b feature/branch-name"
  const branchPatterns = [
    /(?:create|checkout)\s+(?:feature\s+)?branch\s+[`'"]?([a-z0-9_/-]+)[`'"]?/i,
    /git\s+checkout\s+-b\s+[`'"]?([a-z0-9_/-]+)[`'"]?/i,
    /branch\s+[`'"]([a-z0-9_/-]+)[`'"]/i,
  ];

  for (const pattern of branchPatterns) {
    const match = taskDescription.match(pattern);
    if (match) {
      result.expectBranch = match[1];
      break;
    }
  }

  // Check if commit expected
  result.expectCommit = lower.includes("commit");

  // Extract expected commit message
  // Patterns: 'commit message: "..."', 'commit -m "..."'
  const commitPatterns = [
    /commit\s+(?:with\s+)?message[:\s]+[`'"]([^`'"]+)[`'"]/i,
    /git\s+commit\s+-m\s+[`'"]([^`'"]+)[`'"]/i,
    /commit[:\s]+[`'"]([^`'"]+)[`'"]/i,
  ];

  for (const pattern of commitPatterns) {
    const match = taskDescription.match(pattern);
    if (match) {
      result.expectCommitMessage = match[1];
      break;
    }
  }

  // Extract files to stage
  // Patterns: "add: file.py", "stage file.py", "git add file.py"
  const filePatterns = [
    /(?:add|stage):\s+([a-z0-9_/.+-]+)/gi,
    /git\s+add\s+([a-z0-9_/.+-]+)/gi,
  ];

  const files = new Set<string>();
  for (const pattern of filePatterns) {
    let match;
    while ((match = pattern.exec(taskDescription)) !== null) {
      files.add(match[1]);
    }
  }

  if (files.size > 0) {
    result.expectFilesStaged = Array.from(files);
  }

  return result;
}

/**
 * Run git command safely
 */
async function runGit(
  command: string,
  workingDir: string,
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: workingDir,
      timeout: 5000, // 5 second timeout
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), success: true };
  } catch (error: any) {
    return {
      stdout: error.stdout?.trim() || "",
      stderr: error.stderr?.trim() || "",
      success: false,
    };
  }
}

/**
 * Verify git operations after Codex execution
 */
export async function verifyGitOperations(
  workingDir: string,
  taskDescription: string,
): Promise<GitVerificationResult> {
  const result: GitVerificationResult = {
    branchExists: false,
    commitExists: false,
    filesStaged: false,
    unstagedFiles: [],
    stagedFiles: [],
    workingTreeClean: true,
    modifiedFiles: [],
    untrackedFiles: [],
    errors: [],
    warnings: [],
    recommendations: [],
  };

  // Parse expectations from task description
  const expectations = parseGitExpectations(taskDescription);

  // Skip verification if no git operations expected
  if (!expectations.expectGitOperations) {
    console.error(
      "[GitVerifier] No git operations expected, skipping verification",
    );
    return result;
  }

  console.error("[GitVerifier] Starting verification in:", workingDir);
  console.error("[GitVerifier] Expectations:", expectations);

  // 1. Check current branch
  const branchCheck = await runGit(
    "git rev-parse --abbrev-ref HEAD",
    workingDir,
  );
  if (branchCheck.success) {
    result.actualBranch = branchCheck.stdout;
    console.error("[GitVerifier] Current branch:", result.actualBranch);

    // Verify expected branch
    if (expectations.expectBranch) {
      result.expectedBranch = expectations.expectBranch;
      result.branchExists = result.actualBranch === expectations.expectBranch;

      if (!result.branchExists) {
        result.errors.push(
          `Branch not created: Expected \`${expectations.expectBranch}\`, still on \`${result.actualBranch}\``,
        );
        result.recommendations.push(
          `Create branch manually: \`git checkout -b ${expectations.expectBranch}\``,
        );
      }
    }
  } else {
    result.warnings.push("Could not determine current git branch");
  }

  // 2. Check latest commit
  const commitCheck = await runGit(
    'git log -1 --pretty=format:"%H|%s"',
    workingDir,
  );
  if (commitCheck.success && commitCheck.stdout) {
    const [hash, message] = commitCheck.stdout.split("|");
    result.commitHash = hash;
    result.actualCommitMessage = message;
    console.error("[GitVerifier] Latest commit:", message);

    // Verify expected commit
    if (expectations.expectCommit && expectations.expectCommitMessage) {
      result.expectedCommitMessage = expectations.expectCommitMessage;
      const messageMatches = message.includes(
        expectations.expectCommitMessage.substring(0, 20),
      );
      result.commitExists = messageMatches;

      if (!messageMatches) {
        result.errors.push(
          `Commit not found: Expected message containing "${expectations.expectCommitMessage.substring(0, 40)}...", got "${message}"`,
        );
        result.recommendations.push(
          `Create commit manually: \`git commit -m "${expectations.expectCommitMessage}"\``,
        );
      }
    }
  }

  // 3. Check staging status (git status --porcelain)
  const statusCheck = await runGit("git status --porcelain", workingDir);
  if (statusCheck.success) {
    const lines = statusCheck.stdout.split("\n").filter((l) => l.trim());

    for (const line of lines) {
      const status = line.substring(0, 2);
      const file = line.substring(3).trim();

      // Staged files (M , A , D , R , etc. in first column)
      if (status[0] !== " " && status[0] !== "?") {
        result.stagedFiles.push(file);
      }

      // Unstaged changes (second column not space)
      if (status[1] !== " " && status[1] !== "?") {
        result.unstagedFiles.push(file);
        result.modifiedFiles.push(file);
      }

      // Untracked files (??)
      if (status === "??") {
        result.untrackedFiles.push(file);
        result.unstagedFiles.push(file);
      }
    }

    result.filesStaged = result.stagedFiles.length > 0;
    result.workingTreeClean = lines.length === 0;

    console.error("[GitVerifier] Staged files:", result.stagedFiles.length);
    console.error("[GitVerifier] Unstaged files:", result.unstagedFiles.length);
    console.error(
      "[GitVerifier] Untracked files:",
      result.untrackedFiles.length,
    );

    // Verify expected files staged
    if (
      expectations.expectFilesStaged &&
      expectations.expectFilesStaged.length > 0
    ) {
      const missingFiles = expectations.expectFilesStaged.filter(
        (f) =>
          !result.stagedFiles.includes(f) &&
          !result.stagedFiles.some((sf) => sf.includes(f)),
      );

      if (missingFiles.length > 0) {
        result.errors.push(`Files not staged: ${missingFiles.join(", ")}`);
        result.recommendations.push(
          `Stage files manually: \`git add ${missingFiles.join(" ")}\``,
        );
      }
    }

    // Warn about unstaged changes
    if (result.unstagedFiles.length > 0) {
      result.warnings.push(
        `${result.unstagedFiles.length} file(s) remain unstaged: ${result.unstagedFiles.slice(0, 3).join(", ")}${result.unstagedFiles.length > 3 ? "..." : ""}`,
      );
    }
  }

  // Summary
  console.error("[GitVerifier] Verification complete:");
  console.error("[GitVerifier]   Errors:", result.errors.length);
  console.error("[GitVerifier]   Warnings:", result.warnings.length);
  console.error(
    "[GitVerifier]   Recommendations:",
    result.recommendations.length,
  );

  return result;
}

/**
 * Format git verification results for user display
 */
export function formatGitVerification(
  verification: GitVerificationResult,
): string {
  const lines: string[] = [];

  lines.push("**Git Verification Results**:");

  // Branch status
  if (verification.expectedBranch) {
    const icon = verification.branchExists ? "✅" : "❌";
    const msg = verification.branchExists
      ? `Branch created: \`${verification.actualBranch}\``
      : `Branch not created: Expected \`${verification.expectedBranch}\`, still on \`${verification.actualBranch}\``;
    lines.push(`${icon} ${msg}`);
  } else if (verification.actualBranch) {
    lines.push(`ℹ️ Current branch: \`${verification.actualBranch}\``);
  }

  // Commit status
  if (verification.expectedCommitMessage) {
    const icon = verification.commitExists ? "✅" : "❌";
    const msg = verification.commitExists
      ? `Commit created: "${verification.actualCommitMessage?.substring(0, 60)}"`
      : `Commit not found: Expected message containing "${verification.expectedCommitMessage.substring(0, 40)}..."`;
    lines.push(`${icon} ${msg}`);
  } else if (verification.actualCommitMessage) {
    lines.push(
      `ℹ️ Latest commit: "${verification.actualCommitMessage.substring(0, 60)}"`,
    );
  }

  // Staging status
  if (verification.stagedFiles.length > 0) {
    lines.push(`✅ Files staged: ${verification.stagedFiles.length} file(s)`);
  }

  if (verification.unstagedFiles.length > 0) {
    lines.push(
      `⚠️ Files unstaged: ${verification.unstagedFiles.length} file(s)`,
    );
  }

  // Errors
  if (verification.errors.length > 0) {
    lines.push("");
    lines.push("**Errors**:");
    verification.errors.forEach((err) => lines.push(`- ❌ ${err}`));
  }

  // Warnings
  if (verification.warnings.length > 0) {
    lines.push("");
    lines.push("**Warnings**:");
    verification.warnings.forEach((warn) => lines.push(`- ⚠️ ${warn}`));
  }

  // Recommendations
  if (verification.recommendations.length > 0) {
    lines.push("");
    lines.push("**Recommended Actions**:");
    verification.recommendations.forEach((rec, i) =>
      lines.push(`${i + 1}. ${rec}`),
    );
  }

  return lines.join("\n");
}
