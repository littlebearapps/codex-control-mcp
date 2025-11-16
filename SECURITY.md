# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 4.x     | :white_check_mark: |
| 3.x     | :white_check_mark: |
| < 3.0   | :x:                |

## Reporting a Vulnerability

We take the security of mcp-delegator seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Where to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to:

**security@littlebearapps.com**

### What to Include

Please include the following information in your report:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours
- **Updates**: We will provide updates on the progress of addressing the vulnerability every 7 days
- **Timeline**: We aim to publish a fix within 30 days for critical vulnerabilities
- **Credit**: We will credit you in the security advisory (unless you prefer to remain anonymous)

### Disclosure Policy

- **Coordinated Disclosure**: We request that you do not publicly disclose the vulnerability until we have had a chance to address it
- **Timeline**: We aim to disclose vulnerabilities within 90 days of the initial report
- **CVE**: We will request a CVE for confirmed vulnerabilities when appropriate

## Security Features

mcp-delegator implements several security measures:

### Supply Chain Security

- **npm Provenance**: All releases include npm provenance attestations
- **Dependency Scanning**: Automated Dependabot updates for vulnerable dependencies
- **Secret Scanning**: GitHub secret scanning with push protection enabled

### Code Security

- **CodeQL Analysis**: Automated static code analysis on all PRs and commits
- **Type Safety**: Written in TypeScript for compile-time type checking
- **Linting**: ESLint configured to catch common security issues

### Secrets Management

mcp-delegator uses keychain-based secrets management. See the [Keychain Quick Reference](quickrefs/KEYCHAIN-QUICK-REFERENCE.md) for:

- Secure storage using macOS Keychain (T2/SEP chip encryption)
- Zero plaintext credentials in environment files
- Automatic secret loading via direnv

**Important**: Never commit `.env` files or hardcode API keys in code.

## Security Best Practices

### For Users

1. **Keep Updated**: Always use the latest version to receive security patches
2. **Verify Provenance**: Check npm provenance when installing:
   ```bash
   npm audit signatures
   ```
3. **Use Keychain**: Store secrets in macOS Keychain, not in plaintext files
4. **Review Permissions**: Understand what MCP tools can access in your environment

### For Contributors

1. **No Secrets in Code**: Never commit API keys, tokens, or passwords
2. **Validate Input**: Always validate and sanitize user input
3. **Use Prepared Statements**: Use parameterized queries for database access (SQLite)
4. **Avoid Dangerous Functions**: Avoid `eval()`, `Function()`, and unsafe command execution
5. **Review Dependencies**: Check new dependencies for known vulnerabilities

## Security Audits

We conduct regular security audits:

- **Automated Scans**: Daily Dependabot alerts and weekly CodeQL scans
- **Manual Reviews**: Security-focused code reviews for all PRs
- **Penetration Testing**: Annual third-party security assessment (planned for v5.0)

## Known Security Considerations

### MCP Server Architecture

- **Local Execution**: MCP servers run locally with user permissions
- **Tool Access**: Servers can execute commands and access files as the user
- **Trust Model**: Only install MCP servers from trusted sources

### Codex Cloud Integration

- **API Keys**: Codex Cloud API key required for cloud execution
- **GitHub Token**: GitHub token required for repository operations
- **Environment Variables**: Secrets passed to cloud environments

## Vulnerability Disclosure History

See [CHANGELOG.md](CHANGELOG.md) for security-related updates in each release.

No critical vulnerabilities have been reported as of version 3.2.1.

## Contact

- **Security Issues**: security@littlebearapps.com
- **General Support**: GitHub Issues
- **Organization**: Little Bear Apps

---

**Last Updated**: 2025-01-16
**Policy Version**: 1.0
