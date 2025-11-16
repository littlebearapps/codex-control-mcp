# Implementation Checklist
## MCP Delegator CI/CD & Security Setup

**Use this checklist to track progress through the 4-phase rollout.**

---

## Phase 1: Foundation (Week 1)

### GitHub Workflows

- [ ] Create `.github/workflows/` directory
- [ ] Copy `docs/workflows/ci.yml.example` to `.github/workflows/ci.yml`
- [ ] Update `package.json` scripts:
  - [ ] Add `"lint": "eslint src/"` (or similar)
  - [ ] Verify `"test": "jest"` exists
  - [ ] Verify `"build": "tsc"` exists
- [ ] Push workflow to GitHub
- [ ] Verify CI runs on push
- [ ] Fix any failing tests or build issues

### Dependabot Configuration

- [ ] Create `.github/dependabot.yml`:
  ```yaml
  version: 2
  updates:
    - package-ecosystem: "npm"
      directory: "/"
      schedule:
        interval: "weekly"
      open-pull-requests-limit: 10
    - package-ecosystem: "github-actions"
      directory: "/"
      schedule:
        interval: "weekly"
  ```
- [ ] Enable Dependabot alerts in repo settings
- [ ] Enable Dependabot security updates
- [ ] Review and merge first Dependabot PR

### Test Coverage

- [ ] Configure Jest coverage in `jest.config.js`:
  ```javascript
  module.exports = {
    coverageThreshold: {
      global: {
        branches: 95,
        functions: 95,
        lines: 95,
        statements: 95
      }
    }
  };
  ```
- [ ] Run `npm test -- --coverage` locally
- [ ] Fix coverage gaps if below threshold
- [ ] Add coverage reporting to CI workflow

### Documentation

- [ ] Create `SECURITY.md`:
  ```markdown
  # Security Policy

  ## Supported Versions

  | Version | Supported          |
  | ------- | ------------------ |
  | 4.x     | :white_check_mark: |
  | < 4.0   | :x:                |

  ## Reporting a Vulnerability

  Please report security vulnerabilities to security@littlebearapps.com
  ```
- [ ] Create `CONTRIBUTING.md`:
  - Explain conventional commits
  - PR process
  - Testing requirements
