# npm Publishing with Trusted Publisher

**Purpose**: Configure automated, secure npm publishing using GitHub Actions OIDC

---

## Overview

**npm Trusted Publisher** eliminates the need for long-lived NPM_TOKEN secrets by using OpenID Connect (OIDC) to authenticate GitHub Actions workflows directly with npm. This provides:

✅ **No Secret Management**: No NPM_TOKEN to rotate or secure
✅ **Automatic Provenance**: Supply chain security built-in
✅ **Audit Trail**: Clear link between package and source code
✅ **Enhanced Security**: Short-lived credentials, scoped permissions

---

## Prerequisites

### npm Organization

- **Organization**: @littlebearapps
- **Package**: @littlebearapps/mcp-delegator
- **Access Level**: You must be an organization owner to configure Trusted Publisher
- **Plan**: Free tier supports Trusted Publisher

### Repository

- **Repository**: littlebearapps/mcp-delegator
- **Branch**: main (production releases)
- **Workflow File**: `.github/workflows/release.yml`

### Node.js & npm

- **Node.js**: 18+ (LTS recommended)
- **npm**: 9.5+ (for provenance support)

---

## Configuration Steps

### Step 1: Configure npm Trusted Publisher

1. **Navigate to npm Package Settings**

   ```
   https://www.npmjs.com/settings/littlebearapps/packages/@littlebearapps/mcp-delegator/access
   ```

2. **Find "Trusted Publishers" Section**
   - Scroll to "Trusted publishers" section
   - Click "Add a trusted publisher"

3. **Select GitHub Actions**
   - Provider: GitHub Actions
   - Click "Add GitHub Actions"

4. **Configure Publisher Details**

   ```
   Repository owner: littlebearapps
   Repository name: mcp-delegator
   Workflow file: .github/workflows/release.yml
   Environment name: (leave blank for now)
   ```

5. **Save Configuration**
   - Click "Add"
   - Verify configuration appears in trusted publishers list

### Step 2: Update package.json

Add `publishConfig` to enable public access and provenance:

```json
{
  "name": "@littlebearapps/mcp-delegator",
  "version": "0.0.0-development",
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

**Key Points**:

- `version`: Set to `0.0.0-development` (semantic-release manages actual version)
- `access`: `"public"` (changes from restricted to public on first release)
- `provenance`: `true` (enables attestation generation)

### Step 3: Create Release Workflow

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches:
      - main

permissions:
  contents: read # for checkout

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    permissions:
      contents: write # to publish a GitHub release
      issues: write # to comment on released issues
      pull-requests: write # to comment on released pull requests
      id-token: write # CRITICAL: for OIDC authentication with npm
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Fetch all history for semantic-release

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "lts/*"
          cache: "npm"

      - name: Install dependencies
        run: npm clean-install

      - name: Verify integrity of provenance attestations
        run: npm audit signatures

      - name: Run tests
        run: npm test

      - name: Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # NO NPM_TOKEN NEEDED - OIDC handles authentication
        run: npx semantic-release
```

**Critical Permission**: `id-token: write` enables OIDC authentication.

### Step 4: Install semantic-release

```bash
npm install --save-dev \
  semantic-release \
  @semantic-release/changelog \
  @semantic-release/git \
  @semantic-release/npm \
  @semantic-release/github
```

### Step 5: Configure semantic-release

Create `.releaserc.json`:

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        "changelogFile": "CHANGELOG.md"
      }
    ],
    [
      "@semantic-release/npm",
      {
        "npmPublish": true
      }
    ],
    [
      "@semantic-release/github",
      {
        "assets": []
      }
    ],
    [
      "@semantic-release/git",
      {
        "assets": ["CHANGELOG.md", "package.json"],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ]
  ]
}
```

---

## Testing

### Dry Run

Test semantic-release without publishing:

```bash
npx semantic-release --dry-run
```

**Expected Output**:

- Analyzes commits since last release
- Determines version bump (major, minor, patch)
- Shows changelog that would be generated
- **Does not actually publish**

### First Release Test

1. **Create a test commit**:

   ```bash
   git commit --allow-empty -m "feat: test automated release"
   ```

2. **Push to main**:

   ```bash
   git push origin main
   ```

3. **Monitor workflow**:
   - Go to Actions tab in GitHub
   - Watch "Release" workflow
   - Check for successful npm publish

4. **Verify on npm**:
   - Check package page: https://www.npmjs.com/package/@littlebearapps/mcp-delegator
   - Look for "Provenance" badge
   - Click provenance to see attestation details

---

## Provenance Verification

### What is Provenance?

npm provenance is a cryptographically signed attestation that links:

- **Package**: The .tgz file on npm
- **Source Code**: Exact commit in GitHub
- **Build**: The GitHub Actions workflow that built it

### Viewing Provenance

1. **On npm Package Page**:
   - Look for "Provenance" badge next to version
   - Click to expand attestation details

2. **Using npm CLI**:

   ```bash
   npm view @littlebearapps/mcp-delegator --json | jq .dist.attestations
   ```

3. **Verify Locally**:
   ```bash
   npm install @littlebearapps/mcp-delegator
   npm audit signatures
   ```

### Provenance Benefits

✅ **Authenticity**: Prove package came from your repository
✅ **Integrity**: Verify package wasn't tampered with
✅ **Transparency**: Clear build process and source mapping
✅ **Compliance**: Meet supply chain security requirements

---

## Troubleshooting

### Error: "npm ERR! code EUNKNOWNPERMS"

**Cause**: Trusted Publisher not configured or misconfigured

**Solution**:

1. Verify Trusted Publisher configuration on npm
2. Check repository name matches exactly
3. Ensure workflow file path is correct
4. Confirm you're pushing to main branch

### Error: "npm ERR! code E403"

**Cause**: Missing `id-token: write` permission

**Solution**:
Add to workflow job permissions:

```yaml
permissions:
  id-token: write
