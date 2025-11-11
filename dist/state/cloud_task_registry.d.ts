/**
 * Cloud Task Registry - Persistent Storage for Codex Cloud Tasks
 *
 * Provides automatic task ID persistence across Claude Code sessions.
 * Enables multi-instance tracking by filtering tasks per working directory.
 * Survives Claude Code restarts by storing to filesystem.
 */
export interface CloudTask {
    taskId: string;
    workingDir: string;
    envId: string;
    task: string;
    model?: string;
    attempts?: number;
    timestamp: string;
    status: 'submitted' | 'completed' | 'failed' | 'cancelled';
    lastCheckedStatus?: string;
    notes?: string;
}
export interface CloudTaskFilter {
    workingDir?: string;
    envId?: string;
    status?: CloudTask['status'];
    limit?: number;
    before?: string;
    after?: string;
}
export declare class CloudTaskRegistry {
    private storePath;
    private tasks;
    private initialized;
    constructor();
    /**
     * Initialize registry by loading from disk
     */
    initialize(): Promise<void>;
    /**
     * Save tasks to disk
     */
    private save;
    /**
     * Register a new cloud task
     */
    registerTask(task: Omit<CloudTask, 'timestamp' | 'status'>): Promise<CloudTask>;
    /**
     * Update an existing task
     */
    updateTask(taskId: string, updates: Partial<CloudTask>): Promise<CloudTask | null>;
    /**
     * Get a specific task by ID
     */
    getTask(taskId: string): Promise<CloudTask | null>;
    /**
     * List tasks with optional filters
     */
    listTasks(filter?: CloudTaskFilter): Promise<CloudTask[]>;
    /**
     * Delete a task
     */
    deleteTask(taskId: string): Promise<boolean>;
    /**
     * Get statistics about stored tasks
     */
    getStats(): Promise<{
        total: number;
        byStatus: Record<string, number>;
        byWorkingDir: Record<string, number>;
        oldestTask: string | null;
        newestTask: string | null;
    }>;
}
export declare const globalTaskRegistry: CloudTaskRegistry;
//# sourceMappingURL=cloud_task_registry.d.ts.map