- [ ] Create `CODE_OF_CONDUCT.md`:
  - Use [Contributor Covenant](https://www.contributor-covenant.org/)
- [ ] Update README.md with badges:
  ```markdown
  [![CI](https://github.com/littlebearapps/mcp-delegator/workflows/CI/badge.svg)](https://github.com/littlebearapps/mcp-delegator/actions)
  [![npm version](https://badge.fury.io/js/@littlebearapps%2Fmcp-delegator.svg)](https://www.npmjs.com/package/@littlebearapps/mcp-delegator)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  ```

### Exit Criteria

- [ ] CI workflow runs successfully on PRs
- [ ] All tests pass
- [ ] Coverage ≥95%
- [ ] Dependabot PRs being generated
- [ ] Documentation files created

---

## Phase 2: Security Hardening (Week 2)

### GitHub Advanced Security

- [ ] Verify GHAS is enabled for organization
  - Go to org settings → Code security and analysis
  - Verify "GitHub Advanced Security" is enabled
- [ ] Enable GHAS for mcp-delegator repository
  - Repo settings → Security & analysis
  - Enable "GitHub Advanced Security"

### CodeQL

- [ ] Copy `docs/workflows/codeql.yml.example` to `.github/workflows/codeql.yml`
- [ ] Push CodeQL workflow
- [ ] Wait for initial scan to complete
- [ ] Review CodeQL alerts in Security tab
- [ ] Triage alerts:
  - [ ] Fix critical issues
  - [ ] Fix high issues
  - [ ] Document/dismiss false positives

### Secret Scanning

- [ ] Enable secret scanning:
  - Repo settings → Security & analysis
  - Enable "Secret scanning"
- [ ] Enable push protection:
  - Enable "Push protection"
- [ ] Test push protection:
  ```bash
  # Try to commit a fake secret (will be blocked)
  echo "OPENAI_API_KEY=sk-proj-test123" >> test.txt
  git add test.txt
  git commit -m "test"  # Should be blocked
  ```

### Dependency Review

- [ ] Enable dependency review:
  - Repo settings → Code security and analysis
  - Enable "Dependency graph" (usually auto-enabled)
  - Enable "Dependency review"
- [ ] Test on next PR - should see dependency changes reviewed

### Branch Protection

- [ ] Configure branch protection for `main`:
  - Repo settings → Branches → Add rule
  - Branch name pattern: `main`
  - ✅ Require a pull request before merging
    - ✅ Require approvals: 1
    - ✅ Dismiss stale PR approvals
    - ✅ Require review from Code Owners (optional)
  - ✅ Require status checks to pass before merging
    - ✅ Require branches to be up to date
    - Add required checks: `checks` (from CI workflow)
  - ✅ Require conversation resolution before merging
  - ✅ Require linear history
  - ✅ Do not allow bypassing the above settings
  - ✅ Restrict who can push to matching branches
  - ✅ Allow force pushes: **OFF**
  - ✅ Allow deletions: **OFF**

### Repository Settings

- [ ] Enable auto-delete head branches:
  - Repo settings → General → Pull Requests
  - ✅ Automatically delete head branches (after PR merge)
- [ ] Configure default branch protection:
  - Ensures merged feature branches are cleaned up automatically
  - Reduces repository clutter
  - Prevents accidental commits to old branches

### Security Audit

- [ ] Review all dependencies:
  ```bash
  npm audit
  npm audit signatures
  ```
- [ ] Fix or document high/critical vulnerabilities
- [ ] Review GitHub Actions usage:
  - [ ] Pin actions by SHA where possible
  - [ ] Only use trusted actions (GitHub-published or verified)
- [ ] Check git history for secrets:
  ```bash
  git log -p | grep -i "api_key\|password\|secret\|token"
  ```

### Exit Criteria

- [ ] CodeQL scans running on PRs and main
- [ ] Secret scanning active with push protection
- [ ] Branch protection enforced
- [ ] Zero high/critical unresolved vulnerabilities
- [ ] Dependabot PRs reviewed

---

## Phase 3: Automated Publishing (Week 3)

### npm Trusted Publisher Setup

- [ ] Go to npm package settings:
  - URL: `https://www.npmjs.com/settings/littlebearapps/packages/@littlebearapps/mcp-delegator/access`
- [ ] Add Trusted Publisher:
  - Click "Add a trusted publisher" under "Trusted publishers"
  - Select "GitHub Actions"
  - Configure:
    - Repository owner: `littlebearapps`
    - Repository name: `mcp-delegator`
    - Workflow file: `.github/workflows/release.yml`
    - Environment: (leave blank)
  - Click "Add"
- [ ] Verify publisher appears in list

### Install Dependencies

- [ ] Install semantic-release packages:
  ```bash
  npm install --save-dev \
    semantic-release \
    @semantic-release/changelog \
    @semantic-release/git \
    @semantic-release/npm \
    @semantic-release/github
  ```
- [ ] Commit package.json and package-lock.json changes

### Configuration Files

- [ ] Copy `docs/.releaserc.json.example` to `.releaserc.json` (root)
- [ ] Update `package.json`:
  ```json
  {
    "version": "0.0.0-development",
    "publishConfig": {
      "access": "public",
      "provenance": true
    }
  }
  ```
- [ ] Commit configuration changes

### Release Workflow

- [ ] Copy `docs/workflows/release.yml.example` to `.github/workflows/release.yml`
- [ ] Verify workflow has `id-token: write` permission
- [ ] Push workflow to GitHub

### Testing

- [ ] Test dry run locally:
  ```bash
  npx semantic-release --dry-run
  ```
- [ ] Review output:
  - [ ] Version bump calculated correctly
  - [ ] Changelog preview looks good
  - [ ] No errors
- [ ] Create test PR with conventional commit:
  ```bash
  git checkout -b test-release
  git commit --allow-empty -m "feat: test automated release"
  git push origin test-release
  ```
- [ ] Open PR, get approval, merge
- [ ] Monitor release workflow:
  - [ ] Workflow completes successfully
  - [ ] Package published to npm
  - [ ] GitHub release created
  - [ ] CHANGELOG.md updated

### Verification

- [ ] Check npm package page:
  - URL: `https://www.npmjs.com/package/@littlebearapps/mcp-delegator`
  - [ ] New version visible
  - [ ] **Provenance badge** present
  - [ ] Click provenance to verify attestation
- [ ] Test installation:
  ```bash
  npm install -g @littlebearapps/mcp-delegator@latest
  mcp-delegator --version
  ```
- [ ] Verify provenance locally:
  ```bash
  npm audit signatures
  ```

### Exit Criteria

- [ ] npm Trusted Publisher configured
- [ ] semantic-release working
- [ ] First automated release successful
- [ ] Provenance attestation verified
- [ ] Package installable

---

## Phase 4: Public Release (Week 4)

### Documentation Polish

- [ ] Update README.md:
  - [ ] Add comprehensive usage examples
  - [ ] Add troubleshooting section
  - [ ] Add FAQ section
  - [ ] Update badges with latest versions
  - [ ] Highlight Trusted Publisher/provenance
  - [ ] Add installation instructions
  - [ ] Add contribution guidelines link
- [ ] Review all documentation:
  - [ ] CLAUDE.md up to date
  - [ ] quickrefs/ files accurate
  - [ ] docs/ plan documents complete
- [ ] Create examples:
  - [ ] Add example usage in examples/ directory
  - [ ] Document common workflows

### Final Security Audit

- [ ] Run CodeQL scan:
  - [ ] Wait for latest scan to complete
  - [ ] Review all alerts
  - [ ] Fix or document remaining issues
- [ ] Review Dependabot alerts:
  - [ ] Merge all security updates
  - [ ] Document any remaining vulnerabilities
- [ ] Check git history:
  ```bash
  git log --all --full-history --pretty=format:"%H %s" | grep -i "secret\|password\|api.key\|token"
  ```
- [ ] Verify no secrets exposed
- [ ] Check license compliance:
  ```bash
  npm install -g license-checker
  npx license-checker --summary
  ```
- [ ] Generate SBOM:
  - Repo → Insights → Dependency graph → Export SBOM

### Prepare v4.0.0 Release

- [ ] Create release PR:
  ```bash
  git checkout -b public-release-v4
  ```
- [ ] Update version strategy in docs
- [ ] Create breaking change commit:
  ```bash
  git commit --allow-empty -m "feat!: public release of mcp-delegator

  BREAKING CHANGE: Package is now publicly available on npm.
  This major version marks the transition from private to public release.

  Changes:
  - Changed package access from restricted to public
  - Added npm provenance for supply chain security
  - Enabled automated releases via semantic-release
  - Complete CI/CD and security infrastructure
  - GitHub Advanced Security features enabled
  - CodeQL scanning for JavaScript/TypeScript
  - Secret scanning with push protection
  - Automated Dependabot updates

  Migration: No code changes required for existing users."
  ```
- [ ] Push and create PR
- [ ] Get approval
- [ ] Merge to main

### Verify Release

- [ ] Wait for release workflow to complete
- [ ] Verify v4.0.0 on npm:
  - [ ] Package version is 4.0.0
  - [ ] Provenance badge present
  - [ ] README displays correctly
  - [ ] All files included
- [ ] Verify GitHub release:
  - [ ] Release v4.0.0 created
  - [ ] Changelog complete
  - [ ] Assets attached
- [ ] Test installation:
  ```bash
  npm install -g @littlebearapps/mcp-delegator@4.0.0
  mcp-delegator --version  # Should show 4.0.0
  ```

### Announcement

- [ ] Update repository:
  - [ ] Set repository description
  - [ ] Add topics: mcp, mcp-server, ai-agent, codex, openai, claude-code
  - [ ] Ensure README displays as main page
- [ ] Create announcement:
  - [ ] GitHub Discussions post
  - [ ] Twitter/LinkedIn (if applicable)
  - [ ] Organization website update
- [ ] Monitor:
  - [ ] GitHub issues for questions
  - [ ] npm download stats
  - [ ] Security alerts

### Exit Criteria

- [ ] Documentation complete and polished
- [ ] Security audit passed
- [ ] v4.0.0 published to npm
- [ ] Provenance verified
- [ ] Package publicly installable
- [ ] Announcement made
- [ ] Monitoring in place

---

## Post-Implementation

### Ongoing Maintenance

**Weekly**:
- [ ] Review and merge Dependabot PRs
- [ ] Check CI status
- [ ] Monitor security alerts

**Monthly**:
- [ ] Review CodeQL findings
- [ ] Update dependencies
- [ ] Check npm download stats
- [ ] Review documentation for updates

**Quarterly**:
- [ ] Audit Trusted Publisher configuration
- [ ] Review branch protection rules
- [ ] Audit npm package access
- [ ] Update security policies

---

## Rollback Procedures

### If Release Fails

1. Check release workflow logs
2. Fix identified issues
3. Create new PR with fix
4. Merge - new release will trigger

### If Published Version Has Critical Bug

1. **Don't panic** - packages are immutable
2. Deprecate bad version:
   ```bash
   npm deprecate @littlebearapps/mcp-delegator@4.0.0 "Critical bug - use 4.0.1"
   ```
3. Create hotfix:
   - Revert problematic commit
   - OR create fix commit
   - Merge PR (triggers new release)
4. Verify new version published

---

## Success Metrics

Track these metrics to measure success:

**Technical**:
- [ ] CI success rate >95%
- [ ] Code coverage ≥95%
- [ ] Zero high/critical vulnerabilities
- [ ] 100% releases have provenance
- [ ] Time to release <5 minutes

**Operational**:
- [ ] PR review time <24 hours
- [ ] Dependabot PRs reviewed within 7 days
- [ ] Security alerts triaged within 48 hours
- [ ] Documentation coverage 100%

---

## Resources

- **Main Plan**: `docs/CI-CD-SECURITY-PLAN.md`
- **Publishing Guide**: `docs/publishing.md`
- **Workflow Examples**: `docs/workflows/`
- **Configuration Examples**: `docs/.releaserc.json.example`

---

**Checklist Version**: 1.0
**Last Updated**: 2025-01-16
**Status**: Ready for Use
