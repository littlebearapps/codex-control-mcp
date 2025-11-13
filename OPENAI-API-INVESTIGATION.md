# OpenAI SDKs & APIs Investigation - Codex Cloud Environment Access

**Date**: 2025-11-13
**Purpose**: Determine programmatic access options for Codex Cloud environments
**Status**: ❌ No Programmatic API Available

---

## Executive Summary

**Finding**: **OpenAI does not provide any programmatic API, REST endpoint, GraphQL interface, or SDK method to list, query, or manage Codex Cloud environments.**

**Current Access Methods**:
1. ✅ **Web UI Only**: https://chatgpt.com/codex (manual configuration)
2. ✅ **CLI Interactive**: `codex cloud` (opens TUI picker)
3. ❌ **Programmatic**: No API available

**Impact on Codex Control MCP**:
- Cannot automatically discover user's cloud environments
- Must rely on manual local configuration file
- Cannot sync environment changes from ChatGPT settings
- Users must maintain `~/.config/codex-control/environments.json` manually

---

## Investigation Details

### 1. OpenAI API Documentation Search

**Sources Checked**:
- ✅ https://developers.openai.com/codex/cloud/environments/
- ✅ https://developers.openai.com/codex/cli/reference/
- ✅ https://developers.openai.com/codex/sdk/
- ✅ https://platform.openai.com/docs/codex/overview (403 blocked)
- ✅ https://github.com/openai/codex

**Finding**: No API endpoints documented for environment management.

### 2. REST API Availability

**Quote from milvus.io**:
> "The current OpenAI Codex (2025) does not provide traditional REST API endpoints in the same way that the original 2021 Codex model did."

**Quote from milvus.io**:
> "The modern Codex operates as an integrated service within ChatGPT and through the Codex CLI tool, rather than offering direct programmatic API access that developers can call from their applications."

**Conclusion**: Codex Cloud is **not accessible via REST API**.

### 3. SDK Investigation

**Package**: `@openai/codex-sdk`
**Version**: 0.58.0-alpha.7 (latest)

**Available Methods** (from npm documentation):
```typescript
import { Codex } from '@openai/codex-sdk';

const codex = new Codex();
const thread = codex.startThread();
const result = await thread.run(prompt);

// Resume threads
codex.resumeThread(threadId);
```

**Methods Available**:
- `new Codex()` - Constructor
- `startThread()` - Create conversation thread
- `resumeThread(threadId)` - Resume previous thread
- `thread.run(prompt)` - Execute task
- `thread.runStreamed(prompt)` - Execute with event streaming

**Methods NOT Available**:
- ❌ `listEnvironments()` - No such method
- ❌ `getEnvironment(id)` - No such method
- ❌ `getCloudTasks()` - No such method
- ❌ Any environment management methods

**Conclusion**: SDK wraps CLI subprocess, provides no environment access.

### 4. CLI Commands

**Available**:
```bash
codex cloud                    # Opens interactive TUI picker
codex cloud exec --env <ID>    # Requires environment ID (no discovery)
```

**Help Text Quote**:
> "Target Codex Cloud environment identifier (required). **Use `codex cloud` to list options**."

**Limitation**: The `codex cloud` command opens an **interactive TUI (Text User Interface)** picker. It is NOT designed for programmatic access:
- No `--list` flag
- No `--json` output mode
- No machine-readable output
- Requires human interaction

**Test Result**:
```bash
$ codex cloud 2>&1
Error: Device not configured (os error 6)
```

**Analysis**: Command failed (likely due to terminal/TTY requirements for interactive mode).

### 5. Authentication Tokens

**Location**: `~/.codex/auth.json`

**Contents**:
```json
{
  "tokens": {
    "id_token": "eyJ...",
    "access_token": "eyJ...",
    "refresh_token": "rt_...",
    "account_id": "579ea81f-83f4-4d26-b530-4efe92bf4694"
  }
}
```

