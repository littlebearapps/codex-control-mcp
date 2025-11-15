/**
 * Unified Task Registry (SQLite-based)
 *
 * Enhanced task tracking for v3.0 with:
 * - Unified local + cloud task storage
 * - Granular progress tracking
 * - SEP-1391 alignment (state terminology, polling guidance, TTL)
 * - Support for disambiguation and auto-resolution
 */
import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
/**
 * Unified Task Registry using SQLite
 */
export class TaskRegistry {
    db;
    dbPath;
    constructor(dbPath) {
        // Default: ~/.config/codex-control/tasks.db
        const configDir = path.join(os.homedir(), '.config', 'codex-control');
        this.dbPath = dbPath || path.join(configDir, 'tasks.db');
        // Ensure config directory exists
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        // Initialize database
        this.db = new Database(this.dbPath);
        this.initializeSchema();
    }
    /**
     * Check and perform schema migrations
     */
    migrateSchema() {
        // Get current schema version
        const versionResult = this.db.prepare(`
      SELECT sql FROM sqlite_master
      WHERE type='table' AND name='tasks'
    `).get();
        if (!versionResult || !versionResult.sql) {
            // Table doesn't exist yet, no migration needed
            return;
        }
        const currentSchema = versionResult.sql;
        // Check if schema has old constraint (missing completed_with_warnings/completed_with_errors)
        const hasOldConstraint = currentSchema.includes("CHECK(status IN ('pending', 'working', 'completed', 'failed', 'canceled', 'unknown'))") ||
            !currentSchema.includes('completed_with_warnings');
        if (hasOldConstraint) {
            console.error('[TaskRegistry] Migrating database schema to add new status values...');
            // Create backup table
            this.db.exec('DROP TABLE IF EXISTS tasks_backup');
            this.db.exec('CREATE TABLE tasks_backup AS SELECT * FROM tasks');
            // Drop old table
            this.db.exec('DROP TABLE tasks');
            // Table will be recreated with new schema in initializeSchema()
            console.error('[TaskRegistry] Schema migration complete. Old data backed up to tasks_backup table.');
        }
    }
    /**
     * Restore data from backup table after schema migration
     */
    restoreFromBackup() {
        // Check if backup table exists
        const backupExists = this.db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='tasks_backup'
    `).get();
        if (!backupExists) {
            return;
        }
        console.error('[TaskRegistry] Restoring data from backup...');
        // Copy data from backup to new table
        this.db.exec(`
      INSERT INTO tasks SELECT * FROM tasks_backup
    `);
        // Drop backup table
        this.db.exec('DROP TABLE tasks_backup');
        console.error('[TaskRegistry] Data restoration complete.');
    }
    /**
     * Initialize database schema
     */
    initializeSchema() {
        // Check for schema migrations before creating table
        this.migrateSchema();
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        external_id TEXT,
        alias TEXT,
        origin TEXT NOT NULL CHECK(origin IN ('local', 'cloud')),
        status TEXT NOT NULL CHECK(status IN ('pending', 'working', 'completed', 'completed_with_warnings', 'completed_with_errors', 'failed', 'canceled', 'unknown')),
        instruction TEXT NOT NULL,

        working_dir TEXT,
        env_id TEXT,
        mode TEXT,
        model TEXT,

        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER,
        last_event_at INTEGER,

        progress_steps TEXT,
        poll_frequency_ms INTEGER,
        keep_alive_until INTEGER,

        thread_id TEXT,
        user_id TEXT,

        result TEXT,
        error TEXT,

        metadata TEXT
      );

      -- Index for common queries
      CREATE INDEX IF NOT EXISTS idx_status_updated ON tasks(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_origin_status ON tasks(origin, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_working_dir ON tasks(working_dir, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_thread ON tasks(user_id, thread_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_created_at ON tasks(created_at DESC);
    `);
        // Restore data from backup if migration occurred
        this.restoreFromBackup();
    }
    /**
     * Generate a unique task ID
     */
    generateTaskId(origin) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `T-${origin}-${timestamp}${random}`;
    }
    /**
     * Register a new task
     */
    registerTask(params) {
        const now = Date.now();
        const taskId = this.generateTaskId(params.origin);
        const task = {
            id: taskId,
            externalId: params.externalId,
            alias: params.alias,
            origin: params.origin,
            status: 'pending',
            instruction: params.instruction,
            workingDir: params.workingDir || process.cwd(),
            envId: params.envId,
            mode: params.mode,
            model: params.model,
            createdAt: now,
            updatedAt: now,
            threadId: params.threadId,
            userId: params.userId,
            metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
        };
        const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, external_id, alias, origin, status, instruction,
        working_dir, env_id, mode, model,
        created_at, updated_at,
        thread_id, user_id, metadata
      ) VALUES (
        @id, @externalId, @alias, @origin, @status, @instruction,
        @workingDir, @envId, @mode, @model,
        @createdAt, @updatedAt,
        @threadId, @userId, @metadata
      )
    `);
        stmt.run(task);
        return task;
    }
    /**
     * Update task status
     */
    updateStatus(taskId, status) {
        const now = Date.now();
        const updates = {
            status,
            updatedAt: now,
        };
        if (status === 'completed' || status === 'completed_with_warnings' || status === 'completed_with_errors' || status === 'failed' || status === 'canceled') {
            updates.completedAt = now;
        }
        return this.updateTask(taskId, updates);
    }
    /**
     * Update task progress (from JSONL event stream)
     */
    updateProgress(taskId, progress) {
        return this.updateTask(taskId, {
            progressSteps: JSON.stringify(progress),
            updatedAt: Date.now(),
            lastEventAt: Date.now(),
        });
    }
    /**
     * Update task with arbitrary fields
     */
    updateTask(taskId, updates) {
        const task = this.getTask(taskId);
        if (!task)
            return null;
        const updatedTask = { ...task, ...updates, updatedAt: Date.now() };
        const stmt = this.db.prepare(`
      UPDATE tasks SET
        external_id = @externalId,
        alias = @alias,
        status = @status,
        working_dir = @workingDir,
        env_id = @envId,
        mode = @mode,
        model = @model,
        updated_at = @updatedAt,
        completed_at = @completedAt,
        last_event_at = @lastEventAt,
        progress_steps = @progressSteps,
        poll_frequency_ms = @pollFrequencyMs,
        keep_alive_until = @keepAliveUntil,
        thread_id = @threadId,
        user_id = @userId,
        result = @result,
        error = @error,
        metadata = @metadata
      WHERE id = @id
    `);
        stmt.run(updatedTask);
        return updatedTask;
    }
    /**
     * Get a specific task by ID
     */
    getTask(taskId) {
        const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
        const row = stmt.get(taskId);
        return row ? this.rowToTask(row) : null;
    }
    /**
     * Get recent tasks (for disambiguation)
     */
    getRecentTasks(maxAgeMs = 600_000, limit = 10) {
        const cutoff = Date.now() - maxAgeMs;
        const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE created_at >= ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
        const rows = stmt.all(cutoff, limit);
        return rows.map(row => this.rowToTask(row));
    }
    /**
     * Get running tasks (for auto-resolution)
     */
    getRunningTasks(workingDir) {
        let stmt;
        let rows;
        if (workingDir) {
            stmt = this.db.prepare(`
        SELECT * FROM tasks
        WHERE status IN ('pending', 'working')
          AND working_dir = ?
        ORDER BY updated_at DESC
      `);
            rows = stmt.all(workingDir);
        }
        else {
            stmt = this.db.prepare(`
        SELECT * FROM tasks
        WHERE status IN ('pending', 'working')
        ORDER BY updated_at DESC
      `);
            rows = stmt.all();
        }
        return rows.map(row => this.rowToTask(row));
    }
    /**
     * Query tasks with filters
     */
    queryTasks(filter = {}) {
        let query = 'SELECT * FROM tasks WHERE 1=1';
        const params = [];
        if (filter.origin) {
            query += ' AND origin = ?';
            params.push(filter.origin);
        }
        if (filter.status) {
            query += ' AND status = ?';
            params.push(filter.status);
        }
        if (filter.workingDir) {
            query += ' AND working_dir = ?';
            params.push(filter.workingDir);
        }
        if (filter.envId) {
            query += ' AND env_id = ?';
            params.push(filter.envId);
        }
        if (filter.threadId) {
            query += ' AND thread_id = ?';
            params.push(filter.threadId);
        }
        if (filter.userId) {
            query += ' AND user_id = ?';
            params.push(filter.userId);
        }
        if (filter.createdAfter) {
            query += ' AND created_at >= ?';
            params.push(filter.createdAfter);
        }
        if (filter.createdBefore) {
            query += ' AND created_at <= ?';
            params.push(filter.createdBefore);
        }
        query += ' ORDER BY created_at DESC';
        if (filter.limit) {
            query += ' LIMIT ?';
            params.push(filter.limit);
        }
        if (filter.offset) {
            query += ' OFFSET ?';
            params.push(filter.offset);
        }
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params);
        return rows.map(row => this.rowToTask(row));
    }
    /**
     * Delete a task
     */
    deleteTask(taskId) {
        const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
        const result = stmt.run(taskId);
        return result.changes > 0;
    }
    /**
     * Clean up old completed tasks
     */
    cleanupOldTasks(maxAgeMs = 24 * 60 * 60 * 1000) {
        const cutoff = Date.now() - maxAgeMs;
        const stmt = this.db.prepare(`
      DELETE FROM tasks
      WHERE status IN ('completed', 'failed', 'canceled')
        AND completed_at IS NOT NULL
        AND completed_at < ?
    `);
        const result = stmt.run(cutoff);
        return result.changes;
    }
    /**
     * Get statistics about tasks
     */
    getStats() {
        const total = this.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
        const byStatusRows = this.db.prepare(`
      SELECT status, COUNT(*) as count
      FROM tasks
      GROUP BY status
    `).all();
        const byOriginRows = this.db.prepare(`
      SELECT origin, COUNT(*) as count
      FROM tasks
      GROUP BY origin
    `).all();
        const running = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE status IN ('pending', 'working')
    `).get();
        const byStatus = {};
        byStatusRows.forEach(row => {
            byStatus[row.status] = row.count;
        });
        const byOrigin = {};
        byOriginRows.forEach(row => {
            byOrigin[row.origin] = row.count;
        });
        return {
            total: total.count,
            byStatus,
            byOrigin,
            running: running.count,
        };
    }
    /**
     * Convert database row to Task object
     */
    rowToTask(row) {
        return {
            id: row.id,
            externalId: row.external_id,
            alias: row.alias,
            origin: row.origin,
            status: row.status,
            instruction: row.instruction,
            workingDir: row.working_dir,
            envId: row.env_id,
            mode: row.mode,
            model: row.model,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            completedAt: row.completed_at,
            lastEventAt: row.last_event_at,
            progressSteps: row.progress_steps,
            pollFrequencyMs: row.poll_frequency_ms,
            keepAliveUntil: row.keep_alive_until,
            threadId: row.thread_id,
            userId: row.user_id,
            result: row.result,
            error: row.error,
            metadata: row.metadata,
        };
    }
    /**
     * Close database connection
     */
    close() {
        this.db.close();
    }
}
// Singleton instance
export const globalTaskRegistry = new TaskRegistry();
//# sourceMappingURL=task_registry.js.map