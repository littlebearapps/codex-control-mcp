# Contributing to MCP Delegator

Thank you for your interest in contributing to **mcp-delegator**! This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [Code Quality Standards](#code-quality-standards)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to conduct@littlebearapps.com.

## Getting Started

### Prerequisites

- **Node.js**: >=20.0.0
- **npm**: Latest version
- **Git**: For version control
- **TypeScript**: Familiarity with TypeScript

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/littlebearapps/mcp-delegator.git
   cd mcp-delegator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

5. **Run linter**
   ```bash
   npm run lint
   ```

### Project Structure

```
mcp-delegator/
├── src/                  # Source code (TypeScript)
├── dist/                 # Compiled output (JavaScript)
├── test/                 # Test files
├── docs/                 # Documentation
├── quickrefs/            # Quick reference guides
├── .github/              # GitHub workflows and configuration
└── scripts/              # Build and utility scripts
```

## Development Workflow

### 1. Create a Feature Branch

Always create a new branch from `main` for your work:

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/fixes
- `chore/` - Maintenance tasks

### 2. Make Your Changes

- Follow the [code quality standards](#code-quality-standards)
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass locally

### 3. Test Your Changes

Before committing, run:

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run linter
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Build the project
npm run build
```

**Coverage Requirements**: Minimum 95% coverage for all metrics (branches, functions, lines, statements).

### 4. Commit Your Changes

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```bash
git commit -m "feat: add new delegation strategy"
git commit -m "fix: resolve async execution timeout"
git commit -m "docs: update README with new examples"
```

See [Commit Guidelines](#commit-guidelines) for details.

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a PR on GitHub following the [PR template](.github/PULL_REQUEST_TEMPLATE.md).

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) for clear and semantic commit messages.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring (no functional changes)
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks, dependency updates
- **ci**: CI/CD configuration changes

### Examples

```bash
# Simple feature
git commit -m "feat: add support for GitHub PR metadata extraction"

# Bug fix with scope
git commit -m "fix(codex): handle timeout in cloud execution"

# Breaking change
git commit -m "feat!: change MCP tool parameter structure

BREAKING CHANGE: Tool parameters now use structured objects instead of flat strings.
Migration: Update tool calls to use { taskId, prompt } object structure."

# Documentation
git commit -m "docs: add troubleshooting guide for keychain issues"
```

### Breaking Changes

Mark breaking changes with `!` or `BREAKING CHANGE:` footer:

```bash
git commit -m "feat!: remove deprecated unified_codex tool

BREAKING CHANGE: The unified_codex tool has been removed.
Use separate codex_local and codex_cloud tools instead."
```

## Pull Request Process

### Before Submitting

- [ ] All tests pass locally (`npm test`)
- [ ] Code coverage meets 95% threshold
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated (if needed)
- [ ] CHANGELOG.md updated (for significant changes)

### PR Description Template

Your PR should include:

1. **Summary**: Brief description of changes
2. **Motivation**: Why this change is needed
3. **Changes**: Detailed list of modifications
4. **Testing**: How you tested the changes
5. **Breaking Changes**: Any breaking changes (if applicable)
6. **Related Issues**: Link to related issues

Example:

```markdown
## Summary
Add support for extracting GitHub PR metadata including labels and reviewers.

## Motivation
Users need access to PR metadata for advanced workflow automation.

## Changes
- Added `extractPRMetadata` function in `src/github/pr-metadata.ts`
- Extended `codex_cloud_github_setup` tool with metadata extraction
- Added tests for metadata extraction

## Testing
- Unit tests added with 98% coverage
- Manual testing with live GitHub PRs
- Verified metadata accuracy

## Breaking Changes
None

## Related Issues
Closes #123
```

### Review Process

1. **Automated Checks**: CI must pass (tests, linting, build, coverage)
2. **Code Review**: At least 1 approval from maintainer required
3. **Conversation Resolution**: All review comments must be resolved
4. **Up to Date**: Branch must be up to date with `main`

### After Approval

Once approved and all checks pass:
- **Maintainer will merge** using squash merge
- **Automated release** will trigger via semantic-release (if applicable)
- **Branch will be deleted** automatically

## Testing Requirements

### Test Coverage

- **Minimum Coverage**: 95% for branches, functions, lines, and statements
- **Test Files**: Place tests in `test/` directory or co-located with `*.test.ts` suffix
- **Naming**: Use descriptive test names

### Writing Tests

```typescript
import { describe, test, expect } from '@jest/globals';

describe('Feature Name', () => {
  test('should handle successful case', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe('expected');
  });

  test('should handle error case', () => {
    expect(() => functionUnderTest(null)).toThrow();
  });
});
```

### Test Types

- **Unit Tests**: Test individual functions and modules
- **Integration Tests**: Test interactions between components
- **E2E Tests**: Test complete workflows (manual testing acceptable)

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/feature.test.ts

# Run with coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

## Code Quality Standards

### TypeScript

- Use strict TypeScript settings
- Avoid `any` type (use `unknown` or specific types)
- Define interfaces for complex objects
- Use type guards for runtime type checking

### Code Style

- **Formatting**: Enforced by ESLint
- **Line Length**: Max 100 characters (guideline, not strict)
- **Imports**: Organize imports (external, internal, types)
- **Comments**: Use JSDoc for public APIs

### Security

- **No Secrets**: Never commit API keys, tokens, or passwords
- **Input Validation**: Always validate and sanitize user input
- **SQL Safety**: Use parameterized queries (better-sqlite3)
- **Command Execution**: Sanitize commands, avoid injection

### Performance

- Use async/await for asynchronous operations
- Avoid blocking operations in main thread
- Clean up resources (close database connections, kill processes)

## Questions or Issues?

- **Questions**: Open a [GitHub Discussion](https://github.com/littlebearapps/mcp-delegator/discussions)
- **Bugs**: Report via [GitHub Issues](https://github.com/littlebearapps/mcp-delegator/issues)
- **Security**: Report to security@littlebearapps.com (see [SECURITY.md](SECURITY.md))

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to mcp-delegator!** 🎉

Your contributions help make AI agent delegation more powerful and accessible for everyone.
