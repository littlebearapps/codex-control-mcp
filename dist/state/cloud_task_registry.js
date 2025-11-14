/**
 * Cloud Task Registry - Persistent Storage for Codex Cloud Tasks
 *
 * Provides automatic task ID persistence across Claude Code sessions.
 * Enables multi-instance tracking by filtering tasks per working directory.
 * Survives Claude Code restarts by storing to filesystem.
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
export class CloudTaskRegistry {
    storePath;
    tasks = new Map();
    initialized = false;
    constructor() {
        // Store in user config directory: ~/.config/codex-control/cloud-tasks.json
        const configDir = path.join(os.homedir(), '.config', 'codex-control');
        this.storePath = path.join(configDir, 'cloud-tasks.json');
    }
    /**
     * Initialize registry by loading from disk
     */
    async initialize() {
        if (this.initialized)
            return;
        try {
            // Ensure config directory exists
            const configDir = path.dirname(this.storePath);
            await fs.mkdir(configDir, { recursive: true });
            // Load existing tasks if file exists
            try {
                const data = await fs.readFile(this.storePath, 'utf-8');
                const tasksArray = JSON.parse(data);
                // Convert array to Map
                this.tasks = new Map(tasksArray.map(task => [task.taskId, task]));
                console.error(`[CloudTaskRegistry] Loaded ${this.tasks.size} tasks from ${this.storePath}`);
            }
            catch (error) {
                if (error.code !== 'ENOENT') {
                    console.error('[CloudTaskRegistry] Error loading tasks:', error);
                }
                // File doesn't exist yet - that's okay
            }
            this.initialized = true;
        }
        catch (error) {
            console.error('[CloudTaskRegistry] Failed to initialize:', error);
            throw error;
        }
    }
    /**
     * Save tasks to disk
     */
    async save() {
        try {
            const tasksArray = Array.from(this.tasks.values());
            await fs.writeFile(this.storePath, JSON.stringify(tasksArray, null, 2), 'utf-8');
        }
        catch (error) {
            console.error('[CloudTaskRegistry] Failed to save tasks:', error);
            throw error;
        }
    }
    /**
     * Register a new cloud task
     */
    async registerTask(task) {
        await this.initialize();
        const cloudTask = {
            ...task,
            timestamp: new Date().toISOString(),
            status: 'submitted',
        };
        this.tasks.set(cloudTask.taskId, cloudTask);
        await this.save();
        console.error(`[CloudTaskRegistry] Registered task ${cloudTask.taskId}`);
        return cloudTask;
    }
    /**
     * Update an existing task
     */
    async updateTask(taskId, updates) {
        await this.initialize();
        const existing = this.tasks.get(taskId);
        if (!existing) {
            return null;
        }
        const updated = {
            ...existing,
            ...updates,
            taskId, // Prevent taskId from being changed
        };
        this.tasks.set(taskId, updated);
        await this.save();
        console.error(`[CloudTaskRegistry] Updated task ${taskId}`);
        return updated;
    }
    /**
     * Update progress for a task
     */
    async updateProgress(taskId, progress) {
        return this.updateTask(taskId, { progress });
    }
    /**
     * Get a specific task by ID
     */
    async getTask(taskId) {
        await this.initialize();
        return this.tasks.get(taskId) || null;
    }
    /**
     * List tasks with optional filters
     */
    async listTasks(filter) {
        await this.initialize();
        let results = Array.from(this.tasks.values());
        // Apply filters
        if (filter) {
            if (filter.workingDir) {
                results = results.filter(task => task.workingDir === filter.workingDir);
            }
            if (filter.envId) {
                results = results.filter(task => task.envId === filter.envId);
            }
            if (filter.status) {
                results = results.filter(task => task.status === filter.status);
            }
            if (filter.after) {
                const afterDate = new Date(filter.after);
                results = results.filter(task => new Date(task.timestamp) >= afterDate);
            }
            if (filter.before) {
                const beforeDate = new Date(filter.before);
                results = results.filter(task => new Date(task.timestamp) <= beforeDate);
            }
        }
        // Sort by timestamp descending (newest first)
        results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        // Apply limit
        if (filter?.limit) {
            results = results.slice(0, filter.limit);
        }
        return results;
    }
    /**
     * Delete a task
     */
    async deleteTask(taskId) {
        await this.initialize();
        const existed = this.tasks.delete(taskId);
        if (existed) {
            await this.save();
            console.error(`[CloudTaskRegistry] Deleted task ${taskId}`);
        }
        return existed;
    }
    /**
     * Get statistics about stored tasks
     */
    async getStats() {
        await this.initialize();
        const tasks = Array.from(this.tasks.values());
        const byStatus = {};
        const byWorkingDir = {};
        for (const task of tasks) {
            byStatus[task.status] = (byStatus[task.status] || 0) + 1;
            byWorkingDir[task.workingDir] = (byWorkingDir[task.workingDir] || 0) + 1;
        }
        const sorted = tasks.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return {
            total: tasks.length,
            byStatus,
            byWorkingDir,
            oldestTask: sorted[0]?.timestamp || null,
            newestTask: sorted[sorted.length - 1]?.timestamp || null,
        };
    }
}
// Export singleton instance
export const globalTaskRegistry = new CloudTaskRegistry();
//# sourceMappingURL=cloud_task_registry.js.map