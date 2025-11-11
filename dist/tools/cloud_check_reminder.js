import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
const TASK_REGISTRY_PATH = join(homedir(), '.config', 'codex-control', 'cloud-tasks.json');
export class CloudCheckReminderTool {
    static getSchema() {
        return {
            name: 'codex_cloud_check_reminder',
            description: 'Check for pending Codex Cloud tasks and get Web UI links for status checking. Lists all submitted tasks with their details and provides direct links to check completion status. Use this periodically to monitor long-running Cloud tasks.',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
        };
    }
    async execute() {
        try {
            // Load task registry
            const data = await readFile(TASK_REGISTRY_PATH, 'utf-8');
            const tasks = JSON.parse(data);
            // Filter pending tasks
            const pendingTasks = tasks
                .filter((t) => t.status === 'submitted')
                .map((t) => {
                const submittedTime = new Date(t.timestamp);
                const now = new Date();
                const minutesAgo = Math.floor((now.getTime() - submittedTime.getTime()) / 60000);
                return {
                    taskId: t.taskId,
                    envId: t.envId,
                    task: t.task.substring(0, 100) + (t.task.length > 100 ? '...' : ''),
                    submittedAt: t.timestamp,
                    checkUrl: `https://chatgpt.com/codex/tasks/${t.taskId}`,
                    minutesAgo,
                };
            });
            const pendingCount = pendingTasks.length;
            let message;
            if (pendingCount === 0) {
                message = '✅ No pending Cloud tasks. All submitted tasks have been checked or completed.';
            }
            else if (pendingCount === 1) {
                message = `⏳ You have 1 pending Cloud task. Check status at the Web UI link below.`;
            }
            else {
                message = `⏳ You have ${pendingCount} pending Cloud tasks. Check status at the Web UI links below.`;
            }
            return {
                pendingCount,
                pendingTasks,
                message,
            };
        }
        catch (error) {
            // Registry file doesn't exist or is empty
            if (error.code === 'ENOENT') {
                return {
                    pendingCount: 0,
                    pendingTasks: [],
                    message: '✅ No Cloud tasks have been submitted yet.',
                };
            }
            throw error;
        }
    }
}
//# sourceMappingURL=cloud_check_reminder.js.map