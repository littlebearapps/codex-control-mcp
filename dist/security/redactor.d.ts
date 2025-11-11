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
export interface RedactionPattern {
    name: string;
    pattern: RegExp;
    replacement: string;
}
export declare class Redactor {
    private patterns;
    constructor(customPatterns?: RedactionPattern[]);
    /**
     * Default redaction patterns for common secrets
     */
    private getDefaultPatterns;
    /**
     * Redact secrets from a string
     */
    redact(text: string): string;
    /**
     * Redact secrets from process output
     */
    redactOutput(output: {
        stdout: string;
        stderr: string;
    }): {
        stdout: string;
        stderr: string;
    };
    /**
     * Redact secrets from an object (recursive)
     */
    redactObject(obj: any): any;
    /**
     * Check if a string contains potential secrets
     */
    containsSecrets(text: string): boolean;
    /**
     * Get list of pattern names that matched
     */
    getMatches(text: string): string[];
}
/**
 * Global redactor instance (singleton)
 */
export declare const globalRedactor: Redactor;
//# sourceMappingURL=redactor.d.ts.map