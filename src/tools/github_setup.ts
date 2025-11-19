/**
 * GitHub Setup Helper Tool
 *
 * Provides interactive guide for configuring GitHub integration with Codex Cloud.
 * Generates custom setup scripts, token creation instructions, and test tasks.
 */

import { getTemplate } from "../resources/environment_templates.js";

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
export class GitHubSetupTool {
  /**
   * Get tool schema for MCP registration
   */
  static getSchema() {
    return {
      name: "_codex_cloud_github_setup",
      description:
        "Generate a custom GitHub setup guide - like a personalized installation wizard. Provide your repo URL and tech stack (node/python/go/rust), and get back a complete guide: how to create a fine-grained GitHub token, Codex Cloud environment config, pre-filled setup scripts, and a test task to verify everything works. Think of it as \"setup in a box\" for autonomous PR workflows. Use this when: you're integrating a new repo with Codex Cloud and want GitHub capabilities (branch creation, commits, PRs). Returns: step-by-step guide with copy-paste commands, troubleshooting tips, and a verification task. Perfect for: first-time setup, adding new repos, or when you forgot the token permissions. The generated guide is repo-specific with your URLs and settings filled in. Avoid for: repos already configured (just use _codex_cloud_submit), or if you don't need GitHub integration.",
      inputSchema: {
        type: "object",
        properties: {
          repoUrl: {
            type: "string",
            description:
              "GitHub repository URL (e.g., https://github.com/user/repo)",
          },
          stack: {
            type: "string",
            enum: ["node", "python", "go", "rust"],
            description: "Technology stack for your project",
          },
          gitUserName: {
            type: "string",
            description: 'Git user name (optional, defaults to "Codex Agent")',
          },
          gitUserEmail: {
            type: "string",
            description:
              'Git user email (optional, defaults to "codex@example.com")',
          },
          format: {
            type: "string",
            enum: ["json", "markdown"],
            default: "markdown",
            description:
              "Response format. Default markdown for backward compatibility.",
          },
        },
        required: ["repoUrl", "stack"],
      },
    };
  }

