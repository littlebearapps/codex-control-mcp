# MCP Server Code Caching Discovery

**Date**: 2025-11-16
**Context**: Live User Acceptance Testing of Git Safety Features
**Severity**: CRITICAL - Affects all code deployments

---

## Summary

During live UAT testing of git safety features, we discovered that **MCP servers cache JavaScript code in memory when Claude Code starts**. This means code changes don't take effect until Claude Code is restarted.

---

## The Discovery

### Symptom
Git safety checks (Tier 1 blocking) were not being applied during live MCP testing, even though:
- All 45 automated tests passed (100%)
- Build completed successfully
- Git safety code was present in `dist/tools/local_run.js`

### Test Case
- **Tool**: `mcp__mcp-delegator___codex_local_run`
- **Task**: "Run git gc --prune=now to cleanup the repository"
- **Expected**: Operation BLOCKED (Tier 1 - ALWAYS_BLOCKED)
- **Actual**: Operation executed successfully ❌

### Investigation Steps
1. ✅ Verified built file exists: `dist/tools/local_run.js` (timestamp 12:48)
2. ✅ Confirmed git safety code is present (line 21)
3. ✅ Tested pattern matching: `/git\s+gc\s+--prune=now/i` MATCHES task
4. ❌ Searched for MCP config: Not found in expected location

### Root Cause
**The running MCP server was using OLD CODE from before the 12:48 build.**

MCP servers load JavaScript files into memory when Claude Code starts. The server continues using the cached code until Claude Code is restarted, even if new builds are created.

### Solution
**Restart Claude Code** to reload the MCP server with latest built code.

---

## Impact

### Development Workflow
- **Code changes**: Require Claude Code restart to take effect
- **Testing**: Live MCP testing must restart Claude Code after each build
- **Debugging**: May appear code isn't working when it's actually cached

### Deployment Checklist
1. Build code: `npm run build`
2. Verify build succeeded: Check `dist/` timestamp
3. **CRITICAL**: Restart Claude Code
4. Verify changes via live testing

### UAT Procedures
- Always restart Claude Code before UAT sessions
- Document restart in test logs
- Re-verify test cases after restart

---

## Lessons Learned

### What Worked
- ✅ Automated tests caught logic errors
- ✅ Build verification caught compilation errors
- ✅ Pattern matching verification caught regex errors

### What Didn't Work
- ❌ Live UAT exposed runtime caching issue
- ❌ No indication in MCP logs that old code was running

### Recommendations
1. **Add to development docs**: "Always restart Claude Code after builds"
2. **Add to deployment checklist**: Restart step is MANDATORY
3. **Add to troubleshooting guide**: Check restart if code changes don't appear
4. **Consider**: Pre-commit hook reminder to restart Claude Code

---

## Timeline

**12:48** - Built code with git safety integration
**~13:00** - Started live UAT testing
**~13:05** - Discovered Tier 1 blocking not working
**~13:10** - Investigated and identified caching issue
**~13:15** - User restarted Claude Code
**~13:20** - Ready to resume UAT with fresh code

---

## Related Documentation

- `GIT-OPERATIONS-TEST-RESULTS.md` - Automated test results (all passed)
- `GIT-OPERATIONS-MANUAL-TEST-PLAN.md` - Manual UAT procedures
- `src/security/risky_operation_detector.ts` - Git safety implementation
- `dist/tools/local_run.js` - Built code with git safety (line 21)

---

## Status

✅ **Discovery documented**
✅ **Claude Code restarted** (user confirmed)
⏳ **UAT testing resumed** (pending re-test of Tier 1 blocking)
