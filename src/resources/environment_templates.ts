/**
 * Environment templates for Codex Cloud GitHub integration
 *
 * These templates provide pre-configured setup scripts for different
 * technology stacks with 4-level fallback error handling.
 */

import { EnvironmentTemplate } from "../types/template_types.js";

/**
 * Common GitHub CLI installation function with 4-level fallback
 * Used across all GitHub-integrated templates
 */
const githubCliInstall = `# Install GitHub CLI with 4-level fallback
install_gh_cli() {
  echo "Installing GitHub CLI..."

  # Level 1: Standard APT installation
  if curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null; then
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
    if sudo apt update && sudo apt install gh -y 2>/dev/null; then
      echo "✅ GitHub CLI installed via APT"
      return 0
    fi
  fi

  # Level 2: Direct binary download
  echo "Trying alternative installation method..."
  if curl -sL https://github.com/cli/cli/releases/download/v2.40.0/gh_2.40.0_linux_amd64.tar.gz | tar -xz && sudo mv gh_2.40.0_linux_amd64/bin/gh /usr/local/bin/ 2>/dev/null; then
    echo "✅ GitHub CLI installed via direct download"
    return 0
  fi

  # Level 3: Graceful degradation
  echo ""
  echo "⚠️  WARNING: GitHub CLI installation failed"
  echo "   Git operations will work (clone, commit, push)"
  echo "   PR operations unavailable (manual PR creation required)"
  echo ""
  echo "   To enable PR operations, install gh manually:"
  echo "   https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
  echo ""
  return 0  # Don't fail setup
}

install_gh_cli

# Authenticate gh if available
if command -v gh >/dev/null 2>&1; then
  echo "$GITHUB_TOKEN" | gh auth login --with-token
  echo "✅ GitHub CLI authenticated"
else
  echo "⚠️  Skipping gh authentication (not installed)"
fi`;

/**
 * GitHub integration instructions (common across all GitHub templates)
 */
const githubInstructions = `## GitHub Integration Setup

### 1. Create Fine-Grained Personal Access Token

Visit: https://github.com/settings/tokens?type=beta

1. Click "Generate new token"
2. **Repository access**: Select specific repositories
3. **Permissions** (select these):
   - ✓ Contents: Read and write
   - ✓ Pull requests: Read and write
   - ✓ Metadata: Read (auto-selected)
   - ✓ Workflows: Read and write
4. Generate token and **copy it** (you won't see it again!)

### 2. Configure Codex Cloud Environment

Visit: https://chatgpt.com/codex/settings/environments

1. Create new environment or edit existing
2. **Repository URL**: Your GitHub repo (e.g., https://github.com/user/repo)
3. **Default branch**: main (or your default)
4. **Advanced → Secrets**:
   - Name: \`GITHUB_TOKEN\`
   - Value: Paste your token
5. **Environment variables**:
   - \`GIT_USER_NAME\`: Your Name
   - \`GIT_USER_EMAIL\`: your@email.com
6. **Setup script**: Copy setup script from template
7. **Maintenance script**: Copy maintenance script from template
8. **Save environment**

### 3. Test Setup

Use \`codex_cloud_submit\` with task:

\`\`\`
"Create a test branch called codex-setup-test and create a PR with a simple README change"
\`\`\`

If successful, your environment is ready for autonomous PR workflows!

### Troubleshooting

**Issue**: Authentication fails
- Check token is valid (not expired)
- Verify token has correct permissions
- Ensure token added as secret (not environment variable)

**Issue**: GitHub CLI not found
- Check setup script ran successfully
- Verify \`gh --version\` in container

**Issue**: Can't create PR
- Verify \`Pull requests: Read and write\` permission
- Check branch exists and has commits
- Ensure repository allows PRs`;

/**
 * All environment templates
 */
