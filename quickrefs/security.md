# Security Quick Reference

Security features, best practices, and threat mitigation for Codex Control MCP.

---

## Security Layers

### Layer 1: Input Validation
### Layer 2: Secret Redaction
### Layer 3: Mutation Gating
### Layer 4: Process Isolation
### Layer 5: Environment Variable Control

---

## Layer 1: Input Validation

**File**: `src/security/input_validator.ts`

**Purpose**: Prevent malicious inputs from reaching Codex CLI.

### Validations

#### Task Description
- **Max length**: 10,000 characters
- **Required**: Non-empty string
- **Sanitization**: Escape shell metacharacters

**Example**:
```typescript
// ❌ Rejected
task: "" // Empty
task: "x".repeat(10001) // Too long

// ✅ Accepted
task: "Analyze main.ts for bugs"
```

#### Execution Mode
- **Whitelist**: `read-only`, `full-auto`, `danger-full-access`
- **Default**: `read-only`

**Example**:
```typescript
// ❌ Rejected
mode: "unrestricted"
mode: "custom"

// ✅ Accepted
mode: "read-only"
mode: "full-auto"
```

#### Model Name
- **Whitelist**: Known OpenAI models (`gpt-4o`, `o1`, `o3-mini`, etc.)
- **Pattern**: `gpt-` prefix or recognized model names

**Example**:
```typescript
// ❌ Rejected
model: "hacked-model"
model: "arbitrary-string"

// ✅ Accepted
model: "gpt-4o"
model: "o3-mini"
```

#### Working Directory
- **No path traversal**: Reject `..` sequences
- **Absolute paths only**: Must start with `/`
- **Exists check**: Directory must exist

**Example**:
```typescript
// ❌ Rejected
workingDir: "../../../etc"
workingDir: "relative/path"
workingDir: "/nonexistent"

// ✅ Accepted
workingDir: "/Users/nathanschram/project"
```

#### Environment Policy
- **Whitelist**: `inherit-none`, `inherit-all`, `allow-list`
- **Default**: `inherit-none` (most secure)

**Example**:
```typescript
// ❌ Rejected
envPolicy: "custom"

// ✅ Accepted
envPolicy: "inherit-none"
envPolicy: "allow-list"
```

---

## Layer 2: Secret Redaction

**File**: `src/security/redactor.ts`

**Purpose**: Scrub sensitive data from all outputs.

### Redacted Patterns (15+)

#### API Keys
- OpenAI: `sk-proj-...` → `sk-***REDACTED***`
- OpenAI: `sk-...` → `sk-***REDACTED***`
- Generic: `api_key=...` → `api_key=***REDACTED***`

#### AWS Credentials
- Access Key: `AKIA...` → `AKIA***REDACTED***`
- Secret: `aws_secret_access_key=...` → `aws_secret_access_key=***REDACTED***`

#### GitHub Tokens
- Personal: `ghp_...` → `ghp_***REDACTED***`
- OAuth: `gho_...` → `gho_***REDACTED***`
- Fine-grained: `github_pat_...` → `github_pat_***REDACTED***`

#### JWT Tokens
- Pattern: `eyJ...` → `eyJ***REDACTED***`

#### Private Keys
- RSA: `-----BEGIN PRIVATE KEY-----...` → `***REDACTED***`

#### Passwords
- Env var: `PASSWORD=...` → `PASSWORD=***REDACTED***`
- URL: `postgres://user:pass@host` → `postgres://user:***REDACTED***@host`

#### Bearer Tokens
- Header: `Authorization: Bearer ...` → `Authorization: Bearer ***REDACTED***`

### Redaction Points

**1. Process stdout**:
```typescript
// Before redaction
OPENAI_API_KEY=sk-proj-abc123def456

// After redaction
OPENAI_API_KEY=sk-***REDACTED***
```

**2. Process stderr**:
```typescript
// Before redaction
Error: Invalid token ghp_abc123def456

// After redaction
Error: Invalid token ghp_***REDACTED***
```

**3. Event stream**:
```typescript
// Before redaction
{"type":"log","message":"Using key sk-proj-abc123"}

// After redaction
{"type":"log","message":"Using key sk-***REDACTED***"}
```