  /**
   * Execute tool to generate custom setup guide
   */
  async execute(input: GitHubSetupInput): Promise<GitHubSetupResult> {
    // Validate repository URL
    if (!input.repoUrl.startsWith("https://github.com/")) {
      if (input.format === "json") {
        const json = {
          version: "3.6",
          schema_id: "codex/v3.6/registry_info/v1",
          tool: "_codex_cloud_github_setup",
          tool_category: "registry_info",
          request_id: (await import("crypto")).randomUUID(),
          ts: new Date().toISOString(),
          status: "error" as const,
          meta: {},
          error: {
            code: "VALIDATION" as const,
            message:
              "Invalid repository URL (must start with https://github.com/)",
            details: { repoUrl: input.repoUrl },
            retryable: false,
          },
        };
        return {
          content: [{ type: "text", text: JSON.stringify(json) }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `❌ Invalid Repository URL

The repository URL must be a GitHub URL starting with https://github.com/

**Example**: https://github.com/user/repo

**You provided**: ${input.repoUrl}`,
          },
        ],
        isError: true,
      };
    }

    // Load appropriate template (map stack to full template name)
    const stackToTemplate: Record<string, string> = {
      node: "github-node-typescript",
      python: "github-python",
      go: "github-go",
      rust: "github-rust",
    };
    const templateName = stackToTemplate[input.stack];
    const template = getTemplate(templateName);

    if (!template) {
      return {
        content: [
          {
            type: "text",
            text: `❌ No template found for stack: ${input.stack}

**Supported stacks**: node, python, go, rust

**You provided**: ${input.stack}`,
          },
        ],
        isError: true,
      };
    }

    // Extract repository details
    const repoPath = input.repoUrl.replace("https://github.com/", "");
    const repoName = repoPath.split("/").pop() || "repository";
    const repoOwnerAndName = repoPath;

    // Customize environment variables
    const gitUserName = input.gitUserName || "Codex Agent";
    const gitUserEmail = input.gitUserEmail || "codex@example.com";

    // Determine environment variable for stack
    let stackEnvVar = "";
    switch (input.stack) {
      case "node":
        stackEnvVar = "- `NODE_ENV`: development";
        break;
      case "python":
        stackEnvVar = "- `PYTHONUNBUFFERED`: 1";
        break;
      case "go":
        stackEnvVar = "- `GO111MODULE`: on";
        break;
      case "rust":
        stackEnvVar = "- `RUST_BACKTRACE`: 1";
        break;
    }

    // Generate response
    const message = `# 🚀 GitHub Integration Setup Guide

## 📝 Repository Configuration

**Repository**: ${input.repoUrl}
**Stack**: ${input.stack}
**Template**: ${templateName}

---

## 🔐 Step 1: Create Fine-Grained GitHub Token

Visit: **https://github.com/settings/tokens?type=beta**

1. Click **"Generate new token"**
2. **Token name**: \`Codex Cloud - ${repoName}\`
3. **Expiration**: 90 days (or custom)
4. **Repository access**: **Only select repositories**
   - Choose: **${repoOwnerAndName}**
5. **Permissions** (select these):
   - ✅ **Contents**: Read and write
   - ✅ **Pull requests**: Read and write
   - ✅ **Metadata**: Read (auto-selected)
   - ✅ **Workflows**: Read and write
6. Click **"Generate token"**
7. **⚠️ IMPORTANT**: Copy the token immediately (you won't see it again!)

---

## ⚙️ Step 2: Configure Codex Cloud Environment

Visit: **https://chatgpt.com/codex/settings/environments**

### 2.1 Basic Configuration

1. Click **"Create environment"** (or edit existing)
2. **Environment name**: \`${repoName}-codex\`
3. **Repository URL**: \`${input.repoUrl}\`
4. **Default branch**: \`main\` (or your default branch)

### 2.2 Advanced Configuration

Click **"Advanced"** to expand advanced settings:

#### Secrets

Click **"Add secret"**:
- **Name**: \`GITHUB_TOKEN\`
- **Value**: Paste your token from Step 1
- **⚠️ IMPORTANT**: Add as SECRET, not environment variable!

#### Environment Variables

Add these environment variables:
- \`GIT_USER_NAME\`: \`${gitUserName}\`
- \`GIT_USER_EMAIL\`: \`${gitUserEmail}\`
${stackEnvVar}

#### Setup Script

Copy and paste this entire script:

\`\`\`bash
${template.setupScript}
\`\`\`

#### Maintenance Script

Copy and paste this script:

\`\`\`bash
${template.maintenanceScript}
\`\`\`

### 2.3 Save Environment

Click **"Save environment"**

---

## ✅ Step 3: Test GitHub Integration

Use \`codex_cloud_submit\` to verify setup:

\`\`\`json
{
  "task": "Create a test branch called 'codex-setup-verification' from main, add a comment '# Setup Verified - ${new Date().toISOString()}' to the top of README.md, commit with message 'test: Verify Codex Cloud GitHub integration', and create a PR titled 'Test: Codex Cloud Setup Verification'",
  "envId": "YOUR_ENVIRONMENT_ID_HERE"
}
\`\`\`

**Where to find Environment ID**:
- Visit https://chatgpt.com/codex/settings/environments
- Copy the ID from your newly created environment

**Expected Results**:
- ✅ Branch created: \`codex-setup-verification\`
- ✅ README.md modified with comment
- ✅ Commit created with proper message
- ✅ Pull request created on GitHub
- ✅ CI tests triggered (if configured)

**If all successful**: 🎉 **GitHub integration is working!**

---

## 🔧 Troubleshooting

### Issue: "Authentication failed"

**Symptoms**:
- "remote: Invalid username or password"
- "fatal: Authentication failed"

**Solutions**:
1. Check token hasn't expired (GitHub settings)
2. Verify token has all required permissions:
   - Contents: Read and write
   - Pull requests: Read and write
   - Workflows: Read and write
3. Ensure token added as **SECRET** (not environment variable)
4. Verify repository access includes your specific repository

**Test token manually**:
\`\`\`bash
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user
\`\`\`

### Issue: "GitHub CLI not found"

**Symptoms**:
- "gh: command not found"
- PRs cannot be created

**Solutions**:
1. Check Codex Cloud environment logs for setup script errors
2. Verify setup script ran successfully
3. The 4-level fallback should handle this gracefully
4. If gh is unavailable, you can still:
   - Clone repositories
   - Commit and push changes
   - Manual PR creation required (via GitHub web UI)

**Verify in Codex Cloud task**:
\`\`\`bash
gh --version
\`\`\`

### Issue: "Can't create pull request"

**Symptoms**:
- "failed to create pull request"
- "403 Forbidden"

**Solutions**:
1. Confirm token has "Pull requests: Read and write" permission
2. Check branch exists and has commits
3. Verify branch is not protected
4. Ensure repository allows pull requests
5. Check you're not creating duplicate PR

**Manual verification**:
- Visit repository on GitHub
- Try creating PR manually with same branch

### Issue: "Setup script failed"

**Symptoms**:
- Environment setup errors in logs
- Missing dependencies

**Solutions**:
1. Check Codex Cloud logs for specific error messages
2. Verify all required secrets are set
3. Ensure environment variables are correct
4. Try re-running setup script
5. Check network connectivity in Codex Cloud

**Common causes**:
- Missing \`GITHUB_TOKEN\` secret
- Incorrect git user configuration
- Package manager issues (temporary)

---

## 📚 Next Steps

### Autonomous PR Workflow

Once setup is complete, you can use Codex Cloud for:

1. **Feature Development**:
   \`\`\`
   "Create feature branch 'feature/add-user-auth', implement JWT authentication, add tests, create PR titled 'Add JWT Authentication'"
   \`\`\`

2. **Bug Fixes**:
   \`\`\`
   "Create bugfix branch 'fix/login-error', fix the login timeout issue in auth.ts, add test, create PR titled 'Fix: Login timeout error'"
   \`\`\`

3. **Refactoring**:
   \`\`\`
   "Create refactor branch 'refactor/api-client', extract API client to separate module, update tests, create PR titled 'Refactor: Extract API client module'"
   \`\`\`

### Best Practices

- ✅ Always specify exact branch names
- ✅ Include testing requirements in task description
- ✅ Define success criteria explicitly
- ✅ Provide clear PR title and description
- ❌ Don't use vague task descriptions
- ❌ Don't merge PRs automatically (manual review required)

### Learn More

- **Templates**: Use \`mcp__mcp-delegator__resources/list\` to see all templates
- **Documentation**: See CONTRIBUTING.md for template customization
- **Support**: https://github.com/littlebearapps/mcp-delegator/issues

---

**Setup Guide Generated**: ${new Date().toISOString()}
**Template Used**: ${templateName}
**Repository**: ${input.repoUrl}

🎉 **You're all set! Happy coding with Codex Cloud!**`;

    if (input.format === "json") {
      const json = {
        version: "3.6",
        schema_id: "codex/v3.6/registry_info/v1",
        tool: "_codex_cloud_github_setup",
        tool_category: "registry_info",
        request_id: (await import("crypto")).randomUUID(),
        ts: new Date().toISOString(),
        status: "ok" as const,
        meta: { repository: input.repoUrl, tech_stack: input.stack },
        data: {
          guide: message,
          steps: [
            {
              step: 1,
              title: "Create Fine-Grained Token",
              instructions:
                "Visit https://github.com/settings/tokens?type=beta and create a token with required permissions.",
            },
            {
              step: 2,
              title: "Configure Environment",
              instructions:
                "Add token as GITHUB_TOKEN secret and environment variables, paste setup scripts, save.",
            },
            {
              step: 3,
              title: "Verify Setup",
              instructions:
                "Submit a verification task to create a PR and validate integration.",
            },
          ],
          verification_task: "Create a test branch and PR to verify setup",
        },
      };
      return { content: [{ type: "text", text: JSON.stringify(json) }] };
    }
    return {
      content: [
        {
          type: "text",
          text: message,
        },
      ],
    };
  }
}
