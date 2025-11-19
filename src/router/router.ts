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
export type PrimitiveOperation =
  | "_codex_local_run"
  | "_codex_local_exec"
  | "_codex_local_resume"
  | "_codex_local_status"
  | "_codex_local_wait"
  | "_codex_local_cancel"
  | "_codex_local_results"
  | "_codex_cloud_submit"
  | "_codex_cloud_status"
  | "_codex_cloud_wait"
  | "_codex_cloud_cancel"
  | "_codex_cloud_results"
  | "_codex_cloud_list_environments"
  | "_codex_cloud_github_setup";

/**
 * Router input (from unified `codex` tool)
 */
export interface RouterInput {
  request: string; // Natural language instruction
  hints?: IntentHints; // Optional structured hints
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
  dryRun?: boolean; // Route only, don't execute
  explain?: boolean; // Include decision trace
}

/**
 * Router output
 */
export interface RouterOutput {
  // Routing decision
  primitive: PrimitiveOperation;
  parameters: Record<string, any>;

  // Context
  intent: Intent;
  taskId?: string; // Resolved or generated task ID

  // Disambiguation (if needed)
  needsDisambiguation?: boolean;
  disambiguationOptions?: Array<{
    taskId: string;
    label: string;
    status: string;
    age: string;
  }>;

  // Decision trace (if explain=true)
  decisionTrace?: string[];

  // Error (if routing failed)
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Disambiguation error (special case)
 */
export class DisambiguationError extends Error {
  constructor(
    public options: Array<{ id: string; label: string }>,
    public tasks: Task[],
  ) {
    super(`Found ${tasks.length} tasks. Disambiguation needed.`);
    this.name = "DisambiguationError";
  }
}

/**
 * Router
 */
export class Router {
  private parser: IntentParser;
  private registry: TaskRegistry;
  private trace: string[] = [];

  constructor(parser: IntentParser, registry: TaskRegistry) {
    this.parser = parser;
    this.registry = registry;
  }

