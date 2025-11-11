# Contributing to Codex Control MCP

Thank you for your interest in contributing to Codex Control MCP! This document provides guidelines for contributing, especially for environment templates.

## Table of Contents

- [Environment Templates](#environment-templates)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)

## Environment Templates

Environment templates provide pre-configured setup scripts for different technology stacks with GitHub integration.

### Template Structure

Each template must include:

```typescript
{
  name: string;              // Unique ID (lowercase, hyphens only)
  description: string;       // Human-readable description
  repoTypes: string[];       // Supported tech stacks
  setupScript: string;       // Bash script for first startup
  maintenanceScript: string; // Bash script for cached containers
  requiredSecrets: string[]; // Required Codex Cloud secrets
  environmentVariables: Record<string, string>;  // Default env vars
  instructions: string;      // Markdown setup instructions
}
```

### Adding a New Template

1. **Edit `src/resources/environment_templates.ts`**

```typescript
{
  name: 'github-your-stack',
  description: 'Your stack with GitHub integration',
  repoTypes: ['your-stack'],
  setupScript: `#!/bin/bash
set -e

# Configure git identity
git config --global user.name "$GIT_USER_NAME"
git config --global user.email "$GIT_USER_EMAIL"

# Configure git to use GITHUB_TOKEN
git config --global url."https://$GITHUB_TOKEN@github.com/".insteadOf "https://github.com/"

${githubCliInstall}  // Use common GitHub CLI installation

# Install your stack dependencies
# ... your setup commands ...
`,
  maintenanceScript: `#!/bin/bash
# Update dependencies for cached containers
# ... your maintenance commands ...
`,
  requiredSecrets: ['GITHUB_TOKEN'],
  environmentVariables: {
    GIT_USER_NAME: 'Codex Agent',
    GIT_USER_EMAIL: 'codex@example.com',
  },
  instructions: githubInstructions,  // Use common instructions
}
```

2. **Run validation**

```bash
npm run build
python3 scripts/validate_templates.py
```

3. **Test in Codex Cloud**

- Create test environment using your template
- Submit test task: "Create test branch and PR"
- Verify GitHub operations work

4. **Submit PR with**:

- Template code
- Test results (screenshots or logs)
- Documentation updates (if needed)

### Template Best Practices

#### Error Handling (4-Level Fallback)

All GitHub-integrated templates MUST use the 4-level fallback pattern:

```bash
# Level 1: Standard installation (APT, package manager)
if install_via_package_manager; then
  echo "✅ Installed via package manager"
  return 0
fi

# Level 2: Direct download (binary, precompiled)
if download_and_install_directly; then
  echo "✅ Installed via direct download"
  return 0
fi

# Level 3: Graceful degradation (warn, continue)
echo "⚠️  WARNING: Installation failed"
echo "   Core operations will work"
echo "   Some features unavailable"
echo "   Manual installation: [link]"
return 0  # DON'T fail setup

# Level 4: Manual instructions in output
```

**Why 4-level fallback?**

- Codex Cloud containers may have network restrictions
- Different base images may have different package managers
- Graceful degradation enables core workflows even if optional tools fail
- Clear instructions help users fix issues manually

#### Security Requirements

**MUST**:
- ✅ Use `$GITHUB_TOKEN` environment variable (never hardcode)
- ✅ Configure git auth via `git config url.insteadOf`
- ✅ Use secrets for sensitive data
- ✅ Include `set -e` for error handling

**MUST NOT**:
- ❌ Hardcode credentials or tokens
- ❌ Expose secrets in logs
- ❌ Use unquoted variable expansions
- ❌ Skip error handling

#### Script Quality

**Required**:
- Bash shebang: `#!/bin/bash`
- Error handling: `set -e`
- Status messages: `echo "✅ Step complete"`
- Warning messages: `echo "⚠️  Warning: ..."`
- Error messages: `echo "❌ Error: ..."`

**Recommended**:
- Check for file existence before operations
- Provide context in error messages
- Use conditional execution for optional steps
- Log version information for debugging

### Updating Existing Templates

When updating templates:

1. **Maintain Backward Compatibility**
   - Don't change template names
   - Don't remove required fields
   - Don't break existing environment setups

2. **Document Breaking Changes**
   - Note in CHANGELOG
   - Provide migration guide
   - Consider deprecation period

3. **Test Thoroughly**
   - Test in fresh Codex Cloud environment
   - Test with cached containers (maintenance script)
   - Verify GitHub operations still work

### Template Maintenance

Templates are **embedded** in the MCP server (not external files):

**Pros**:
- Bundled distribution (single npm package)
- Version locked with MCP server
- No external dependencies
- Claude Code reads from MCP resources

**Cons**:
- Updates require new MCP version
- Can't update templates independently

**When to Update**:
- New GitHub CLI version released
- Security vulnerabilities discovered
- User feedback on setup failures
- New technology stack requested

**Update Process**:
1. Edit templates in `src/resources/environment_templates.ts`
2. Run validation: `python3 scripts/validate_templates.py`
3. Test in Codex Cloud
4. Submit PR with test results
5. Document in CHANGELOG under "Templates" section

## Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/codex-control-mcp
cd codex-control-mcp

# Install dependencies
npm install

# Build
npm run build

# Run validation
python3 scripts/validate_templates.py

# Watch mode (development)
npm run watch
```

## Pull Request Process

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Follow coding standards
   - Add tests if applicable
   - Update documentation

3. **Validate**
   ```bash
   npm run build
   python3 scripts/validate_templates.py
   ```

4. **Commit**
   ```bash
   git commit -m "feat: add your feature"
   ```
   Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   - Provide clear description
   - Reference related issues
   - Include test results for templates

6. **CI Validation**
   - GitHub Actions will validate templates
   - All checks must pass before merge

## Testing

### Unit Tests
```bash
npm test
```

### Template Validation
```bash
npm run build
python3 scripts/validate_templates.py
```

### Manual Testing (Codex Cloud)

For template changes, manual testing in Codex Cloud is **required**:

1. Create test environment with your template
2. Run test task:
   ```
   "Create test branch called codex-test-$(date +%s), add a comment to README, create PR"
   ```
3. Verify:
   - Branch created successfully
   - Changes committed
   - PR created with proper title
   - CI triggered (if configured)
4. Document results in PR

### Test Matrix

For new templates, test on:
- ✅ Fresh Codex Cloud environment (setup script)
- ✅ Cached container (maintenance script)
- ✅ GitHub operations (clone, push, PR)
- ✅ Error scenarios (missing secrets, network issues)

## Questions?

- Open an issue for questions or discussions
- Check existing issues before creating new ones
- Be respectful and constructive

Thank you for contributing! 🎉
