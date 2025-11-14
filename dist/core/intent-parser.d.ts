/**
 * Intent Parser - Natural Language → Primitive Mapping
 *
 * Maps user's natural language input to the appropriate hidden primitive.
 * Uses keyword-based classification with confidence scoring.
 *
 * v3.0 Feature: Foundation for unified `codex` tool
 */
export interface PrimitiveIntent {
    primitive: string;
    confidence: number;
    extractedParams: Record<string, any>;
    reasoning?: string;
}
export interface IntentParseResult {
    intent: PrimitiveIntent | null;
    alternatives: PrimitiveIntent[];
    requiresDisambiguation: boolean;
    error?: string;
}
/**
 * Intent Parser Engine
 */
export declare class IntentParser {
    /**
     * Parse natural language input to identify the intended primitive
     */
    parse(input: string): IntentParseResult;
    /**
     * Score how well a primitive matches the input
     */
    private scorePrimitive;
    /**
     * Extract parameters from natural language
     */
    private extractParameters;
    /**
     * Generate reasoning for why a primitive was selected
     */
    private generateReasoning;
    /**
     * Suggest clarifying questions for disambiguation
     */
    suggestClarification(result: IntentParseResult): string;
}
export declare const globalIntentParser: IntentParser;
//# sourceMappingURL=intent-parser.d.ts.map