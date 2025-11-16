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
import { ProgressUpdate, TimeoutWarning, TimeoutError, PartialResults } from './timeout_watchdog.js';
export interface CodexProcessOptions {
    task: string;
    mode?: 'read-only' | 'workspace-write' | 'danger-full-access';
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
    idleTimeoutMs?: number;
    hardTimeoutMs?: number;
    onProgress?: (progress: ProgressUpdate) => void;
    onWarning?: (warning: TimeoutWarning) => void;
    onTimeout?: (timeout: TimeoutError) => void;
}
export interface CodexProcessResult {
    success: boolean;
    events: CodexEvent[];
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    error?: Error;
    timeout?: TimeoutError;
    partial?: PartialResults;
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
    /**
     * Show iTerm2 badge (visible in terminal)
     * Uses escape sequences to set badge text
     * Writes directly to /dev/tty to bypass stdio redirection
     */
    private setITermBadge;
    /**
     * Clear iTerm2 badge
     */
    private clearITermBadge;
}
//# sourceMappingURL=process_manager.d.ts.map