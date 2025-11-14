/**
 * Router - Routes Parsed Intent to Hidden Primitives
 *
 * Takes IntentParseResult and executes the appropriate primitive tool.
 * Handles parameter validation, error recovery, and result formatting.
 *
 * v3.0 Feature: Bridge between unified tool and hidden primitives
 */
import { IntentParseResult } from './intent-parser.js';
export interface PrimitiveTool {
    getSchema(): any;
    execute(params: any): Promise<any>;
}
export interface RouterResult {
    success: boolean;
    primitive: string;
    result?: any;
    error?: string;
    suggestion?: string;
}
/**
 * Router Engine
 */
export declare class Router {
    private primitives;
    /**
     * Register a primitive tool
     */
    registerPrimitive(name: string, tool: PrimitiveTool): void;
    /**
     * Route intent to appropriate primitive
     */
    route(intentResult: IntentParseResult): Promise<RouterResult>;
    /**
     * Validate parameters against tool schema
     */
    private validateParameters;
    /**
     * Suggest alternatives when intent is unclear
     */
    private suggestAlternatives;
    /**
     * Format disambiguation options for user
     */
    private formatDisambiguationOptions;
    /**
     * Suggest how to fix parameter issues
     */
    private suggestParameterFixes;
    /**
     * Get list of registered primitives
     */
    getRegisteredPrimitives(): string[];
}
export declare const globalRouter: Router;
//# sourceMappingURL=router.d.ts.map