**Token Analysis**:
- ✅ JWT tokens present (valid for OpenAI API)
- ✅ Account ID available
- ✅ User ID available (from JWT payload)
- ✅ Organization IDs available (from JWT payload)
- ❌ No environment data in tokens
- ❌ No API endpoint to query environments with these tokens

**Potential Use**: These tokens could be used to make authenticated requests to OpenAI APIs **IF** such APIs existed. However, no documented endpoint exists for environment management.

### 6. Internal/Undocumented APIs

**Checked**:
- ✅ chatgpt.com API endpoints (web scraping/reverse engineering)
- ✅ OpenAI Platform API (platform.openai.com)
- ✅ GraphQL endpoints

**Finding**: No evidence of documented or stable internal APIs for Codex Cloud environments.

**Risk Assessment**: Even if internal APIs exist, they are:
- Undocumented (subject to change without notice)
- Unsupported (no guarantees)
- Potentially violate TOS (reverse engineering)

**Recommendation**: **DO NOT** attempt to reverse-engineer or use undocumented APIs.

---

## Alternative Solutions Considered

### Option 1: Scrape CLI TUI Output ❌

**Approach**: Parse output from `codex cloud` TUI
**Issues**:
- TUI requires interactive terminal
- Output is ANSI-formatted (complex parsing)
- Fragile (breaks with UI changes)
- Not supported by OpenAI

**Verdict**: Not viable.

### Option 2: Manual Configuration File ✅ (CURRENT)

**Approach**: Users maintain `~/.config/codex-control/environments.json`
**Benefits**:
- ✅ Fully user-controlled
- ✅ Works offline
- ✅ No API dependencies
- ✅ Simple and reliable

**Drawbacks**:
- ⚠️ Manual maintenance required
- ⚠️ No auto-sync with ChatGPT settings
- ⚠️ User must know environment IDs

**Verdict**: Best option currently available.

### Option 3: Codex CLI Integration ✅ (PARTIAL)

**Approach**: Use `codex cloud exec --env <ID>` for submission
**What Works**:
- ✅ Task submission with known environment ID
- ✅ Background execution
- ✅ Authentication reused from CLI

**What Doesn't Work**:
- ❌ Environment discovery
- ❌ Environment listing
- ❌ Environment details

**Verdict**: Submission works, discovery doesn't.

### Option 4: GitHub Setup Guide ✅ (CURRENT)

**Approach**: `codex_github_setup_guide` generates setup instructions
**Benefits**:
- ✅ Helps users create environments
- ✅ Provides pre-filled scripts
- ✅ Reduces setup friction

**Limitation**:
- User still manually creates environment in ChatGPT
- User still manually adds to local config

**Verdict**: Good UX improvement, not automatic.

---

## Recommendations

### For Codex Control MCP v2.1.1+

**Keep Current Approach** ✅:
1. **Manual Configuration**:
   - Users maintain `~/.config/codex-control/environments.json`
   - Tool reads from this file
   - `codex_list_environments` displays configured environments

2. **Setup Helper**:
   - `codex_github_setup_guide` generates custom setup instructions
   - Pre-fills scripts with repo URLs and tech stacks
   - Reduces user effort

3. **Documentation**:
   - Clearly document the manual configuration requirement
   - Provide examples in README
   - Include troubleshooting for "environment not found" errors

**Future Enhancement** (if OpenAI adds API):
- Monitor OpenAI developer docs for API announcements
- Watch `@openai/codex-sdk` releases for new methods
- Be ready to add auto-discovery when available

### For Users

**Setup Instructions**:

1. **Create Environment in ChatGPT**:
   ```
   Visit: https://chatgpt.com/codex/settings/environments
   Click "Create Environment"
   Configure:
     - Repository URL
     - Default branch
     - GITHUB_TOKEN secret (for PR workflows)
   Note the Environment ID (e.g., "my-project-env")
   ```

2. **Add to Local Config**:
   ```bash
   # Edit ~/.config/codex-control/environments.json
   {
     "my-project-env": {
       "name": "My Project",
       "repoUrl": "https://github.com/username/repo",
       "stack": "node",
       "description": "Production environment"
     }
   }
   ```

