# Bug Fix Summary v2.1.1 - Process Tracking & Python Issues

**Date**: 2025-11-12
**Version**: 2.1.1
**Reporter**: auditor-toolkit testing (Nathan)

---

## 🐛 Bug #4: Process Tracking Visibility

### The Discovery

During auditor-toolkit testing, two critical observations were made:

1. **System showed running process**:
   ```bash
   ps aux | grep "codex exec"
   nathanschram  70565  0.5  0.1 ... codex exec --experimental-json
   ```

2. **MCP server reported nothing**:
   ```bash
   codex_status
   # Output: Active Processes: 0
   ```

**Conclusion**: `codex_status` was blind to SDK-spawned processes!

---

## 🔍 Root Cause Analysis

### Process Spawning Architecture

**CLI Tools** (`codex_run`, `codex_plan`, `codex_apply`):
```
CallToolRequest → ProcessManager.execute()
                → spawn('codex', args)
                → ProcessManager tracks in Map<string, ChildProcess>
                → codex_status sees it ✅
```

**SDK Tools** (`codex_local_exec`, `codex_local_resume`):
```
CallToolRequest → @openai/codex-sdk
                → SDK spawns codex processes internally
                → ProcessManager has no visibility ❌
                → codex_status can't see it ❌
```

**Result**: Orphaned processes, stuck tasks, no visibility.

---

## ✅ The Fix

### Added System-Wide Process Detection

**File**: `src/tools/status.ts`

**New Method**:
```typescript
private async detectSystemProcesses(): Promise<Array<{
  pid: string;
  cpu: string;
  mem: string;
  started: string;
  command: string;
}>> {
  // Uses 'ps aux' to find all 'codex exec' processes
  // Returns process details even if not tracked by ProcessManager
}
```

**Updated Status Output**:
```
📊 Codex Control Status

**Total Codex Processes**: 1
  - CLI-tracked: 0
  - SDK-spawned: 1

**System-Wide Process Details**:
- PID 70565 | Started 4:29PM | CPU 0.5% | Mem 0.1%
  codex exec --experimental-json ...

⚠️ Detected 1 SDK-spawned process(es) - not tracked by ProcessManager
💡 SDK processes are spawned by codex_local_exec and codex_local_resume
```

### Benefits

1. **Full Visibility**: See ALL Codex processes, not just CLI-tracked ones
2. **Orphan Detection**: Identify stuck SDK processes immediately
3. **Resource Monitoring**: CPU, memory, start time for debugging
4. **Clear Attribution**: Know which tool spawned each process

---

## 📋 Issue #2: Python Version Mismatch (DOCUMENTED)

### The Problem

**Discovered**: auditor-toolkit Phase 4 got stuck
**Cause**: Codex using Python 3.13 (system) instead of .venv Python 3.12
**Result**: Missing dependencies → test failures → retry loop → stuck process

### Why It Happened

```
MCP Server Environment:
  PATH = /usr/bin:/bin:/usr/local/bin (system Python first)

Project Environment:
  .venv/bin/python (Python 3.12 + dependencies)

Codex SDK Process:
  Inherits MCP server's PATH
  Uses system Python 3.13
  No access to .venv dependencies
  → ModuleNotFoundError: boto3, typer, google.ads
```

### Why Phases 2 & 3 Worked

- **Phase 2 & 3**: Simple tasks, minimal test validation
- **Phase 4**: Comprehensive testing → hit Python version issue

### Solution

**Status**: Documented in `KNOWN-ISSUES.md`

**Workarounds**:
1. Kill stuck process, finish manually (5-10 min)
2. Activate .venv before starting Claude Code
3. Use CLI tools instead of SDK tools for test execution
4. Use Cloud execution with proper environment setup

**Long-term**: Add `pythonPath` parameter to SDK tools (future enhancement)

---

## 📊 Testing Results

### Before Fix
```bash
# System shows process
ps aux | grep "codex exec"
# → PID 70565 running

# MCP server shows nothing
codex_status
# → Active Processes: 0
# → ❌ No visibility into stuck process
```

### After Fix
```bash
# Same system process
ps aux | grep "codex exec"
# → PID 70565 running

# MCP server NOW SEES IT
codex_status
# → Total Codex Processes: 1
# →   - CLI-tracked: 0
# →   - SDK-spawned: 1
# → ✅ Full visibility with process details
```

---

## 📝 Files Changed

### Source Code (1 file)
- `src/tools/status.ts`: Added `detectSystemProcesses()` method

### Documentation (2 files)
- `CHANGELOG.md`: Added Bug #4 entry with examples
- `KNOWN-ISSUES.md`: Created new file documenting both issues

### Build Output
- `dist/tools/status.js`: Compiled with new system detection

---

## 🎯 Impact Assessment

### Severity: Medium
- **Users Affected**: Anyone using `codex_local_exec` or `codex_local_resume`
- **Frequency**: Every SDK task (process tracking), some SDK tasks (Python issue)
- **Workaround**: Yes (documented)
- **Risk**: Low (non-breaking, additive fix)

### User Experience Improvement

**Before**:
```
User: "Is my task still running?"
codex_status: "No active processes"
User: "But ps aux shows PID 70565!"
codex_status: "I don't see it 🤷"
```

**After**:
```
User: "Is my task still running?"
codex_status: "Yes! PID 70565, started 4:29PM, 0.5% CPU"
User: "Perfect, I can see it and monitor it!"
```

---

## 🚀 Deployment Status

### Version: v2.1.1
- ✅ Source code fixed
- ✅ Build successful
- ✅ Tested in codex-control directory
- ✅ Tested in auditor-toolkit environment
- ✅ Documentation updated
- ✅ Changelog updated
- ✅ Known issues documented

### Ready for Rollout
- ✅ Build verified: `npm run build` successful
- ✅ No breaking changes
- ✅ Backward compatible
- ✅ Ready for all 18 projects + root

---

## 📚 Related Documentation

- **CHANGELOG.md**: Full v2.1.1 release notes
- **KNOWN-ISSUES.md**: Python version issue workarounds
- **quickrefs/troubleshooting.md**: Process detection guidance
- **TEST-RESULTS-CODEX-CONTROL-DIRECTORY.md**: Original v2.1.0 testing

---

## 🙏 Thanks

Special thanks to auditor-toolkit testing for discovering this critical visibility gap!

The stuck process (PID 70565) revealed a blind spot in our monitoring that affected all SDK-based tasks.
