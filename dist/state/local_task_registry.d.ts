/**
 * Local Task Registry
 *
 * Tracks async CLI/SDK tasks for status checking and result retrieval.
 * Similar to CloudTaskRegistry but for local execution.
 */
import { CodexProcessResult } from '../executor/process_manager.js';
export interface LocalTask {
    taskId: string;
    task: string;
    mode?: string;
    model?: string;
    workingDir?: string;
    submittedAt: string;
    status: 'running' | 'completed' | 'failed';
    result?: CodexProcessResult;
    error?: string;
}
export declare class LocalTaskRegistry {
    private registryPath;
    private tasks;
    private taskPromises;
    constructor();
    /**
     * Register a new async task
     */
    registerTask(taskId: string, task: string, promise: Promise<CodexProcessResult>, options?: {
        mode?: string;
        model?: string;
        workingDir?: string;
    }): void;
    /**
     * Get task status
     */
    getTask(taskId: string): LocalTask | undefined;
    /**
     * Get all tasks (optionally filter by working directory)
     */
    getAllTasks(workingDir?: string): LocalTask[];
    /**
     * Get running tasks
     */
    getRunningTasks(workingDir?: string): LocalTask[];
    /**
     * Check if task is still running
     */
    isRunning(taskId: string): boolean;
    /**
     * Get task result (if completed)
     */
    getResult(taskId: string): CodexProcessResult | undefined;
    /**
     * Clear completed tasks older than specified age (default: 24 hours)
     */
    clearOldTasks(maxAgeMs?: number): void;
    /**
     * Load tasks from disk
     */
    private load;
    /**
     * Save tasks to disk
     */
    private save;
}
export declare const localTaskRegistry: LocalTaskRegistry;
//# sourceMappingURL=local_task_registry.d.ts.map