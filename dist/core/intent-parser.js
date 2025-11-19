/**
 * Intent Parser - Natural Language → Primitive Mapping
 *
 * Maps user's natural language input to the appropriate hidden primitive.
 * Uses keyword-based classification with confidence scoring.
 *
 * v3.0 Feature: Foundation for unified `codex` tool
 */
/**
 * Keyword patterns for each primitive
 */
const PRIMITIVE_PATTERNS = {
    _codex_local_run: {
        keywords: [
            "analyze",
            "check",
            "review",
            "audit",
            "scan",
            "inspect",
            "run",
            "test",
            "run test",
        ],
        contextKeywords: [
            "bug",
            "error",
            "issue",
            "quality",
            "security",
            "performance",
            "local",
            "test suite",
            "suite",
        ],
        confidence: 80,
    },
    _codex_local_status: {
        keywords: [
            "status",
            "running",
            "queue",
            "active",
            "current",
            "what's running",
            "show tasks",
        ],
        contextKeywords: ["local", "now", "currently", "tasks", "active tasks"],
        confidence: 85,
    },
    _codex_local_exec: {
        keywords: ["start", "begin", "execute", "launch", "initiate"],
        contextKeywords: [
            "progress",
            "track",
            "follow",
            "thread",
            "conversation",
            "audit",
            "comprehensive",
            "security",
        ],
        confidence: 75,
    },
    _codex_local_resume: {
        keywords: [
            "continue",
            "resume",
            "proceed",
            "keep going",
            "follow up",
            "keep",
            "keep working",
        ],
        contextKeywords: [
            "previous",
            "last",
            "earlier",
            "thread",
            "working",
            "refactoring",
            "that",
        ],
        confidence: 90,
    },
    _codex_local_results: {
        keywords: [
            "results",
            "output",
            "get results",
            "show results",
            "completed",
            "what completed",
            "show what",
        ],
        contextKeywords: ["local", "task", "completed", "finished", "done"],
        confidence: 85,
    },
    _codex_local_wait: {
        keywords: ["wait", "poll", "monitor", "watch", "track"],
        contextKeywords: ["local", "until", "complete", "finish"],
        confidence: 90,
    },
    _codex_local_cancel: {
        keywords: ["cancel", "stop", "abort", "kill", "terminate"],
        contextKeywords: ["local", "running", "task"],
        confidence: 95,
    },
    _codex_cloud_submit: {
        keywords: [
            "submit",
            "run",
            "execute",
            "background",
            "pr",
            "pull request",
            "create pr",
            "run in background",
            "run background",
        ],
        contextKeywords: [
            "cloud",
            "test suite",
            "refactor",
            "github",
            "remote",
            "tests",
            "passing",
            "if",
        ],
        confidence: 80,
    },
    _codex_cloud_status: {
        keywords: [
            "status",
            "running",
            "queue",
            "active",
            "current",
            "what's running",
            "show tasks",
            "show",
            "cloud tasks",
        ],
        contextKeywords: ["cloud", "remote", "pending", "background", "tasks"],
        confidence: 85,
    },
    _codex_cloud_results: {
        keywords: [
            "results",
            "output",
            "get results",
            "show results",
            "show pr",
            "show me",
            "created",
            "was created",
            "pr that",
        ],
        contextKeywords: [
            "cloud",
            "pr",
            "pull request",
            "completed",
            "finished",
            "remote",
            "that",
            "the",
        ],
        confidence: 85,
    },
    _codex_cloud_wait: {
        keywords: ["wait", "poll", "monitor", "watch", "track"],
        contextKeywords: [
            "cloud",
            "remote",
            "until",
            "complete",
            "finish",
            "pr",
            "background",
        ],
        confidence: 90,
    },
    _codex_cloud_cancel: {
        keywords: ["cancel", "stop", "abort", "kill", "terminate"],
        contextKeywords: ["cloud", "remote", "running", "task", "background"],
        confidence: 95,
    },
    _codex_cloud_list_environments: {
        keywords: [
            "list environments",
            "show environments",
            "environments",
            "envs",
        ],
        contextKeywords: ["cloud", "available", "configured"],
        confidence: 90,
    },
    _codex_cloud_github_setup: {
        keywords: [
            "setup github",
            "set up github",
            "github integration",
            "configure github",
            "github guide",
            "github setup",
        ],
        contextKeywords: [
            "github",
            "setup",
            "integration",
            "token",
            "repo",
            "repository",
        ],
        confidence: 95,
    },
};
/**
 * Intent Parser Engine
 */