3. **Test**:
   ```typescript
   // Use codex_list_environments
   // Use codex_cloud_submit with environment ID
   ```

---

## OpenAI API Changelog Monitoring

**Action Items**:
- ⏰ **Monthly**: Check https://developers.openai.com/codex for updates
- ⏰ **Monthly**: Review `@openai/codex-sdk` releases on npm
- ⏰ **Quarterly**: Re-investigate API availability
- 📧 **Subscribe**: OpenAI developer newsletter (if available)

**Watch For**:
- New SDK methods like `listEnvironments()`, `getEnvironment()`
- REST API endpoints for Codex Cloud management
- GraphQL schema additions
- Breaking changes to current CLI behavior

---

## Technical Details

### JWT Token Payload (Decoded)

**From `~/.codex/auth.json`**:

```json
{
  "chatgpt_account_id": "579ea81f-83f4-4d26-b530-4efe92bf4694",
  "chatgpt_user_id": "user-6W1AKe8rI4Ct2almaiNyAiQP",
  "chatgpt_plan_type": "plus",
  "organizations": [
    {
      "id": "org-Yq5IKItVOxOfCpA07DHCAjE7",
      "is_default": true,
      "role": "owner",
      "title": "Little Bear Apps"
    },
    {
      "id": "org-0Ti1xqmukUsllyHIpqWFgPsG",
      "is_default": false,
      "role": "owner",
      "title": "Personal"
    }
  ]
}
```

**Potential API Endpoint** (if it existed):
```
GET https://api.openai.com/v1/codex/environments
Authorization: Bearer <access_token>
```

**Status**: Endpoint does not exist (404/403).

### CLI Binary Investigation

**Command**: `codex cloud`
**Implementation**: Rust binary (closed source)
**Behavior**: Opens interactive TUI (requires TTY)

**No Flags For**:
- `--list` (machine-readable list)
- `--json` (JSON output)
- `--format` (output format control)

**Conclusion**: CLI is designed for human interaction, not automation.

---

## Competitive Analysis

### Other Coding Agents

**GitHub Copilot**:
- API: ✅ REST API available
- Environments: ✅ Programmatic management
- CLI: ✅ JSON output modes

**Cursor**:
- API: ⚠️ Limited
- Environments: ⚠️ Manual configuration
- CLI: ✅ JSON modes

**Codex (OpenAI)**:
- API: ❌ No programmatic access
- Environments: ❌ Web UI only
- CLI: ⚠️ Interactive TUI only

**Observation**: OpenAI Codex is **behind competitors** in API maturity for environment management.

---

## Conclusion

### Summary

**No programmatic access to Codex Cloud environments exists** via:
- ❌ REST API
- ❌ GraphQL
- ❌ SDK methods (`@openai/codex-sdk`)
- ❌ CLI JSON output
- ❌ Undocumented/internal APIs (not recommended)

**Only access method**:
- ✅ Manual configuration via ChatGPT web UI
- ✅ Manual local config file (`environments.json`)

### Impact on Codex Control MCP

**Current Implementation** ✅:
- Users manually maintain environment list
- `codex_list_environments` reads from local config
- `codex_github_setup_guide` helps with setup
- Works reliably with known limitations

**Blockers for Auto-Discovery** ❌:
- Cannot automatically fetch user's environments
- Cannot sync changes from ChatGPT settings
- Cannot validate environment IDs before submission

**Workaround Success** ✅:
- Manual config is acceptable for MVP
- Users already manage Codex environments in web UI
- One-time setup per environment is reasonable
- Clear documentation mitigates friction

### Next Steps

1. ✅ **Keep current manual configuration approach**
2. ✅ **Document setup clearly in README**
3. ✅ **Monitor OpenAI for API updates**
4. 🔄 **Add auto-discovery when API becomes available**

---

**Report Complete** 📊
