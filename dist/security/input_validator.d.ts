/**
 * Input Validator for Codex MCP Server
 *
 * Validates and sanitizes inputs to prevent:
 * - Command injection
 * - Path traversal
 * - Invalid parameter combinations
 * - Malicious task descriptions
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}
export declare class InputValidator {
    /**
     * Validate task description
     */
    static validateTask(task: string | undefined): ValidationResult;
    /**
     * Validate execution mode
     */
    static validateMode(mode: string | undefined): ValidationResult;
    /**
     * Validate model name
     */
    static validateModel(model: string | undefined): ValidationResult;
    /**
     * Validate output schema (if provided)
     */
    static validateOutputSchema(schema: any): ValidationResult;
    /**
     * Validate working directory path
     */
    static validateWorkingDir(dir: string | undefined): ValidationResult;
    /**
     * Validate confirmation flag for mutations
     */
    static validateConfirmation(confirm: boolean | undefined, mode: string | undefined): ValidationResult;
    /**
     * Validate all inputs for a Codex task
     */
    static validateAll(inputs: {
        task?: string;
        mode?: string;
        model?: string;
        outputSchema?: any;
        workingDir?: string;
        confirm?: boolean;
    }): ValidationResult;
}
//# sourceMappingURL=input_validator.d.ts.map