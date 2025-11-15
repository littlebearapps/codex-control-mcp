/**
 * Unified Task Registry (SQLite-based)
 *
 * Enhanced task tracking for v3.0 with:
 * - Unified local + cloud task storage
 * - Granular progress tracking
 * - SEP-1391 alignment (state terminology, polling guidance, TTL)
 * - Support for disambiguation and auto-resolution
 */
import { ProgressSummary } from '../executor/progress_inference.js';
/**
 * Task origin (local or cloud)
 */
export type TaskOrigin = 'local' | 'cloud';
/**
 * Task status (SEP-1391 aligned + git verification statuses)
 */
export type TaskStatus = 'pending' | 'working' | 'completed' | 'completed_with_warnings' | 'completed_with_errors' | 'failed' | 'canceled' | 'unknown';
/**
 * Unified task record
 */
export interface Task {
    id: string;
    externalId?: string;
    alias?: string;
    origin: TaskOrigin;
    status: TaskStatus;
    instruction: string;
    workingDir?: string;
    envId?: string;
    mode?: string;
    model?: string;
    createdAt: number;
    updatedAt: number;
    completedAt?: number;
    lastEventAt?: number;
    progressSteps?: string;
    pollFrequencyMs?: number;
    keepAliveUntil?: number;
    threadId?: string;
    userId?: string;
    result?: string;
    error?: string;
    metadata?: string;
}
/**
 * Filter options for querying tasks
 */
export interface TaskFilter {
    origin?: TaskOrigin;
    status?: TaskStatus;
    workingDir?: string;
    envId?: string;
    threadId?: string;
    userId?: string;
    createdAfter?: number;
    createdBefore?: number;
    limit?: number;
    offset?: number;
}
/**
 * Unified Task Registry using SQLite
 */
export declare class TaskRegistry {
    private db;
    private dbPath;
    constructor(dbPath?: string);
    /**
     * Check and perform schema migrations
     */
    private migrateSchema;
    /**
     * Restore data from backup table after schema migration
     */
    private restoreFromBackup;
    /**
     * Initialize database schema
     */
    private initializeSchema;
    /**
     * Generate a unique task ID
     */
    private generateTaskId;
    /**
     * Register a new task
     */
    registerTask(params: {
        origin: TaskOrigin;
        instruction: string;
        workingDir?: string;
        envId?: string;
        mode?: string;
        model?: string;
        threadId?: string;
        userId?: string;
        alias?: string;
        externalId?: string;
        metadata?: Record<string, any>;
    }): Task;
    /**
     * Update task status
     */
    updateStatus(taskId: string, status: TaskStatus): Task | null;
    /**
     * Update task progress (from JSONL event stream)
     */
    updateProgress(taskId: string, progress: ProgressSummary): Task | null;
    /**
     * Update task with arbitrary fields
     */
    updateTask(taskId: string, updates: Partial<Task>): Task | null;
    /**
     * Get a specific task by ID
     */
    getTask(taskId: string): Task | null;
    /**
     * Get recent tasks (for disambiguation)
     */
    getRecentTasks(maxAgeMs?: number, limit?: number): Task[];
    /**
     * Get running tasks (for auto-resolution)
     */
    getRunningTasks(workingDir?: string): Task[];
    /**
     * Query tasks with filters
     */
    queryTasks(filter?: TaskFilter): Task[];
    /**
     * Delete a task
     */
    deleteTask(taskId: string): boolean;
    /**
     * Clean up old completed tasks
     */
    cleanupOldTasks(maxAgeMs?: number): number;
    /**
     * Get statistics about tasks
     */
    getStats(): {
        total: number;
        byStatus: Record<TaskStatus, number>;
        byOrigin: Record<TaskOrigin, number>;
        running: number;
    };
    /**
     * Convert database row to Task object
     */
    private rowToTask;
    /**
     * Close database connection
     */
    close(): void;
}
export declare const globalTaskRegistry: TaskRegistry;
//# sourceMappingURL=task_registry.d.ts.map