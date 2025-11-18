/**
 * Cleanup Registry Tool - Clean up stuck and old tasks
 *
 * Provides manual cleanup of:
 * - Stuck tasks (pending/working for >1 hour)
 * - Old completed tasks (>24 hours)
 */
import { globalTaskRegistry } from '../state/task_registry.js';
export class CleanupRegistryTool {
    static getSchema() {
        return {
            name: '_codex_cleanup_registry',
            description: 'Clean up stuck tasks (pending/working for too long) and old completed tasks. Use this to maintain task registry health and prevent accumulation of zombie tasks.',
            inputSchema: {
                type: 'object',
                properties: {
                    stuckTaskMaxAgeSeconds: {
                        type: 'number',
                        description: 'Maximum age in seconds before considering a task stuck (default: 3600 = 1 hour). Tasks in pending/working status older than this will be marked as failed.',
                        default: 3600,
                    },
                    oldTaskMaxAgeHours: {
                        type: 'number',
                        description: 'Maximum age in hours before deleting completed tasks (default: 24 hours). Completed/failed/canceled tasks older than this will be permanently deleted.',
                        default: 24,
                    },
                    dryRun: {
                        type: 'boolean',
                        description: 'Preview changes without applying them. Shows what would be cleaned up.',
                        default: false,
                    },
                    format: {
                        type: 'string',
                        enum: ['json', 'markdown'],
                        default: 'markdown',
                        description: 'Response format. Default markdown for backward compatibility.',
                    },
                },
            },
        };
    }
    async execute(input) {
        const stuckTaskMaxAgeSeconds = input.stuckTaskMaxAgeSeconds || 3600;
        const oldTaskMaxAgeHours = input.oldTaskMaxAgeHours || 24;
        const dryRun = input.dryRun || false;
        // JSON output (registry_info)
        if (input.format === 'json') {
            // Preview-only calculations for JSON to avoid side effects when dryRun=true
            const now = Date.now();
            const stuckCutoff = now - (stuckTaskMaxAgeSeconds * 1000);
            const oldCutoff = now - (oldTaskMaxAgeHours * 60 * 60 * 1000);
            const all = globalTaskRegistry.queryTasks({});
            const stuckCandidates = all.filter(t => (t.status === 'pending' || t.status === 'working') && t.createdAt < stuckCutoff);
            const oldCandidates = all.filter(t => (t.completedAt !== undefined &&
                (t.status === 'completed' || t.status === 'completed_with_warnings' || t.status === 'completed_with_errors' || t.status === 'failed' || t.status === 'canceled') &&
                t.completedAt < oldCutoff));
            let stuckCleaned = 0;
            let oldDeleted = 0;
            if (!dryRun) {
                stuckCleaned = globalTaskRegistry.cleanupStuckTasks(stuckTaskMaxAgeSeconds);
                oldDeleted = globalTaskRegistry.cleanupOldTasks(oldTaskMaxAgeHours * 60 * 60 * 1000);
            }
            const json = {
                version: '3.6',
                schema_id: 'codex/v3.6/registry_info/v1',
                tool: '_codex_cleanup_registry',
                tool_category: 'registry_info',
                request_id: (await import('crypto')).randomUUID(),
                ts: new Date().toISOString(),
                status: 'ok',
                meta: {
                    dry_run: dryRun,
                    stuck_threshold_seconds: stuckTaskMaxAgeSeconds,
                    old_threshold_hours: oldTaskMaxAgeHours,
                },
                data: {
                    stuck_tasks: {
                        found: stuckCandidates.length,
                        cleaned: dryRun ? 0 : stuckCleaned,
                        task_ids: stuckCandidates.slice(0, 50).map(t => t.id),
                    },
                    old_tasks: {
                        found: oldCandidates.length,
                        deleted: dryRun ? 0 : oldDeleted,
                        oldest_age_hours: oldCandidates.length > 0 ? Math.max(...oldCandidates.map(t => Math.floor((now - (t.completedAt || now)) / 3600000))) : 0,
                    },
                    summary: `${dryRun ? 'Would clean' : 'Cleaned'} ${dryRun ? stuckCandidates.length : stuckCleaned} stuck task(s), ${dryRun ? oldCandidates.length : oldDeleted} old task(s)`,
                },
            };
            return { content: [{ type: 'text', text: JSON.stringify(json) }] };
        }
        let message = `## 🧹 Task Registry Cleanup\n\n`;
        if (dryRun) {
            message += `**Mode**: 🔍 Dry Run (Preview Only)\n\n`;
        }
        else {
            message += `**Mode**: ✅ Live Cleanup\n\n`;
        }
        // ========================================
        // SECTION 1: Stuck Tasks
        // ========================================
        message += `### Stuck Tasks\n\n`;
        message += `**Criteria**: Tasks in 'pending' or 'working' status for >${stuckTaskMaxAgeSeconds} seconds (${Math.floor(stuckTaskMaxAgeSeconds / 60)} minutes)\n\n`;
        if (dryRun) {
            // Preview mode - query without updating
            const cutoff = Date.now() - (stuckTaskMaxAgeSeconds * 1000);
            const stuckTasks = globalTaskRegistry.queryTasks({
                createdBefore: cutoff,
            }).filter(task => task.status === 'pending' || task.status === 'working');
            if (stuckTasks.length === 0) {
                message += `✅ No stuck tasks found\n\n`;
            }
            else {
                message += `⚠️ Found ${stuckTasks.length} stuck task(s):\n\n`;
                stuckTasks.forEach(task => {
                    const ageSeconds = Math.floor((Date.now() - task.createdAt) / 1000);
                    const ageMinutes = Math.floor(ageSeconds / 60);
                    const ageHours = Math.floor(ageMinutes / 60);
                    message += `- **${task.id}**: ${task.status} (${ageHours}h ${ageMinutes % 60}m old)\n`;
                    message += `  - Task: ${task.instruction.substring(0, 100)}${task.instruction.length > 100 ? '...' : ''}\n`;
                });
                message += `\n**Action**: Would mark ${stuckTasks.length} task(s) as 'failed'\n\n`;
            }
        }
        else {
            // Live mode - actually clean up
            const cleaned = globalTaskRegistry.cleanupStuckTasks(stuckTaskMaxAgeSeconds);
            if (cleaned === 0) {
                message += `✅ No stuck tasks found\n\n`;
            }
            else {
                message += `✅ Marked ${cleaned} stuck task(s) as 'failed'\n\n`;
            }
        }
        // ========================================
        // SECTION 2: Old Completed Tasks
        // ========================================
        message += `### Old Completed Tasks\n\n`;
        message += `**Criteria**: Completed/failed/canceled tasks older than ${oldTaskMaxAgeHours} hours\n\n`;
        if (dryRun) {
            // Preview mode - query without deleting
            const cutoff = Date.now() - (oldTaskMaxAgeHours * 60 * 60 * 1000);
            const oldTasks = globalTaskRegistry.queryTasks({
                createdBefore: cutoff,
            }).filter(task => (task.status === 'completed' || task.status === 'completed_with_warnings' ||
                task.status === 'completed_with_errors' || task.status === 'failed' ||
                task.status === 'canceled') && task.completedAt !== undefined);
            if (oldTasks.length === 0) {
                message += `✅ No old completed tasks found\n\n`;
            }
            else {
                message += `⚠️ Found ${oldTasks.length} old completed task(s):\n\n`;
                const byStatus = {};
                oldTasks.forEach(task => {
                    byStatus[task.status] = (byStatus[task.status] || 0) + 1;
                });
                Object.entries(byStatus).forEach(([status, count]) => {
                    message += `- ${status}: ${count}\n`;
                });
                message += `\n**Action**: Would delete ${oldTasks.length} task(s)\n\n`;
            }
        }
        else {
            // Live mode - actually delete
            const deleted = globalTaskRegistry.cleanupOldTasks(oldTaskMaxAgeHours * 60 * 60 * 1000);
            if (deleted === 0) {
                message += `✅ No old completed tasks found\n\n`;
            }
            else {
                message += `✅ Deleted ${deleted} old completed task(s)\n\n`;
            }
        }
        // ========================================
        // SECTION 3: Final Stats
        // ========================================
        const stats = globalTaskRegistry.getStats();
        message += `### Registry Statistics\n\n`;
        message += `**Total Tasks**: ${stats.total}\n`;
        message += `**Running Tasks**: ${stats.running}\n\n`;
        message += `**By Status**:\n`;
        Object.entries(stats.byStatus).forEach(([status, count]) => {
            message += `- ${status}: ${count}\n`;
        });
        message += `\n`;
        return {
            content: [
                {
                    type: 'text',
                    text: message,
                },
            ],
        };
    }
}
//# sourceMappingURL=cleanup_registry.js.map