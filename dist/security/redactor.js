/**
 * Secret Redactor for Codex MCP Server
 *
 * Redacts sensitive information from:
 * - JSONL event streams
 * - Process output (stdout/stderr)
 * - Error messages and logs
 *
 * Prevents accidental leakage of:
 * - API keys
 * - Tokens
 * - Passwords
 * - Private keys
 * - Environment variables
 */
export class Redactor {
    patterns;
    constructor(customPatterns = []) {
        this.patterns = [...this.getDefaultPatterns(), ...customPatterns];
    }
    /**
     * Default redaction patterns for common secrets
     */
    getDefaultPatterns() {
        return [
            // API Keys (various formats)
            {
                name: "openai-api-key",
                pattern: /sk-[A-Za-z0-9]{48}/g,
                replacement: "sk-***REDACTED***",
            },
            {
                name: "generic-api-key",
                pattern: /['"](api[_-]?key|apikey)['"]\s*[:=]\s*['"][^'"]{8,}['"]/gi,
                replacement: '"api_key": "***REDACTED***"',
            },
            // Bearer tokens
            {
                name: "bearer-token",
                pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/gi,
                replacement: "Bearer ***REDACTED***",
            },
            // AWS credentials
            {
                name: "aws-access-key",
                pattern: /AKIA[0-9A-Z]{16}/g,
                replacement: "AKIA***REDACTED***",
            },
            {
                name: "aws-secret-key",
                pattern: /['"](aws[_-]?secret[_-]?access[_-]?key)['"]\s*[:=]\s*['"][^'"]{20,}['"]/gi,
                replacement: '"aws_secret_access_key": "***REDACTED***"',
            },
            // GitHub tokens
            {
                name: "github-token",
                pattern: /ghp_[A-Za-z0-9]{36}/g,
                replacement: "ghp_***REDACTED***",
            },
            {
                name: "github-oauth",
                pattern: /gho_[A-Za-z0-9]{36}/g,
                replacement: "gho_***REDACTED***",
            },
            // Private keys
            {
                name: "private-key",
                pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
                replacement: "-----BEGIN PRIVATE KEY-----\n***REDACTED***\n-----END PRIVATE KEY-----",
            },
            // JWT tokens
            {
                name: "jwt-token",
                pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
                replacement: "eyJ***REDACTED***.eyJ***REDACTED***.***REDACTED***",
            },
            // Password patterns
            {
                name: "password",
                pattern: /['"](password|passwd|pwd)['"]\s*[:=]\s*['"][^'"]{6,}['"]/gi,
                replacement: '"password": "***REDACTED***"',
            },
            // Database connection strings
            {
                name: "database-url",
                pattern: /(postgres|mysql|mongodb):\/\/[^:]+:[^@]+@[^\s'"]+/gi,
                replacement: "$1://***REDACTED***@***REDACTED***",
            },
            // Generic secrets in environment variables
            {
                name: "env-secret",
                pattern: /([A-Z_]+(?:SECRET|TOKEN|KEY|PASSWORD|PASSWD|PWD)[A-Z_]*)\s*=\s*['"]?[^\s'"]{8,}['"]?/gi,
                replacement: "$1=***REDACTED***",
            },
        ];
    }
    /**
     * Redact secrets from a string
     */
    redact(text) {
        let redacted = text;
        for (const { pattern, replacement } of this.patterns) {
            redacted = redacted.replace(pattern, replacement);
        }
        return redacted;
    }
    /**
     * Redact secrets from process output
     */
    redactOutput(output) {
        return {
            stdout: this.redact(output.stdout),
            stderr: this.redact(output.stderr),
        };
    }
    /**
     * Redact secrets from an object (recursive)
     */
    redactObject(obj) {
        if (typeof obj === "string") {
            return this.redact(obj);
        }
        if (Array.isArray(obj)) {
            return obj.map((item) => this.redactObject(item));
        }
        if (obj !== null && typeof obj === "object") {
            const redacted = {};
            for (const [key, value] of Object.entries(obj)) {
                redacted[key] = this.redactObject(value);
            }
            return redacted;
        }
        return obj;
    }
    /**
     * Check if a string contains potential secrets
     */
    containsSecrets(text) {
        for (const { pattern } of this.patterns) {
            if (pattern.test(text)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Get list of pattern names that matched
     */
    getMatches(text) {
        const matches = [];
        for (const { name, pattern } of this.patterns) {
            if (pattern.test(text)) {
                matches.push(name);
            }
        }
        return matches;
    }
}
/**
 * Global redactor instance (singleton)
 */
export const globalRedactor = new Redactor();
//# sourceMappingURL=redactor.js.map