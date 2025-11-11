export interface CloudTask {
    taskId: string;
    workingDir: string;
    envId: string;
    task: string;
    timestamp: string;
    status: 'submitted' | 'completed' | 'failed';
}
export interface CloudCheckReminderResult {
    pendingCount: number;
    pendingTasks: Array<{
        taskId: string;
        envId: string;
        task: string;
        submittedAt: string;
        checkUrl: string;
        minutesAgo: number;
    }>;
    message: string;
}
export declare class CloudCheckReminderTool {
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {};
            required: never[];
        };
    };
    execute(): Promise<CloudCheckReminderResult>;
}
//# sourceMappingURL=cloud_check_reminder.d.ts.map