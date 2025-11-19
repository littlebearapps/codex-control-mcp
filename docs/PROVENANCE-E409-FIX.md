# Provenance E409 Error Fix

**Version**: 3.3.3+
**Status**: ✅ Implemented
**Based on**: [CKEditor Solution](https://github.com/ckeditor/ckeditor5/issues/16625)

---

## Problem

When publishing npm packages with `provenance: true`, npm occasionally fails with:

```
npm ERR! code E409
npm ERR! 409 Conflict - PUT https://registry.npmjs.org/@littlebearapps/mcp-delegator
npm ERR! Failed to save packument. A common cause is if you try to publish a new
npm ERR! package before the previous package has been fully processed.
```

**Key insight**: The package is actually published successfully, but npm registry fails to save the packument metadata.

---

## Root Cause

1. npm publish with provenance successfully uploads package + provenance attestation
2. Provenance attestation is accepted by registry ✅
3. Registry attempts to save packument metadata
4. **Registry fails with E409 during packument save** ❌
5. semantic-release sees the error and reports failure
6. **But the package IS actually published!** ✅

This is a **race condition in npm's registry** when processing provenance attestations.

---

## Solution: Post-Publish Verification

Instead of trusting the exit code, verify if the package exists in the registry.

### Implementation

**1. Enable `continue-on-error` for release step** (`.github/workflows/release.yml`):

```yaml
- name: Release
  id: release
  continue-on-error: true
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: npx semantic-release
```

**2. Add verification step** (`.github/workflows/release.yml`):

```yaml
- name: Verify publication (handles E409 packument errors)
  if: steps.release.outcome == 'failure'
  run: |
    chmod +x .github/scripts/publish-with-retry.sh
    PACKAGE_NAME=$(node -p "require('./package.json').name")
    ./.github/scripts/publish-with-retry.sh "$PACKAGE_NAME"
```

**3. Verification script** (`.github/scripts/publish-with-retry.sh`):

```bash
#!/bin/bash
# Check if package exists in npm registry
# Wait up to 60 seconds for package to appear

PACKAGE_NAME="$1"
EXPECTED_VERSION=$(node -p "require('./package.json').version")

ELAPSED=0
while [ $ELAPSED -lt 60 ]; do
  if npm show "${PACKAGE_NAME}@${EXPECTED_VERSION}" version >/dev/null 2>&1; then
    echo "✅ Package ${PACKAGE_NAME}@${EXPECTED_VERSION} found in registry"
    exit 0
  fi

  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

echo "❌ Package not found in registry after 60s"
exit 1
```

---

## How It Works

### Scenario 1: Normal Success

```
semantic-release → npm publish → Success ✅
→ Workflow succeeds ✅
→ Verification step skipped
```

### Scenario 2: E409 Error (Package Actually Published)

```
semantic-release → npm publish → E409 Error ❌
→ continue-on-error prevents workflow failure
→ Verification step runs
→ npm show @littlebearapps/mcp-delegator@3.3.3 → Found ✅
→ Workflow succeeds ✅
```

### Scenario 3: Real Failure (Package Not Published)

```
semantic-release → npm publish → Real Error ❌
→ continue-on-error prevents immediate failure
→ Verification step runs
→ npm show @littlebearapps/mcp-delegator@3.3.3 → Not Found ❌
→ Workflow fails ❌ (as it should)
```

---

## Benefits

✅ **Handles E409 gracefully** - Package publishes despite packument error
✅ **No false failures** - Verifies actual registry state
✅ **Still catches real errors** - Genuine failures are detected
✅ **Provenance enabled** - Get security benefits of provenance attestations
✅ **No manual intervention** - Fully automated recovery

---

## Testing

To test this fix:

1. Make a docs change that triggers a release
2. Watch GitHub Actions workflow
3. If E409 occurs:
   - Workflow will show "Release" step as failed (⚠️ orange)
   - "Verify publication" step will run
   - If package exists, verification succeeds (✅ green)
   - Overall workflow succeeds (✅ green)

---

## References

- **CKEditor Solution**: https://github.com/ckeditor/ckeditor5/issues/16625
- **Storybook Discussion**: https://github.com/storybookjs/storybook/pull/23917
- **npm Provenance Docs**: https://docs.npmjs.com/generating-provenance-statements
- **Lerna E409 Issue**: https://stackoverflow.com/questions/78557158/lerna-err-e409-failed-to-save-packument

---

## Future Improvements

If npm fixes the E409 race condition in the registry, this workaround can be removed.

Monitor:

- npm CLI releases
- npm registry infrastructure updates
- Community reports of E409 errors

When E409 errors stop occurring consistently, remove the verification step and revert to standard error handling.
