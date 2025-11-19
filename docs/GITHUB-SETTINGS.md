# GitHub Repository Settings Guide

> **Note**: This document is part of the CI/CD setup. See [CI-CD-SECURITY-PLAN.md](../CI-CD-SECURITY-PLAN.md) for the complete implementation plan.

This document describes the GitHub repository settings that need to be manually configured to complete the CI/CD and security setup for mcp-delegator.

## Prerequisites

- Repository must be public or have GitHub Advanced Security (GHAS) enabled
- Repository owner must have appropriate permissions
- npm Trusted Publisher already configured (✅ completed)
- CodeQL default setup disabled (✅ completed - using custom workflow)

---

## 1. GitHub Advanced Security (GHAS)

**Required for**: CodeQL code scanning, secret scanning, dependency review

### Steps to Enable

1. Navigate to: **Settings** → **Code security and analysis**
2. Enable the following features:

   **Dependency Graph**
   - Click **Enable** (usually enabled by default for public repos)

   **Dependabot Alerts**
   - Click **Enable**
   - Purpose: Get notified about vulnerable dependencies

   **Dependabot Security Updates**
   - Click **Enable**
   - Purpose: Automatic PRs to fix vulnerable dependencies

   **Dependabot Version Updates**
   - Click **Enable** (already configured via `.github/dependabot.yml`)
   - Purpose: Automatic PRs for dependency updates

   **Secret Scanning**
   - Click **Enable**
   - Enable **Push Protection** (recommended)
   - Purpose: Prevent accidental commits of secrets

   **Code Scanning (CodeQL)**
   - Click **Set up** → **Default**
   - Or use the existing `.github/workflows/codeql.yml` workflow
   - Purpose: Automated security vulnerability scanning

---

## 2. Branch Protection Rules

**Required for**: Prevent direct pushes to main, enforce PR workflow

### Steps to Configure

1. Navigate to: **Settings** → **Branches**
2. Click **Add branch protection rule**
3. Configure the following:

   **Branch name pattern**: `main`

   ✅ **Require a pull request before merging**
   - ✅ Require approvals: **1** (or more for team projects)
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require review from Code Owners (optional, requires CODEOWNERS file)

   ✅ **Require status checks to pass before merging**
   - ✅ Require branches to be up to date before merging
   - Select required status checks:
     - ✅ `test (20.x, ubuntu-latest)` (CI workflow)
     - ✅ `test (22.x, ubuntu-latest)` (CI workflow)
     - ✅ `lint` (CI workflow)
     - ✅ `build` (CI workflow)
     - ✅ `CodeQL` (if enabled)

   ✅ **Require conversation resolution before merging**

   ✅ **Require signed commits** (recommended for security)

   ✅ **Require linear history** (optional, prevents merge commits)

   ✅ **Include administrators** (enforce rules for repo admins)

   ✅ **Restrict who can push to matching branches**
   - Only allow specific people/teams (optional)

   ✅ **Allow force pushes**: **❌ Disabled**

   ✅ **Allow deletions**: **❌ Disabled**

4. Click **Create** or **Save changes**

---

## 3. Actions Permissions

**Required for**: GitHub Actions workflows to run properly

### Steps to Configure

1. Navigate to: **Settings** → **Actions** → **General**
2. Configure the following:

   **Actions permissions**
   - ✅ Allow all actions and reusable workflows

   **Workflow permissions**
   - ✅ **Read and write permissions** (required for semantic-release)
   - ✅ Allow GitHub Actions to create and approve pull requests

   **Fork pull request workflows**
   - ✅ Require approval for all outside collaborators (security)

---

## 4. Repository Settings

**General repository settings**

### Steps to Configure

1. Navigate to: **Settings** → **General**

   **Features**
   - ✅ **Issues** (enabled for bug tracking)
   - ✅ **Projects** (optional, for project management)
   - ✅ **Discussions** (recommended for Q&A)
   - ✅ **Wikis** (optional)

   **Pull Requests**
   - ✅ Allow merge commits
   - ✅ Allow squash merging (recommended for clean history)
   - ✅ Allow rebase merging
   - ✅ Always suggest updating pull request branches
   - ✅ Automatically delete head branches (cleanup after merge)