  /**
   * Route instruction to primitive
   */
  async route(input: RouterInput): Promise<RouterOutput> {
    this.trace = [];

    try {
      // Step 1: Parse intent
      const intent = this.parser.parse(input.request, input.hints);
      this.addTrace(
        `Parsed intent: ${this.parser.getIntentDescription(intent)}`,
      );

      // Step 2: Check for disambiguation needs
      if (this.parser.needsDisambiguation(intent)) {
        this.addTrace("Intent needs task ID disambiguation");
        const resolved = await this.resolveTaskId(
          intent,
          input.context?.workingDir,
        );

        if (!resolved.taskId) {
          // Return disambiguation response
          return {
            primitive: "_codex_local_status", // Placeholder
            parameters: {},
            intent,
            needsDisambiguation: true,
            disambiguationOptions: resolved.options,
            decisionTrace: input.explain ? this.trace : undefined,
          };
        }

        intent.taskId = resolved.taskId;
        this.addTrace(`Auto-resolved task ID: ${resolved.taskId}`);
      }

      // Step 3: Route based on intent type
      const routing = await this.routeByIntent(intent, input);

      return {
        ...routing,
        intent,
        decisionTrace: input.explain ? this.trace : undefined,
      };
    } catch (error) {
      this.addTrace(
        `Routing error: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        primitive: "_codex_local_status", // Placeholder
        parameters: {},
        intent: { type: "execute", raw: input.request },
        error: {
          code: "ROUTING_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
        decisionTrace: input.explain ? this.trace : undefined,
      };
    }
  }

  /**
   * Route by intent type
   */
  private async routeByIntent(
    _intent: Intent,
    input: RouterInput,
  ): Promise<Omit<RouterOutput, "intent" | "decisionTrace">> {
    const intent = _intent;
    switch (intent.type) {
      case "execute":
        return this.routeExecution(intent, input);
      case "status":
        return this.routeStatus(intent);
      case "wait":
        return this.routeWait(intent);
      case "cancel":
        return this.routeCancel(intent);
      case "fetch":
        return this.routeFetch(intent);
      case "setup":
        return this.routeSetup(intent);
      default:
        throw new Error(`Unknown intent type: ${(intent as any).type}`);
    }
  }

  /**
   * Route execution intent
   */
  private async routeExecution(
    intent: Intent,
    input: RouterInput,
  ): Promise<Omit<RouterOutput, "intent" | "decisionTrace">> {
    // Infer mode (local vs cloud)
    const mode = this.inferMode(intent, input);
    this.addTrace(`Inferred mode: ${mode}`);

    if (mode === "cloud") {
      // Cloud execution
      return {
        primitive: "_codex_cloud_submit",
        parameters: {
          task: intent.task,
          // envId must be provided separately
        },
      };
    }

    // Local execution - choose CLI vs SDK
    const needsThread = this.needsThreading(intent, input);
    const primitive = needsThread ? "_codex_local_exec" : "_codex_local_run";
    this.addTrace(
      `Selected primitive: ${primitive} (threading=${needsThread})`,
    );

    return {
      primitive,
      parameters: {
        task: intent.task,
        mode: "read-only", // Default to safe mode
        workingDir: input.context?.workingDir,
      },
    };
  }

  /**
   * Route status check intent
   */
  private routeStatus(
    intent: Intent,
  ): Omit<RouterOutput, "intent" | "decisionTrace"> {
    if (!intent.taskId) {
      throw new Error("Task ID required for status check");
    }

    // Determine if local or cloud based on task ID
    const isCloud = intent.taskId.startsWith("T-cloud-");
    const primitive = isCloud ? "_codex_cloud_status" : "_codex_local_status";
    this.addTrace(`Routing to ${primitive}`);

    return {
      primitive,
      parameters: {
        task_id: intent.taskId,
      },
      taskId: intent.taskId,
    };
  }

  /**
   * Route wait intent
   */
  private routeWait(
    intent: Intent,
  ): Omit<RouterOutput, "intent" | "decisionTrace"> {
    if (!intent.taskId) {
      throw new Error("Task ID required for wait operation");
    }

    const isCloud = intent.taskId.startsWith("T-cloud-");
    const primitive = isCloud ? "_codex_cloud_wait" : "_codex_local_wait";
    this.addTrace(`Routing to ${primitive}`);

    return {
      primitive,
      parameters: {
        task_id: intent.taskId,
        timeout_sec: 300, // Default 5 minutes
      },
      taskId: intent.taskId,
    };
  }

  /**
   * Route cancel intent
   */
  private routeCancel(
    intent: Intent,
  ): Omit<RouterOutput, "intent" | "decisionTrace"> {
    if (!intent.taskId) {
      throw new Error("Task ID required for cancel operation");
    }

    const isCloud = intent.taskId.startsWith("T-cloud-");
    const primitive = isCloud ? "_codex_cloud_cancel" : "_codex_local_cancel";
    this.addTrace(`Routing to ${primitive}`);

    return {
      primitive,
      parameters: {
        task_id: intent.taskId,
      },
      taskId: intent.taskId,
    };
  }

  /**
   * Route fetch results intent
   */
  private routeFetch(
    intent: Intent,
  ): Omit<RouterOutput, "intent" | "decisionTrace"> {
    if (!intent.taskId) {
      throw new Error("Task ID required for fetch operation");
    }

    const isCloud = intent.taskId.startsWith("T-cloud-");
    const primitive = isCloud ? "_codex_cloud_results" : "_codex_local_results";
    this.addTrace(`Routing to ${primitive}`);

    return {
      primitive,
      parameters: {
        task_id: intent.taskId,
      },
      taskId: intent.taskId,
    };
  }

  /**
   * Route setup intent
   */
  private routeSetup(
    intent: Intent,
  ): Omit<RouterOutput, "intent" | "decisionTrace"> {
    if (intent.target === "github") {
      this.addTrace("Routing to GitHub setup");
      return {
        primitive: "_codex_cloud_github_setup",
        parameters: {
          // repoUrl and stack must be provided
        },
      };
    }

    this.addTrace("Routing to list environments");
    return {
      primitive: "_codex_cloud_list_environments",
      parameters: {},
    };
  }

  /**
   * Resolve task ID (auto-resolve or disambiguate)
   */
  private async resolveTaskId(
    _intent: Intent,
    workingDir?: string,
  ): Promise<{
    taskId?: string;
    options?: Array<{
      taskId: string;
      label: string;
      status: string;
      age: string;
    }>;
  }> {
    // Get recent tasks (last 10 minutes)
    const recent = this.registry.getRecentTasks(600_000, 10);
    this.addTrace(`Found ${recent.length} recent tasks`);

    if (recent.length === 0) {
      throw new Error(
        "No recent tasks found. Specify task ID or run a task first.",
      );
    }

    // Filter by working directory if provided
    const filtered = workingDir
      ? recent.filter((t) => t.workingDir === workingDir)
      : recent;
    this.addTrace(`Filtered to ${filtered.length} tasks in current directory`);

    if (filtered.length === 1) {
      // Auto-resolve: single recent task
      this.addTrace(`Auto-resolved to single recent task: ${filtered[0].id}`);
      return { taskId: filtered[0].id };
    }

    // Check for single running task
    const running = filtered.filter(
      (t) => t.status === "working" || t.status === "pending",
    );
    if (running.length === 1) {
      // Auto-resolve: single running task
      this.addTrace(`Auto-resolved to single running task: ${running[0].id}`);
      return { taskId: running[0].id };
    }

    // Multiple tasks - return disambiguation options
    this.addTrace("Multiple tasks found, disambiguation needed");
    const options = filtered.slice(0, 3).map((t, i) => ({
      taskId: t.id,
      label: `${i + 1}) ${t.alias || t.id} (${t.status})`,
      status: t.status,
      age: this.formatAge(Date.now() - t.updatedAt),
    }));

    return { options };
  }

  /**
   * Infer execution mode (local vs cloud)
   */
  private inferMode(intent: Intent, input: RouterInput): ExecutionMode {
    // Explicit preference
    if (input.preference?.mode && input.preference.mode !== "auto") {
      return input.preference.mode;
    }

    // Heuristics for mode inference
    const task = intent.task || "";
    const lower = task.toLowerCase();

    // Cloud heuristics
    const cloudKeywords = [
      "full test",
      "integration test",
      "comprehensive",
      "refactor",
      "create pr",
      "pull request",
      "all tests",
      "in the cloud",
      "to cloud",
      "on cloud",
      "with cloud",
      "to the cloud",
      "on the cloud",
    ];

    if (cloudKeywords.some((keyword) => lower.includes(keyword))) {
      return "cloud";
    }

    // Local heuristics (default)
    // - Short tasks
    // - Git repo present
    // - Working directory specified
    if (input.context?.hasGit || input.context?.workingDir) {
      return "local";
    }

    // Default to local for safety
    return "local";
  }

  /**
   * Check if task needs threading (SDK vs CLI)
   */
  private needsThreading(intent: Intent, _input: RouterInput): boolean {
    const task = intent.task || "";
    const lower = task.toLowerCase();

    // Threading heuristics - tasks that benefit from real-time streaming
    const threadingKeywords = [
      "with progress",
      "show progress",
      "real-time",
      "streaming",
      "step by step",
      "review",
      "debug",
      "investigate",
      "explore",
    ];

    return threadingKeywords.some((keyword) => lower.includes(keyword));
  }

  /**
   * Format age in human-readable form
   */
  private formatAge(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  /**
   * Add entry to decision trace
   */
  private addTrace(message: string): void {
    this.trace.push(message);
  }
}

// Factory function to create router with singleton dependencies
export async function createRouter(
  parser?: IntentParser,
  registry?: TaskRegistry,
): Promise<Router> {
  // Dynamic imports for ES modules
  const intentParserModule = await import("./intent_parser.js");
  const taskRegistryModule = await import("../state/task_registry.js");

  return new Router(
    parser || intentParserModule.globalIntentParser,
    registry || taskRegistryModule.globalTaskRegistry,
  );
}