```

### Provenance Not Generated

**Cause**: `provenance: true` not in package.json or npm version <9.5

**Solution**:

1. Add `"provenance": true` to publishConfig
2. Update workflow Node.js version to 18+
3. Ensure npm 9.5+ is being used

### Release Skipped (No Version Bump)

**Cause**: No conventional commits since last release

**Solution**:

- Commits must follow format: `feat:`, `fix:`, etc.
- Check commit messages meet conventional commit spec
- Run `npx semantic-release --dry-run` to debug

---

## Conventional Commits

semantic-release analyzes commit messages to determine version bumps.

### Commit Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Version Bumps

| Commit Type                 | Version Change        | Example                      |
| --------------------------- | --------------------- | ---------------------------- |
| `fix:`                      | Patch (3.2.1 → 3.2.2) | `fix: resolve timeout issue` |
| `feat:`                     | Minor (3.2.1 → 3.3.0) | `feat: add new API endpoint` |
| `BREAKING CHANGE:`          | Major (3.2.1 → 4.0.0) | See below                    |
| `docs:`, `chore:`, `style:` | No release            | -                            |

### Breaking Changes

Two ways to trigger major version:

**Option 1: Footer**

```
feat: change API signature

BREAKING CHANGE: userId parameter is now required
```

**Option 2: Type with !**

```
feat!: remove deprecated methods
```

### Examples

**Patch Release**:

```
fix: handle null values in metadata extraction

Fixes #123
```

**Minor Release**:

```
feat: add support for multiple environments

- Allows switching between dev/prod environments
- Adds environment validation
- Updates documentation

Closes #456
```

**Major Release**:

```
feat!: public release of mcp-delegator

BREAKING CHANGE: Package is now publicly available on npm.
This major version marks the transition from private to public.

Changes:
- Package access changed from restricted to public
- Added npm provenance for supply chain security
- Enabled automated releases via semantic-release
```

---

## Security Considerations

### OIDC Token Security

- **Short-lived**: OIDC tokens expire quickly (typically 10 minutes)
- **Scoped**: Limited to specific repository and workflow
- **Audit Trail**: All publishes logged in GitHub Actions

### No Secret Rotation

- **Before**: Rotate NPM_TOKEN every 90 days
- **After**: No token to rotate (OIDC handles authentication)

### Access Control

- **Branch Protection**: Only maintainers can merge to main
- **Required Reviews**: At least 1 approval required
- **Status Checks**: CI must pass before merge

---

## Rollback Procedure

### If Release Contains Critical Bug

1. **Don't Panic**: npm packages are immutable (can't change published version)

2. **Deprecate Faulty Version**:

   ```bash
   npm deprecate @littlebearapps/mcp-delegator@4.0.0 "Critical bug - use 4.0.1 instead"
   ```

3. **Create Hotfix**:
   - Revert the problematic commit
   - Merge revert PR (triggers new release)
   - Or create fix commit and merge

4. **Verify New Release**:
   - Check npm for new version
   - Test installation
   - Update documentation if needed

### If Need to Unpublish (72-hour window only)

```bash
npm unpublish @littlebearapps/mcp-delegator@4.0.0
```

**⚠️ WARNING**: Only works within 72 hours. After that, must deprecate instead.

---

## Maintenance

### Weekly Tasks

- Review Dependabot PRs
- Merge security updates
- Check for new semantic-release versions

### Monthly Tasks

- Audit provenance attestations
- Review release changelog
- Update dependencies

### Quarterly Tasks

- Review Trusted Publisher configuration
- Audit npm package access
- Update documentation

---

## FAQ

**Q: Do I still need NPM_TOKEN?**
A: No! Trusted Publisher uses OIDC, eliminating NPM_TOKEN entirely.

**Q: What if Trusted Publisher is down?**
A: Wait for npm to restore service. There's no manual fallback without reconfiguring NPM_TOKEN.

**Q: Can I use Trusted Publisher with private packages?**
A: Yes, but you must have an npm Pro/Teams/Enterprise plan.

**Q: How do I publish a pre-release?**
A: Use a pre-release branch (e.g., `next`). Add to `.releaserc.json`:

```json
{
  "branches": ["main", { "name": "next", "prerelease": true }]
}
```

**Q: Can I manually trigger a release?**
A: semantic-release runs automatically on push to main. To force a release, create an empty commit:

```bash
git commit --allow-empty -m "chore: trigger release"
```

**Q: What happens if two PRs merge simultaneously?**
A: semantic-release analyzes all commits since last release and chooses the highest version bump.

---

## References

- [npm Trusted Publisher Announcement](https://github.blog/2023-04-19-introducing-npm-package-provenance/)
- [npm Provenance Documentation](https://docs.npmjs.com/generating-provenance-statements)
- [semantic-release npm Plugin](https://github.com/semantic-release/npm)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [Conventional Commits Specification](https://www.conventionalcommits.org/)

---

**Last Updated**: 2025-01-16
**Status**: Implementation Ready
**Owner**: @littlebearapps/mcp-delegator team