---

## 5. Secrets and Variables

**Required for**: Release workflow (OIDC authentication)

### Steps to Configure

1. Navigate to: **Settings** → **Secrets and variables** → **Actions**

   **Secrets**
   - ✅ `GITHUB_TOKEN` is automatically provided by GitHub Actions
   - ❌ **NO `NPM_TOKEN` NEEDED** - npm authentication uses OIDC

   **Variables** (optional)
   - Add any environment variables needed for workflows

---

## 6. Environments

**Optional but recommended**: Configure deployment environments

### Steps to Configure

1. Navigate to: **Settings** → **Environments**
2. Create environment: **production**
3. Configure protection rules:
   - ✅ Required reviewers (optional)
   - ✅ Wait timer (optional delay before deployment)
   - ✅ Deployment branches: Only `main`

---

## 7. Notifications

**Configure notifications for repository events**

### Steps to Configure

1. Navigate to: **Settings** → **Notifications** (user settings, not repo)
2. Configure notification preferences:
   - ✅ Security alerts
   - ✅ Dependabot alerts
   - ✅ CodeQL alerts
   - ✅ Pull request reviews
   - ✅ CI/CD failures

---

## Verification Checklist

After configuration, verify the following:

- [ ] Push a commit to a feature branch
- [ ] CI workflow runs automatically
- [ ] Cannot push directly to `main` (protected)
- [ ] Pull request requires status checks to pass
- [ ] CodeQL workflow runs (if GHAS enabled)
- [ ] Dependabot alerts appear for vulnerable dependencies
- [ ] Merge to `main` triggers release workflow
- [ ] Release workflow publishes to npm with provenance

---

## Troubleshooting

### CodeQL Not Running

**Issue**: CodeQL workflow doesn't appear in Actions
**Solution**: Ensure GHAS is enabled (public repo or paid plan)

### Release Workflow Fails - npm Publish

**Issue**: `npm ERR! need auth` or similar
**Solution**: Verify npm Trusted Publisher is configured correctly:

1. Go to npmjs.com → Package settings → Publishing access
2. Verify GitHub Actions is listed
3. Check repository name and workflow file match

### Branch Protection Not Enforced

**Issue**: Can still push directly to `main`
**Solution**:

1. Verify branch protection rule is active
2. Check "Include administrators" is enabled
3. Ensure you're not bypassing with force push

### Status Checks Not Required

**Issue**: Can merge PR without passing tests
**Solution**:

1. Ensure "Require status checks" is enabled
2. Select specific status checks to require
3. Wait for at least one CI run to populate status checks list

---

## Summary

### Required Settings (Phase 2)

✅ CodeQL workflow (created)
✅ Release workflow (created)
✅ Dependabot configuration (created)
✅ Issue templates (created)
✅ Pull request template (created)

### Manual Configuration Required

- [ ] Enable GHAS features (Code scanning, Secret scanning)
- [ ] Configure branch protection rules
- [ ] Set Actions permissions
- [ ] Enable repository features (Issues, Discussions)
- [ ] Configure notifications

### Optional Enhancements

- [ ] Create CODEOWNERS file
- [ ] Configure deployment environments
- [ ] Enable GitHub Projects for roadmap
- [ ] Set up custom GitHub Actions secrets (if needed)

---

## Next Steps

1. Complete all manual configuration steps above
2. Push changes to a feature branch
3. Test the full PR workflow
4. Merge to `main` to trigger first release
5. Monitor npm for published package with provenance

---

## References

- [GitHub GHAS Documentation](https://docs.github.com/en/code-security/getting-started/github-security-features)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [npm Trusted Publishers](https://docs.npmjs.com/generating-provenance-statements)
- [semantic-release Documentation](https://semantic-release.gitbook.io/semantic-release/)