export const templates: EnvironmentTemplate[] = [
  // Template 1: Node.js/TypeScript with GitHub integration
  {
    name: "github-node-typescript",
    description:
      "Node.js/TypeScript project with GitHub integration and PR workflow",
    repoTypes: ["node", "typescript", "javascript"],
    setupScript: `#!/bin/bash
set -e

# Configure git identity
git config --global user.name "$GIT_USER_NAME"
git config --global user.email "$GIT_USER_EMAIL"

# Configure git to use GITHUB_TOKEN
git config --global url."https://$GITHUB_TOKEN@github.com/".insteadOf "https://github.com/"

${githubCliInstall}

# Install Node.js dependencies
if [ -f "package.json" ]; then
  echo "Installing Node.js dependencies..."
  npm install
  echo "✅ Dependencies installed"
else
  echo "⚠️  No package.json found, skipping npm install"
fi

echo ""
echo "✅ Environment setup complete!"
echo "   Git configured: $GIT_USER_NAME <$GIT_USER_EMAIL>"
echo "   GitHub auth: $(command -v gh >/dev/null 2>&1 && echo 'Ready' || echo 'Not available')"
echo "   Node version: $(node --version)"
echo "   npm version: $(npm --version)"`,

    maintenanceScript: `#!/bin/bash
# Update dependencies for cached containers
if [ -f "package.json" ]; then
  npm install
fi`,

    requiredSecrets: ["GITHUB_TOKEN"],

    environmentVariables: {
      GIT_USER_NAME: "Codex Agent",
      GIT_USER_EMAIL: "codex@example.com",
      NODE_ENV: "development",
    },

    instructions: githubInstructions,
  },

  // Template 2: Python with GitHub integration
  {
    name: "github-python",
    description: "Python project with GitHub integration and PR workflow",
    repoTypes: ["python"],
    setupScript: `#!/bin/bash
set -e

# Configure git identity
git config --global user.name "$GIT_USER_NAME"
git config --global user.email "$GIT_USER_EMAIL"

# Configure git to use GITHUB_TOKEN
git config --global url."https://$GITHUB_TOKEN@github.com/".insteadOf "https://github.com/"

${githubCliInstall}

# Install Python dependencies
if [ -f "requirements.txt" ]; then
  echo "Installing Python dependencies..."
  pip install -r requirements.txt
  echo "✅ Dependencies installed"
elif [ -f "pyproject.toml" ]; then
  echo "Installing Python dependencies (Poetry)..."
  pip install poetry
  poetry install
  echo "✅ Dependencies installed"
else
  echo "⚠️  No requirements.txt or pyproject.toml found, skipping pip install"
fi

echo ""
echo "✅ Environment setup complete!"
echo "   Git configured: $GIT_USER_NAME <$GIT_USER_EMAIL>"
echo "   GitHub auth: $(command -v gh >/dev/null 2>&1 && echo 'Ready' || echo 'Not available')"
echo "   Python version: $(python --version)"
echo "   pip version: $(pip --version)"`,

    maintenanceScript: `#!/bin/bash
# Update dependencies for cached containers
if [ -f "requirements.txt" ]; then
  pip install -r requirements.txt
elif [ -f "pyproject.toml" ]; then
  poetry install
fi`,

    requiredSecrets: ["GITHUB_TOKEN"],

    environmentVariables: {
      GIT_USER_NAME: "Codex Agent",
      GIT_USER_EMAIL: "codex@example.com",
      PYTHONUNBUFFERED: "1",
    },

    instructions: githubInstructions,
  },

  // Template 3: Go with GitHub integration
  {
    name: "github-go",
    description: "Go project with GitHub integration and PR workflow",
    repoTypes: ["go", "golang"],
    setupScript: `#!/bin/bash
set -e

# Configure git identity
git config --global user.name "$GIT_USER_NAME"
git config --global user.email "$GIT_USER_EMAIL"

# Configure git to use GITHUB_TOKEN
git config --global url."https://$GITHUB_TOKEN@github.com/".insteadOf "https://github.com/"

${githubCliInstall}

# Install Go dependencies
if [ -f "go.mod" ]; then
  echo "Installing Go dependencies..."
  go mod download
  echo "✅ Dependencies installed"
else
  echo "⚠️  No go.mod found, skipping go mod download"
fi

echo ""
echo "✅ Environment setup complete!"
echo "   Git configured: $GIT_USER_NAME <$GIT_USER_EMAIL>"
echo "   GitHub auth: $(command -v gh >/dev/null 2>&1 && echo 'Ready' || echo 'Not available')"
echo "   Go version: $(go version)"`,

    maintenanceScript: `#!/bin/bash
# Update dependencies for cached containers
if [ -f "go.mod" ]; then
  go mod download
fi`,

    requiredSecrets: ["GITHUB_TOKEN"],

    environmentVariables: {
      GIT_USER_NAME: "Codex Agent",
      GIT_USER_EMAIL: "codex@example.com",
      GO111MODULE: "on",
    },

    instructions: githubInstructions,
  },

  // Template 4: Rust with GitHub integration
  {
    name: "github-rust",
    description: "Rust project with GitHub integration and PR workflow",
    repoTypes: ["rust"],
    setupScript: `#!/bin/bash
set -e

# Configure git identity
git config --global user.name "$GIT_USER_NAME"
git config --global user.email "$GIT_USER_EMAIL"

# Configure git to use GITHUB_TOKEN
git config --global url."https://$GITHUB_TOKEN@github.com/".insteadOf "https://github.com/"

${githubCliInstall}

# Build Rust project to cache dependencies
if [ -f "Cargo.toml" ]; then
  echo "Building Rust project (caching dependencies)..."
  cargo build
  echo "✅ Dependencies cached"
else
  echo "⚠️  No Cargo.toml found, skipping cargo build"
fi

echo ""
echo "✅ Environment setup complete!"
echo "   Git configured: $GIT_USER_NAME <$GIT_USER_EMAIL>"
echo "   GitHub auth: $(command -v gh >/dev/null 2>&1 && echo 'Ready' || echo 'Not available')"
echo "   Rust version: $(rustc --version)"
echo "   Cargo version: $(cargo --version)"`,

    maintenanceScript: `#!/bin/bash
# Update dependencies for cached containers
if [ -f "Cargo.toml" ]; then
  cargo build
fi`,

    requiredSecrets: ["GITHUB_TOKEN"],

    environmentVariables: {
      GIT_USER_NAME: "Codex Agent",
      GIT_USER_EMAIL: "codex@example.com",
      RUST_BACKTRACE: "1",
    },

    instructions: githubInstructions,
  },

  // Template 5: Basic Codex Cloud (no GitHub integration)
  {
    name: "basic-codex-cloud",
    description: "Basic Codex Cloud environment without GitHub integration",
    repoTypes: ["generic"],
    setupScript: `#!/bin/bash
set -e

# Configure git identity (for local operations)
git config --global user.name "$GIT_USER_NAME"
git config --global user.email "$GIT_USER_EMAIL"

echo ""
echo "✅ Basic environment setup complete!"
echo "   Git configured: $GIT_USER_NAME <$GIT_USER_EMAIL>"
echo ""
echo "ℹ️  This is a basic template without GitHub integration."
echo "   For PR workflows, use a github-* template instead."`,

    maintenanceScript: `#!/bin/bash
# No maintenance required for basic template
echo "No maintenance tasks for basic template"`,

    requiredSecrets: [],

    environmentVariables: {
      GIT_USER_NAME: "Codex Agent",
      GIT_USER_EMAIL: "codex@example.com",
    },

    instructions: `## Basic Codex Cloud Setup

This template provides minimal git configuration without GitHub integration.

### When to Use

- Local-only development tasks
- Code analysis and refactoring
- Tasks that don't require PR creation
- Exploratory work without version control

### Setup

1. Visit: https://chatgpt.com/codex/settings/environments
2. Create new environment
3. **Repository URL**: Any git repository (GitHub not required)
4. **Environment variables**:
   - \`GIT_USER_NAME\`: Your Name
   - \`GIT_USER_EMAIL\`: your@email.com
5. **Setup script**: Copy setup script from template
6. **Save environment**

### Limitations

- No PR creation (use github-* templates for this)
- No GitHub CLI integration
- No automatic branch management

### Upgrade Path

To add GitHub integration later:
1. Choose appropriate github-* template (node, python, go, rust)
2. Add GITHUB_TOKEN secret
3. Update setup script`,
  },
];

/**
 * Get template by name
 */
export function getTemplate(name: string): EnvironmentTemplate | undefined {
  return templates.find((t) => t.name === name);
}

/**
 * Get templates by repo type
 */
export function getTemplatesByRepoType(
  repoType: string,
): EnvironmentTemplate[] {
  return templates.filter((t) => t.repoTypes.includes(repoType));
}

/**
 * List all GitHub-integrated templates
 */
export function getGitHubTemplates(): EnvironmentTemplate[] {
  return templates.filter((t) => t.name.startsWith("github-"));
}