**4. Error messages**:
```typescript
// Before redaction
Authentication failed with key sk-proj-abc123

// After redaction
Authentication failed with key sk-***REDACTED***
```

### Testing Redaction

```typescript
// Test with real secrets (NEVER commit)
const testSecret = process.env.OPENAI_API_KEY;

// Verify redaction
const output = executeCodex(task);
console.assert(!output.includes(testSecret));
```

---

## Layer 3: Mutation Gating

**File**: `src/tools/apply.ts`

**Purpose**: Prevent accidental file modifications.

### Confirmation Requirement

**Rule**: File-modifying modes require explicit `confirm=true`.

**Modes Requiring Confirmation**:
- `full-auto`
- `danger-full-access`

**Example**:
```typescript
// ❌ Rejected
{
  task: "Modify files",
  mode: "full-auto",
  confirm: false  // Missing confirmation
}

// ✅ Accepted
{
  task: "Modify files",
  mode: "full-auto",
  confirm: true
}
```

### Two-Step Workflow

**Step 1: Preview with `codex_plan`**:
```typescript
{
  task: "Add error handling to API endpoints"
}
// Returns: Proposed changes (no execution)
```

**Step 2: Apply with confirmation**:
```typescript
{
  task: "Add error handling to API endpoints",
  confirm: true,
  mode: "full-auto"
}
// Returns: Changes applied
```

### Read-Only Mode

**No confirmation needed**:
```typescript
{
  task: "Analyze code",
  mode: "read-only"  // No confirm needed
}
```

---

## Layer 4: Process Isolation

**File**: `src/executor/process_manager.ts`

**Purpose**: Prevent shell injection and resource exhaustion.

### No Shell Injection

**❌ Dangerous** (DO NOT USE):
```typescript
// Vulnerable to injection
exec(`codex exec "${userInput}"`)

// User input: "; rm -rf /"
// Executes: codex exec ""; rm -rf /"
```

**✅ Safe** (USED):
```typescript
// No shell, direct process spawn
spawn('codex', ['exec', userInput])

// User input is passed as argument
// Shell metacharacters are escaped
```

### Concurrency Limits

**Purpose**: Prevent resource exhaustion.

**Configuration**:
```bash
# Default: 2 parallel processes
CODEX_MAX_CONCURRENCY=2

# Increase for more parallelism (use with caution)
CODEX_MAX_CONCURRENCY=4
```

**Queue Behavior**:
```
MAX_CONCURRENCY = 2

Request 1 → Running (slot 1)
Request 2 → Running (slot 2)
Request 3 → Queued (waiting)
Request 4 → Queued (waiting)

# When Request 1 completes:
Request 3 → Running (slot 1)
```

### Process Cleanup

**On Normal Exit**:
- Capture stdout/stderr
- Parse JSONL events
- Return results
- Release slot

**On Error/Timeout**:
- Kill process (`SIGTERM` then `SIGKILL`)
- Log error
- Return error to user
- Release slot

---

## Layer 5: Environment Variable Control

**Purpose**: Control which environment variables reach Codex Cloud.

### Three Policies

#### 1. `inherit-none` (Default, Most Secure)

**Behavior**: No environment variables passed.

**Example**:
```typescript
{
  task: "Run tests",
  envPolicy: "inherit-none"
}
// Codex Cloud sees: Empty environment
```

**Use When**:
- Default choice for security
- Task doesn't need environment
- Sandboxed execution required

#### 2. `inherit-all` (Convenient, Less Secure)

**Behavior**: All environment variables passed.

**Example**:
```typescript
{
  task: "Deploy to staging",
  envPolicy: "inherit-all"
}
// Codex Cloud sees: All env vars from MCP server
```

**Use When**:
- Trust task completely
- Need full environment
- Controlled context

**⚠️ Warning**: Passes ALL secrets in environment!

#### 3. `allow-list` (Recommended)

**Behavior**: Only specified variables passed.

**Example**:
```typescript
{
  task: "Run integration tests",
  envPolicy: "allow-list",
  envAllowList: ["DATABASE_URL", "API_KEY", "TEST_ENV"]
}
// Codex Cloud sees: Only DATABASE_URL, API_KEY, TEST_ENV
```

**Use When**:
- Need specific secrets
- Want minimal exposure
- Production best practice

