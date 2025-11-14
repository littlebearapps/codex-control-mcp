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
import { ProgressSummary } from '../executor/progress_inference.js';

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
  progress?: ProgressSummary;
}

export interface CloudTaskFilter {
  workingDir?: string;
  envId?: string;
  status?: CloudTask['status'];
  limit?: number;
  before?: string; // ISO timestamp
  after?: string; // ISO timestamp
}

export class CloudTaskRegistry {
  private storePath: string;
  private tasks: Map<string, CloudTask> = new Map();
  private initialized: boolean = false;

  constructor() {
    // Store in user config directory: ~/.config/codex-control/cloud-tasks.json
    const configDir = path.join(os.homedir(), '.config', 'codex-control');
    this.storePath = path.join(configDir, 'cloud-tasks.json');
  }

  /**
   * Initialize registry by loading from disk
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.storePath);
      await fs.mkdir(configDir, { recursive: true });

      // Load existing tasks if file exists
      try {
        const data = await fs.readFile(this.storePath, 'utf-8');
        const tasksArray: CloudTask[] = JSON.parse(data);

        // Convert array to Map
        this.tasks = new Map(tasksArray.map(task => [task.taskId, task]));

        console.error(`[CloudTaskRegistry] Loaded ${this.tasks.size} tasks from ${this.storePath}`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          console.error('[CloudTaskRegistry] Error loading tasks:', error);
        }
        // File doesn't exist yet - that's okay
      }

      this.initialized = true;
    } catch (error) {
      console.error('[CloudTaskRegistry] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Save tasks to disk
   */
  private async save(): Promise<void> {
    try {
      const tasksArray = Array.from(this.tasks.values());
      await fs.writeFile(
        this.storePath,
        JSON.stringify(tasksArray, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('[CloudTaskRegistry] Failed to save tasks:', error);
      throw error;
    }
  }

  /**
   * Register a new cloud task
   */
  async registerTask(task: Omit<CloudTask, 'timestamp' | 'status'>): Promise<CloudTask> {
    await this.initialize();

    const cloudTask: CloudTask = {
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
  async updateTask(taskId: string, updates: Partial<CloudTask>): Promise<CloudTask | null> {
    await this.initialize();

    const existing = this.tasks.get(taskId);
    if (!existing) {
      return null;
    }

    const updated: CloudTask = {
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
  async updateProgress(taskId: string, progress: ProgressSummary): Promise<CloudTask | null> {
    return this.updateTask(taskId, { progress });
  }

  /**
   * Get a specific task by ID
   */
  async getTask(taskId: string): Promise<CloudTask | null> {
    await this.initialize();
    return this.tasks.get(taskId) || null;
  }

  /**
   * List tasks with optional filters
   */
  async listTasks(filter?: CloudTaskFilter): Promise<CloudTask[]> {
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
  async deleteTask(taskId: string): Promise<boolean> {
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
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byWorkingDir: Record<string, number>;
    oldestTask: string | null;
    newestTask: string | null;
  }> {
    await this.initialize();

    const tasks = Array.from(this.tasks.values());
    const byStatus: Record<string, number> = {};
    const byWorkingDir: Record<string, number> = {};

    for (const task of tasks) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
      byWorkingDir[task.workingDir] = (byWorkingDir[task.workingDir] || 0) + 1;
    }

    const sorted = tasks.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

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
