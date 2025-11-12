/**
 * Input Validator for Codex MCP Server
 *
 * Validates and sanitizes inputs to prevent:
 * - Command injection
 * - Path traversal
 * - Invalid parameter combinations
 * - Malicious task descriptions
 */
export class InputValidator {
    /**
     * Validate task description
     */
    static validateTask(task) {
        if (!task) {
            return { valid: false, error: 'Task description is required' };
        }
        if (typeof task !== 'string') {
            return { valid: false, error: 'Task must be a string' };
        }
        if (task.trim().length === 0) {
            return { valid: false, error: 'Task cannot be empty' };
        }
        if (task.length > 10000) {
            return { valid: false, error: 'Task description too long (max 10000 characters)' };
        }
        return { valid: true };
    }
    /**
     * Validate execution mode
     */
    static validateMode(mode) {
        if (!mode) {
            return { valid: true }; // Default mode is acceptable
        }
        const validModes = ['read-only', 'workspace-write', 'danger-full-access'];
        if (!validModes.includes(mode)) {
            return {
                valid: false,
                error: `Invalid mode: ${mode}. Must be one of: ${validModes.join(', ')}`,
            };
        }
        return { valid: true };
    }
    /**
     * Validate model name
     */
    static validateModel(model) {
        if (!model) {
            return { valid: true }; // Default model is acceptable
        }
        if (typeof model !== 'string') {
            return { valid: false, error: 'Model must be a string' };
        }
        // Whitelist known model patterns
        const validPatterns = [
            /^gpt-4o(-\d{4}-\d{2}-\d{2})?$/,
            /^gpt-4o-mini(-\d{4}-\d{2}-\d{2})?$/,
            /^o1(-preview|-mini)?$/,
            /^o3(-mini)?$/,
        ];
        const isValid = validPatterns.some((pattern) => pattern.test(model));
        if (!isValid) {
            return {
                valid: false,
                error: `Invalid model: ${model}. Must be a recognized OpenAI model`,
            };
        }
        return { valid: true };
    }
    /**
     * Validate output schema (if provided)
     */
    static validateOutputSchema(schema) {
        if (schema === undefined || schema === null) {
            return { valid: true };
        }
        if (typeof schema !== 'object') {
            return { valid: false, error: 'Output schema must be an object' };
        }
        // Basic JSON Schema validation
        if (schema.type && typeof schema.type !== 'string') {
            return { valid: false, error: 'Output schema type must be a string' };
        }
        return { valid: true };
    }
    /**
     * Validate working directory path
     */
    static validateWorkingDir(dir) {
        if (!dir) {
            return { valid: true }; // Current directory is acceptable
        }
        if (typeof dir !== 'string') {
            return { valid: false, error: 'Working directory must be a string' };
        }
        // Prevent path traversal attacks
        if (dir.includes('..')) {
            return {
                valid: false,
                error: 'Path traversal not allowed in working directory',
            };
        }
        // Must be absolute path
        if (!dir.startsWith('/')) {
            return {
                valid: false,
                error: 'Working directory must be an absolute path',
            };
        }
        return { valid: true };
    }
    /**
     * Validate confirmation flag for mutations
     */
    static validateConfirmation(confirm, mode) {
        // If mode is read-only, confirmation not needed
        if (mode === 'read-only') {
            return { valid: true };
        }
        // For mutation modes, require explicit confirmation
        if (mode === 'workspace-write' || mode === 'danger-full-access') {
            if (confirm !== true) {
                return {
                    valid: false,
                    error: 'Mutation mode requires confirm=true',
                };
            }
        }
        return { valid: true };
    }
    /**
     * Validate all inputs for a Codex task
     */
    static validateAll(inputs) {
        // Validate each field
        const validations = [
            this.validateTask(inputs.task),
            this.validateMode(inputs.mode),
            this.validateModel(inputs.model),
            this.validateOutputSchema(inputs.outputSchema),
            this.validateWorkingDir(inputs.workingDir),
            this.validateConfirmation(inputs.confirm, inputs.mode),
        ];
        // Return first error found
        for (const result of validations) {
            if (!result.valid) {
                return result;
            }
        }
        return { valid: true };
    }
}
//# sourceMappingURL=input_validator.js.map