### Integration with Keychain

**Setup** (using `direnv` + `kc.sh`):
```bash
# .envrc
source ~/bin/kc.sh
kc_load

# Loads secrets from macOS Keychain
# OPENAI_API_KEY, DATABASE_URL, etc.
```

**MCP Server Environment**:
```
MCP Server inherits:
  OPENAI_API_KEY=sk-proj-...
  DATABASE_URL=postgres://...
  AWS_ACCESS_KEY_ID=AKIA...
```

**Selective Passing**:
```typescript
// Only pass what's needed
{
  task: "Run database migrations",
  envPolicy: "allow-list",
  envAllowList: ["DATABASE_URL"]
}
// Codex Cloud sees: DATABASE_URL only
```

---

## Security Best Practices

### Development

#### Always
- ✅ Use `mode='read-only'` first
- ✅ Preview with `codex_plan` before `codex_apply`
- ✅ Review git diff before committing
- ✅ Use `envPolicy='allow-list'` for secrets

#### Never
- ❌ Commit secrets to git
- ❌ Use `danger-full-access` without understanding
- ❌ Use `envPolicy='inherit-all'` by default
- ❌ Skip input validation

### Production

#### Required
- ✅ Use environment variables for secrets (not hardcoded)
- ✅ Test secret redaction regularly
- ✅ Monitor concurrency limits
- ✅ Review all file modifications

#### Prohibited
- ❌ Hardcoded API keys in code
- ❌ Secrets in task descriptions
- ❌ Unvalidated user inputs
- ❌ Shell command execution with `exec()`

---

## Threat Model

### Threats Mitigated

#### 1. Command Injection ✅
- **Attack**: Malicious input in task description
- **Mitigation**: `spawn()` not `exec()`, input validation
- **Example**: `task: "; rm -rf /"` → Rejected by validator

#### 2. Path Traversal ✅
- **Attack**: `workingDir: "../../../etc"`
- **Mitigation**: Path validation, no `..` allowed
- **Example**: Rejected during input validation

#### 3. Secret Exposure ✅
- **Attack**: Secrets in logs or outputs
- **Mitigation**: Pattern-based redaction (15+ patterns)
- **Example**: `sk-proj-abc123` → `sk-***REDACTED***`

#### 4. Resource Exhaustion ✅
- **Attack**: Spam requests to exhaust resources
- **Mitigation**: Concurrency limits, queue management
- **Example**: Max 2 processes, rest queued

#### 5. Unintended Mutations ✅
- **Attack**: Accidental file deletion
- **Mitigation**: Mutation gating with `confirm=true`
- **Example**: `codex_apply` requires explicit confirmation

### Threats NOT Mitigated

#### 1. Malicious Codex Cloud Environments ⚠️
- **Attack**: Compromised Codex Cloud environment
- **Mitigation**: User responsibility to audit environments
- **Recommendation**: Review environment setup scripts

#### 2. Compromised Dependencies ⚠️
- **Attack**: Malicious npm package
- **Mitigation**: Regular dependency audits
- **Recommendation**: Use `npm audit`, `dependabot`

#### 3. Local Machine Compromise ⚠️
- **Attack**: Malware on developer machine
- **Mitigation**: Outside scope of MCP server
- **Recommendation**: Use antivirus, firewall, etc.

---

## Security Checklist

### Before Deployment
- [ ] No hardcoded secrets in code
- [ ] Secret redaction tested
- [ ] Input validation enabled
- [ ] Mutation gating configured
- [ ] Environment variables documented
- [ ] Concurrency limits set

### During Development
- [ ] Use `read-only` mode first
- [ ] Preview changes with `codex_plan`
- [ ] Review git diff before commits
- [ ] Use feature branches (not main)
- [ ] Test with real secrets (verify redaction)

### After Execution
- [ ] No secrets in logs
- [ ] File changes reviewed
- [ ] Tests pass
- [ ] Git history clean (no secrets)
- [ ] Environment variables not leaked

---

## Security Resources

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **npm Security**: https://docs.npmjs.com/cli/v8/commands/npm-audit
- **MCP Security**: https://github.com/modelcontextprotocol/sdk#security
- **Node.js Security**: https://nodejs.org/en/docs/guides/security/