export class IntentParser {
    /**
     * Parse natural language input to identify the intended primitive
     */
    parse(input) {
        // Validate input
        if (!input || input.trim().length === 0) {
            return {
                intent: null,
                alternatives: [],
                requiresDisambiguation: false,
                error: "Empty input",
            };
        }
        const normalizedInput = input.toLowerCase().trim();
        // Score all primitives
        const scores = [];
        for (const [primitive, pattern] of Object.entries(PRIMITIVE_PATTERNS)) {
            const score = this.scorePrimitive(normalizedInput, pattern, primitive);
            if (score > 0) {
                scores.push({
                    primitive,
                    confidence: score,
                    extractedParams: this.extractParameters(normalizedInput, primitive),
                    reasoning: this.generateReasoning(normalizedInput, primitive, pattern),
                });
            }
        }
        // Sort by confidence (descending)
        scores.sort((a, b) => b.confidence - a.confidence);
        // Determine if disambiguation is needed
        const topScore = scores[0]?.confidence || 0;
        const secondScore = scores[1]?.confidence || 0;
        // Skip disambiguation if:
        // 1. Top score is very confident (≥70%), OR
        // 2. Score gap is large enough (≥20 points)
        const requiresDisambiguation = topScore > 0 &&
            secondScore > 0 &&
            topScore < 70 &&
            topScore - secondScore < 20;
        // Minimum confidence threshold
        const MIN_CONFIDENCE = 30;
        const intent = topScore >= MIN_CONFIDENCE ? scores[0] : null;
        return {
            intent,
            alternatives: scores.slice(1, 4), // Top 3 alternatives
            requiresDisambiguation,
            error: intent ? undefined : "No confident match found",
        };
    }
    /**
     * Score how well a primitive matches the input
     */
    scorePrimitive(input, pattern, primitiveN) {
        let score = 0;
        // Check primary keywords
        for (const keyword of pattern.keywords) {
            if (input.includes(keyword)) {
                score += 50; // Primary keyword match
                break; // Only count first match
            }
        }
        // Check context keywords (bonus points)
        for (const contextKeyword of pattern.contextKeywords) {
            if (input.includes(contextKeyword)) {
                score += 20; // Context boost
            }
        }
        // Strong disambiguation hints (boost score significantly)
        const isLocalPrimitive = primitiveN.includes("_local_");
        const isCloudPrimitive = primitiveN.includes("_cloud_");
        // Task ID format hints (strong signal for disambiguation)
        // Note: input is already normalized to lowercase
        const hasLocalTaskId = input.includes("t-local-");
        const hasCloudTaskId = input.includes("t-cloud-");
        if (hasLocalTaskId) {
            if (isLocalPrimitive)
                score += 40; // Strong boost for local primitive
            if (isCloudPrimitive)
                score -= 30; // Strong penalty for cloud primitive
        }
        if (hasCloudTaskId) {
            if (isCloudPrimitive)
                score += 40; // Strong boost for cloud primitive
            if (isLocalPrimitive)
                score -= 30; // Strong penalty for local primitive
        }
        // Explicit cloud/local context hints
        const hasExplicitCloud = input.includes("in the cloud") ||
            input.includes("in cloud") ||
            input.includes("on cloud");
        const hasExplicitLocal = input.includes("locally") ||
            input.includes("on local") ||
            input.includes("in local");
        if (hasExplicitCloud) {
            if (isCloudPrimitive)
                score += 25; // Boost cloud primitives when "in the cloud" mentioned
            if (isLocalPrimitive)
                score -= 20; // Penalty for local primitives
        }
        if (hasExplicitLocal) {
            if (isLocalPrimitive)
                score += 25; // Boost local primitives when "locally" mentioned
            if (isCloudPrimitive)
                score -= 20; // Penalty for cloud primitives
        }
        // Apply base confidence modifier
        if (score > 0) {
            score = Math.min(100, score * (pattern.confidence / 100));
        }
        return Math.round(score);
    }
    /**
     * Extract parameters from natural language
     */
    extractParameters(input, primitive) {
        const params = {};
        // Extract task ID if present (T-local-xxx or T-cloud-xxx)
        const taskIdMatch = input.match(/T-(local|cloud)-[a-z0-9]+/i);
        if (taskIdMatch) {
            params.task_id = taskIdMatch[0];
        }
        // Extract thread ID if present
        const threadIdMatch = input.match(/thread[_-]?([a-z0-9-]+)/i);
        if (threadIdMatch) {
            params.threadId = threadIdMatch[1];
        }
        // Extract GitHub repo URL
        const repoMatch = input.match(/https:\/\/github\.com\/[\w-]+\/[\w-]+/);
        if (repoMatch) {
            params.repoUrl = repoMatch[0];
        }
        // Extract environment ID
        const envIdMatch = input.match(/env[_-]?([a-z0-9-]+)/i);
        if (envIdMatch) {
            params.envId = envIdMatch[0];
        }
        // For execution primitives, extract task description
        if (primitive.includes("run") ||
            primitive.includes("exec") ||
            primitive.includes("submit")) {
            // Everything except extracted IDs is the task
            let task = input;
            // Remove extracted IDs from task description
            if (params.task_id) {
                task = task.replace(params.task_id, "").trim();
            }
            // Clean up common prefixes
            task = task
                .replace(/^(please |can you |would you |could you )/i, "")
                .trim();
            if (task.length > 0) {
                params.task = task;
            }
        }
        return params;
    }
    /**
     * Generate reasoning for why a primitive was selected
     */
    generateReasoning(input, primitive, pattern) {
        const matchedKeywords = pattern.keywords.filter((kw) => input.includes(kw));
        const matchedContext = pattern.contextKeywords.filter((kw) => input.includes(kw));
        let reasoning = `Matched "${primitive}" because input contains: `;
        if (matchedKeywords.length > 0) {
            reasoning += `keywords [${matchedKeywords.join(", ")}]`;
        }
        if (matchedContext.length > 0) {
            reasoning += ` and context [${matchedContext.join(", ")}]`;
        }
        return reasoning;
    }
    /**
     * Suggest clarifying questions for disambiguation
     */
    suggestClarification(result) {
        if (!result.requiresDisambiguation) {
            return "";
        }
        const top = result.intent;
        const alt = result.alternatives[0];
        if (!top || !alt) {
            return "";
        }
        // Check if it's local vs cloud ambiguity
        if (top.primitive.includes("local") && alt.primitive.includes("cloud")) {
            return "Would you like to run this locally (faster, on your machine) or in the cloud (background, for long tasks)?";
        }
        if (top.primitive.includes("cloud") && alt.primitive.includes("local")) {
            return "Would you like to run this locally (faster, on your machine) or in the cloud (background, for long tasks)?";
        }
        // Check if it's status vs results ambiguity
        if ((top.primitive.includes("status") && alt.primitive.includes("results")) ||
            (top.primitive.includes("results") && alt.primitive.includes("status"))) {
            return "Would you like to check the status (is it still running?) or get the results (what did it produce)?";
        }
        // Generic disambiguation
        return `Did you mean "${top.primitive}" or "${alt.primitive}"? Please clarify.`;
    }
}
// Singleton instance
export const globalIntentParser = new IntentParser();
//# sourceMappingURL=intent-parser.js.map