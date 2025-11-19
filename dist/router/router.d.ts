/**
 * Router Component
 *
 * Routes natural language instructions to appropriate primitives.
 * Handles:
 * - Intent parsing
 * - Task disambiguation (auto-resolve or prompt)
 * - Mode inference (local vs cloud)
 * - Async execution (returns task ID immediately)
 */
import { IntentParser, Intent, IntentHints } from "./intent_parser.js";
import { TaskRegistry, Task } from "../state/task_registry.js";
/**
 * Execution mode
 */
export type ExecutionMode = "local" | "cloud" | "auto";
/**
 * Primitive operation (hidden tool)
 */
export type PrimitiveOperation = "_codex_local_run" | "_codex_local_exec" | "_codex_local_resume" | "_codex_local_status" | "_codex_local_wait" | "_codex_local_cancel" | "_codex_local_results" | "_codex_cloud_submit" | "_codex_cloud_status" | "_codex_cloud_wait" | "_codex_cloud_cancel" | "_codex_cloud_results" | "_codex_cloud_list_environments" | "_codex_cloud_github_setup";
/**
 * Router input (from unified `codex` tool)
 */
export interface RouterInput {
    request: string;
    hints?: IntentHints;
    context?: {
        workingDir?: string;
        repoRoot?: string;
        hasGit?: boolean;
    };
    preference?: {
        mode?: ExecutionMode;
        timeoutMs?: number;
        pollFrequencyMs?: number;
    };
    dryRun?: boolean;
    explain?: boolean;
}
/**
 * Router output
 */
export interface RouterOutput {
    primitive: PrimitiveOperation;
    parameters: Record<string, any>;
    intent: Intent;
    taskId?: string;
    needsDisambiguation?: boolean;
    disambiguationOptions?: Array<{
        taskId: string;
        label: string;
        status: string;
        age: string;
    }>;
    decisionTrace?: string[];
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}
/**
 * Disambiguation error (special case)
 */
export declare class DisambiguationError extends Error {
    options: Array<{
        id: string;
        label: string;
    }>;
    tasks: Task[];
    constructor(options: Array<{
        id: string;
        label: string;
    }>, tasks: Task[]);
}
/**
 * Router
 */
export declare class Router {
    private parser;
    private registry;
    private trace;
    constructor(parser: IntentParser, registry: TaskRegistry);
    /**
     * Route instruction to primitive
     */
    route(input: RouterInput): Promise<RouterOutput>;
    /**
     * Route by intent type
     */
    private routeByIntent;
    /**
     * Route execution intent
     */
    private routeExecution;
    /**
     * Route status check intent
     */
    private routeStatus;
    /**
     * Route wait intent
     */
    private routeWait;
    /**
     * Route cancel intent
     */
    private routeCancel;
    /**
     * Route fetch results intent
     */
    private routeFetch;
    /**
     * Route setup intent
     */
    private routeSetup;
    /**
     * Resolve task ID (auto-resolve or disambiguate)
     */
    private resolveTaskId;
    /**
     * Infer execution mode (local vs cloud)
     */
    private inferMode;
    /**
     * Check if task needs threading (SDK vs CLI)
     */
    private needsThreading;
    /**
     * Format age in human-readable form
     */
    private formatAge;
    /**
     * Add entry to decision trace
     */
    private addTrace;
}
export declare function createRouter(parser?: IntentParser, registry?: TaskRegistry): Promise<Router>;
//# sourceMappingURL=router.d.ts.map