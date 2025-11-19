import { ChildProcess } from "child_process";
export interface WatchdogConfig {
    idleTimeoutMs?: number;
    hardTimeoutMs?: number;
    warnLeadMs?: number;
    killGraceMs?: number;
    onProgress?: (progress: ProgressUpdate) => void;
    onWarning?: (warning: TimeoutWarning) => void;
    onTimeout?: (timeout: TimeoutError) => void;
    onActivity?: () => void;
}
export interface ProgressUpdate {
    progressToken: string;
    progress: number;
    total?: number;
    elapsedMs: number;
    lastActivity: Date;
}
export interface TimeoutWarning {
    level: "warning";
    logger: string;
    data: {
        message: string;
        idleMs: number;
        willAbortInMs: number;
        taskId: string;
    };
}
export interface TimeoutError {
    code: "ETIMEDOUT" | "EIDLE";
    kind: "inactivity" | "deadline" | "manual";
    message: string;
    idleMs?: number;
    wallClockMs?: number;
    pid: number;
    killed: boolean;
    signal?: string;
}
export interface PartialResults {
    lastEvents: any[];
    stdoutTail: string;
    stderrTail: string;
    lastActivityAt: Date;
    eventsCount: number;
}
export declare class TimeoutWatchdog {
    private child;
    private taskId;
    private startTime;
    private lastActivity;
    private warned;
    private aborted;
    private idleTimer?;
    private hardTimer?;
    private warnTimer?;
    private progressTimer?;
    private config;
    private progressToken;
    private stdoutChunks;
    private stderrChunks;
    private lastEvents;
    private static readonly MAX_TAIL_BYTES;
    private static readonly MAX_EVENTS;
    constructor(child: ChildProcess, taskId: string, config?: WatchdogConfig);
    /**
     * Call this whenever child process produces output
     */
    recordActivity(): void;
    /**
     * Record stdout chunk for partial results
     */
    recordStdout(chunk: Buffer): void;
    /**
     * Record stderr chunk for partial results
     */
    recordStderr(chunk: Buffer): void;
    /**
     * Record parsed JSONL event for partial results
     */
    recordEvent(event: any): void;
    /**
     * Get partial results collected so far
     */
    getPartialResults(): PartialResults;
    /**
     * Stop all timers and cleanup
     */
    stop(): void;
    /**
     * Manually trigger timeout (for testing or external kill)
     */
    abort(reason: "inactivity" | "deadline" | "manual"): TimeoutError;
    private startTimers;
    private resetIdleTimer;
    private checkWarning;
    private sendProgress;
    private killProcess;
    private pushToBuffer;
    private clearAllTimers;
    private getTimeoutMessage;
}
//# sourceMappingURL=timeout_watchdog.d.ts.map