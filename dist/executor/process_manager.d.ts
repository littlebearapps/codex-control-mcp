/**
 * Process Manager for Codex CLI
 *
 * Spawns and manages `codex exec` processes with:
 * - Safe spawning (no shell injection)
 * - Concurrency control (max 2-4 parallel)
 * - Event stream parsing
 * - Error handling and cleanup
 */
import { CodexEvent } from './jsonl_parser.js';
export interface CodexProcessOptions {
    task: string;
    mode?: 'read-only' | 'full-auto' | 'danger-full-access';
    outputSchema?: any;
    model?: string;
    workingDir?: string;
    /**
     * Environment variable policy for Codex Cloud execution
     * - 'inherit-none': No environment variables (default, most secure)
     * - 'inherit-all': All environment variables (convenient, less secure)
     * - 'allow-list': Only specified variables (recommended)
     */
    envPolicy?: 'inherit-all' | 'inherit-none' | 'allow-list';
    /**
     * Allowed environment variables (only used with envPolicy='allow-list')
     * Example: ['OPENAI_API_KEY', 'DATABASE_URL']
     */
    envAllowList?: string[];
}
export interface CodexProcessResult {
    success: boolean;
    events: CodexEvent[];
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    error?: Error;
}
export declare class ProcessQueue {
    private queue;
    private running;
    private maxConcurrency;
    constructor(maxConcurrency?: number);
    add<T>(task: () => Promise<T>): Promise<T>;
    private processNext;
    getStats(): {
        running: number;
        queued: number;
        maxConcurrency: number;
    };
}
export declare class ProcessManager {
    private processes;
    private queue;
    constructor(maxConcurrency?: number);
    /**
     * Execute a Codex task
     * Returns promise that resolves when process completes
     */
    execute(options: CodexProcessOptions): Promise<CodexProcessResult>;
    /**
     * Internal: Run a single Codex process
     */
    private runProcess;
    /**
     * Kill all running processes (cleanup on shutdown)
     */
    killAll(): void;
    /**
     * Get stats about active processes
     */
    getStats(): {
        running: number;
        queued: number;
        maxConcurrency: number;
        activeProcesses: number;
    };
}
//# sourceMappingURL=process_manager.d.ts.map