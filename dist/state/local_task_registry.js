/**
 * Local Task Registry
 *
 * Tracks async CLI/SDK tasks for status checking and result retrieval.
 * Similar to CloudTaskRegistry but for local execution.
 */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
export class LocalTaskRegistry {
  registryPath;
  tasks = new Map();
  taskPromises = new Map();
  constructor() {
    // Store in ~/.config/codex-control/local-tasks.json
    const configDir = path.join(os.homedir(), ".config", "codex-control");
    this.registryPath = path.join(configDir, "local-tasks.json");
    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    // Load existing tasks
    this.load();
  }
  /**
   * Register a new async task
   */
  registerTask(taskId, task, promise, options = {}) {
    const localTask = {
      taskId,
      task,
      mode: options.mode,
      model: options.model,
      workingDir: options.workingDir || process.cwd(),
      submittedAt: new Date().toISOString(),
      status: "running",
    };
    this.tasks.set(taskId, localTask);
    this.taskPromises.set(taskId, promise);
    // When promise resolves, update status
    promise
      .then((result) => {
        const task = this.tasks.get(taskId);
        if (task) {
          task.status = result.success ? "completed" : "failed";
          task.result = result;
          this.save();
        }
      })
      .catch((error) => {
        const task = this.tasks.get(taskId);
        if (task) {
          task.status = "failed";
          task.error = error instanceof Error ? error.message : String(error);
          this.save();
        }
      });
    this.save();
  }
  /**
   * Get task status
   */
  getTask(taskId) {
    return this.tasks.get(taskId);
  }
  /**
   * Get all tasks (optionally filter by working directory)
   */
  getAllTasks(workingDir) {
    const allTasks = Array.from(this.tasks.values());
    if (workingDir) {
      return allTasks.filter((t) => t.workingDir === workingDir);
    }
    return allTasks;
  }
  /**
   * Get running tasks
   */
  getRunningTasks(workingDir) {
    return this.getAllTasks(workingDir).filter((t) => t.status === "running");
  }
  /**
   * Check if task is still running
   */
  isRunning(taskId) {
    const task = this.tasks.get(taskId);
    return task?.status === "running";
  }
  /**
   * Get task result (if completed)
   */
  getResult(taskId) {
    const task = this.tasks.get(taskId);
    return task?.result;
  }
  /**
   * Update progress for a running task
   */
  updateProgress(taskId, progress) {
    const task = this.tasks.get(taskId);
    if (task && task.status === "running") {
      task.progress = progress;
      this.save();
    }
  }
  /**
   * Clear completed tasks older than specified age (default: 24 hours)
   */
  clearOldTasks(maxAgeMs = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const tasksToRemove = [];
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status !== "running") {
        const submittedAt = new Date(task.submittedAt).getTime();
        if (now - submittedAt > maxAgeMs) {
          tasksToRemove.push(taskId);
        }
      }
    }
    for (const taskId of tasksToRemove) {
      this.tasks.delete(taskId);
      this.taskPromises.delete(taskId);
    }
    if (tasksToRemove.length > 0) {
      this.save();
    }
  }
  /**
   * Load tasks from disk
   */
  load() {
    try {
      if (fs.existsSync(this.registryPath)) {
        const data = fs.readFileSync(this.registryPath, "utf-8");
        const parsed = JSON.parse(data);
        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          for (const task of parsed.tasks) {
            // Only load non-running tasks (running tasks are lost on restart)
            if (task.status !== "running") {
              this.tasks.set(task.taskId, task);
            }
          }
        }
      }
    } catch (error) {
      // Ignore load errors - start with empty registry
      console.error("[LocalTaskRegistry] Failed to load tasks:", error);
    }
  }
  /**
   * Save tasks to disk
   */
  save() {
    try {
      const data = {
        tasks: Array.from(this.tasks.values()),
        lastUpdated: new Date().toISOString(),
      };
      fs.writeFileSync(this.registryPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("[LocalTaskRegistry] Failed to save tasks:", error);
    }
  }
}
// Singleton instance
export const localTaskRegistry = new LocalTaskRegistry();
//# sourceMappingURL=local_task_registry.js.map
