/**
 * Unified Codex Tool (v3.0)
 *
 * Single user-facing tool for all Codex operations.
 * Routes natural language instructions to appropriate hidden primitives.
 */
import { IntentHints } from "../router/intent_parser.js";
import { type CodexMetadata } from "../utils/metadata_extractor.js";
/**
 * Codex tool input schema
 */
export interface CodexToolInput {
    request: string;
    hints?: IntentHints;
    context?: {
        working_dir?: string;
        repo_root?: string;
    };
    preference?: {
        mode?: "auto" | "local" | "cloud";
        timeout_ms?: number;
        poll_frequency_ms?: number;
    };
    safety?: {
        require_confirmation?: boolean;
        max_cost_usd?: number;
    };
    dry_run?: boolean;
    explain?: boolean;
}
/**
 * Unified Codex response
 */
export interface CodexToolResponse {
    acknowledged: boolean;
    action: "run" | "check" | "wait" | "cancel" | "setup" | "results" | "none";
    decision_trace?: string[];
    task?: {
        id?: string;
        mode?: "local" | "cloud";
        status?: "pending" | "working" | "completed" | "failed" | "canceled" | "unknown";
        progress?: {
            percent?: number;
            current_step?: number;
            total_steps?: number;
            step_description?: string;
        };
        created_at?: string;
        updated_at?: string;
        ttl_ms?: number;
        recommended_poll_ms?: number;
    };
    result_summary?: {
        passed?: number;
        failed?: number;
        duration_ms?: number;
        artifacts?: string[];
    };
    next_action?: "poll" | "await" | "none";
    user_message: string;
    needs_disambiguation?: boolean;
    disambiguation_options?: Array<{
        taskId: string;
        label: string;
        status: string;
        age: string;
    }>;
    error?: {
        code: string;
        message: string;
        retry_after_ms?: number;
    };
    metadata?: CodexMetadata;
}
/**
 * Codex tool handler
 */
export declare function handleCodexTool(input: CodexToolInput, primitives?: PrimitiveToolMap): Promise<CodexToolResponse>;
/**
 * MCP tool definition for unified codex tool
 */
export declare const codexToolDefinition: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            request: {
                type: string;
                description: string;
            };
            hints: {
                type: string;
                description: string;
                properties: {
                    operation: {
                        type: string;
                        enum: string[];
                        description: string;
                    };
                    taskId: {
                        type: string;
                        description: string;
                    };
                    mode: {
                        type: string;
                        enum: string[];
                        description: string;
                    };
                };
            };
            context: {
                type: string;
                description: string;
                properties: {
                    working_dir: {
                        type: string;
                        description: string;
                    };
                    repo_root: {
                        type: string;
                        description: string;
                    };
                };
            };
            preference: {
                type: string;
                description: string;
                properties: {
                    mode: {
                        type: string;
                        enum: string[];
                        description: string;
                    };
                    timeout_ms: {
                        type: string;
                        description: string;
                    };
                    poll_frequency_ms: {
                        type: string;
                        description: string;
                    };
                };
            };
            dry_run: {
                type: string;
                description: string;
            };
            explain: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
/**
 * Primitive tool interface (for dependency injection)
 */
export interface PrimitiveTool {
    execute(params: any): Promise<any>;
}
/**
 * Primitive tool map (injected from main server)
 */
export interface PrimitiveToolMap {
    _codex_local_run: PrimitiveTool;
    _codex_local_status: PrimitiveTool;
    _codex_local_exec: PrimitiveTool;
    _codex_local_resume: PrimitiveTool;
    _codex_local_results: PrimitiveTool;
    _codex_local_wait: PrimitiveTool;
    _codex_local_cancel: PrimitiveTool;
    _codex_cloud_submit: PrimitiveTool;
    _codex_cloud_status: PrimitiveTool;
    _codex_cloud_results: PrimitiveTool;
    _codex_cloud_wait: PrimitiveTool;
    _codex_cloud_cancel: PrimitiveTool;
    _codex_cloud_list_environments: PrimitiveTool;
    _codex_cloud_github_setup: PrimitiveTool;
}
/**
 * MCP Tool Class for Unified Codex Interface
 */
export declare class CodexTool {
    private primitives?;
    constructor(primitives?: PrimitiveToolMap);
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                request: {
                    type: string;
                    description: string;
                };
                hints: {
                    type: string;
                    description: string;
                    properties: {
                        operation: {
                            type: string;
                            enum: string[];
                            description: string;
                        };
                        taskId: {
                            type: string;
                            description: string;
                        };
                        mode: {
                            type: string;
                            enum: string[];
                            description: string;
                        };
                    };
                };
                context: {
                    type: string;
                    description: string;
                    properties: {
                        working_dir: {
                            type: string;
                            description: string;
                        };
                        repo_root: {
                            type: string;
                            description: string;
                        };
                    };
                };
                preference: {
                    type: string;
                    description: string;
                    properties: {
                        mode: {
                            type: string;
                            enum: string[];
                            description: string;
                        };
                        timeout_ms: {
                            type: string;
                            description: string;
                        };
                        poll_frequency_ms: {
                            type: string;
                            description: string;
                        };
                    };
                };
                dry_run: {
                    type: string;
                    description: string;
                };
                explain: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
    execute(params: any): Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
}
//# sourceMappingURL=codex.d.ts.map