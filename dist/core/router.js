/**
 * Router - Routes Parsed Intent to Hidden Primitives
 *
 * Takes IntentParseResult and executes the appropriate primitive tool.
 * Handles parameter validation, error recovery, and result formatting.
 *
 * v3.0 Feature: Bridge between unified tool and hidden primitives
 */
/**
 * Router Engine
 */
export class Router {
    primitives = new Map();
    /**
     * Register a primitive tool
     */
    registerPrimitive(name, tool) {
        this.primitives.set(name, tool);
    }
    /**
     * Route intent to appropriate primitive
     */
    async route(intentResult) {
        // Check if intent was successfully parsed
        if (!intentResult.intent) {
            return {
                success: false,
                primitive: '',
                error: intentResult.error || 'Could not determine intent',
                suggestion: this.suggestAlternatives(intentResult),
            };
        }
        // Check if disambiguation is needed
        if (intentResult.requiresDisambiguation) {
            return {
                success: false,
                primitive: intentResult.intent.primitive,
                error: 'Input is ambiguous',
                suggestion: this.formatDisambiguationOptions(intentResult),
            };
        }
        const { primitive, extractedParams, confidence } = intentResult.intent;
        // Check if primitive exists
        const tool = this.primitives.get(primitive);
        if (!tool) {
            return {
                success: false,
                primitive,
                error: `Primitive "${primitive}" not found`,
                suggestion: 'Available primitives: ' + Array.from(this.primitives.keys()).join(', '),
            };
        }
        // Validate confidence threshold
        const MIN_EXECUTION_CONFIDENCE = 60;
        if (confidence < MIN_EXECUTION_CONFIDENCE) {
            return {
                success: false,
                primitive,
                error: `Confidence too low (${confidence}%). Please be more specific.`,
                suggestion: this.suggestAlternatives(intentResult),
            };
        }
        // Get tool schema for parameter validation
        const schema = tool.getSchema();
        // Validate required parameters
        const validationError = this.validateParameters(extractedParams, schema);
        if (validationError) {
            return {
                success: false,
                primitive,
                error: `Parameter validation failed: ${validationError}`,
                suggestion: this.suggestParameterFixes(extractedParams, schema),
            };
        }
        // Execute primitive
        try {
            const result = await tool.execute(extractedParams);
            return {
                success: true,
                primitive,
                result,
            };
        }
        catch (error) {
            return {
                success: false,
                primitive,
                error: error instanceof Error ? error.message : String(error),
                suggestion: 'Check if Codex CLI is installed and authenticated',
            };
        }
    }
    /**
     * Validate parameters against tool schema
     */
    validateParameters(params, schema) {
        const required = schema.inputSchema?.required || [];
        for (const requiredParam of required) {
            if (!(requiredParam in params) || params[requiredParam] === undefined) {
                return `Missing required parameter: ${requiredParam}`;
            }
        }
        // Type validation could be added here
        // For now, we trust the intent parser's extraction
        return null;
    }
    /**
     * Suggest alternatives when intent is unclear
     */
    suggestAlternatives(intentResult) {
        if (intentResult.alternatives.length === 0) {
            return 'Try being more specific about what you want to do.';
        }
        const suggestions = intentResult.alternatives
            .slice(0, 3)
            .map(alt => `- "${alt.primitive}" (${alt.confidence}% confidence): ${alt.reasoning}`)
            .join('\n');
        return `Did you mean one of these?\n${suggestions}`;
    }
    /**
     * Format disambiguation options for user
     */
    formatDisambiguationOptions(intentResult) {
        if (!intentResult.intent || !intentResult.alternatives[0]) {
            return '';
        }
        const option1 = intentResult.intent;
        const option2 = intentResult.alternatives[0];
        return `Please clarify:\n` +
            `1. ${option1.primitive} (${option1.confidence}% confidence)\n` +
            `2. ${option2.primitive} (${option2.confidence}% confidence)\n\n` +
            `Respond with "option 1" or "option 2", or rephrase your request.`;
    }
    /**
     * Suggest how to fix parameter issues
     */
    suggestParameterFixes(params, schema) {
        const required = schema.inputSchema?.required || [];
        const properties = schema.inputSchema?.properties || {};
        const missing = required.filter((r) => !(r in params));
        if (missing.length === 0) {
            return '';
        }
        const suggestions = missing.map((param) => {
            const prop = properties[param];
            return `- ${param}: ${prop?.description || 'required'}`;
        });
        return `Please provide:\n${suggestions.join('\n')}`;
    }
    /**
     * Get list of registered primitives
     */
    getRegisteredPrimitives() {
        return Array.from(this.primitives.keys());
    }
}
// Singleton instance
export const globalRouter = new Router();
//# sourceMappingURL=router.js.map