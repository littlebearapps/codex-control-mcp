import treeKill from "tree-kill";
export class TimeoutWatchdog {
    child;
    taskId;
    startTime;
    lastActivity;
    warned = false;
    aborted = false;
    idleTimer;
    hardTimer;
    warnTimer;
    progressTimer;
    config;
    progressToken;
    // Partial result buffers
    stdoutChunks = [];
    stderrChunks = [];
    lastEvents = [];
    static MAX_TAIL_BYTES = 64 * 1024;
    static MAX_EVENTS = 50;
    constructor(child, taskId, config = {}) {
        this.child = child;
        this.taskId = taskId;
        this.startTime = Date.now();
        this.lastActivity = Date.now();
        this.progressToken = `progress-${taskId}`;
        // Default config
        this.config = {
            idleTimeoutMs: config.idleTimeoutMs ?? 5 * 60 * 1000, // 5 minutes
            hardTimeoutMs: config.hardTimeoutMs ?? 20 * 60 * 1000, // 20 minutes
            warnLeadMs: config.warnLeadMs ?? 30 * 1000, // 30 seconds
            killGraceMs: config.killGraceMs ?? 5 * 1000, // 5 seconds
            onProgress: config.onProgress ?? (() => { }),
            onWarning: config.onWarning ?? (() => { }),
            onTimeout: config.onTimeout ?? (() => { }),
            onActivity: config.onActivity ?? (() => { }),
        };
        this.startTimers();
    }
    /**
     * Call this whenever child process produces output
     */
    recordActivity() {
        if (this.aborted)
            return;
        this.lastActivity = Date.now();
        this.warned = false; // Reset warning state
        this.config.onActivity();
        // Reset inactivity timer
        this.resetIdleTimer();
    }
    /**
     * Record stdout chunk for partial results
     */
    recordStdout(chunk) {
        this.recordActivity();
        this.pushToBuffer(this.stdoutChunks, chunk);
    }
    /**
     * Record stderr chunk for partial results
     */
    recordStderr(chunk) {
        this.recordActivity();
        this.pushToBuffer(this.stderrChunks, chunk);
    }
    /**
     * Record parsed JSONL event for partial results
     */
    recordEvent(event) {
        this.recordActivity();
        this.lastEvents.push(event);
        if (this.lastEvents.length > TimeoutWatchdog.MAX_EVENTS) {
            this.lastEvents.shift();
        }
    }
    /**
     * Get partial results collected so far
     */
    getPartialResults() {
        return {
            lastEvents: [...this.lastEvents],
            stdoutTail: Buffer.concat(this.stdoutChunks).toString("utf8"),
            stderrTail: Buffer.concat(this.stderrChunks).toString("utf8"),
            lastActivityAt: new Date(this.lastActivity),
            eventsCount: this.lastEvents.length,
        };
    }
    /**
     * Stop all timers and cleanup
     */
    stop() {
        this.clearAllTimers();
    }
    /**
     * Manually trigger timeout (for testing or external kill)
     */
    abort(reason) {
        if (this.aborted) {
            throw new Error("Watchdog already aborted");
        }
        this.aborted = true;
        this.clearAllTimers();
        const error = {
            code: reason === "inactivity" ? "EIDLE" : "ETIMEDOUT",
            kind: reason === "manual" ? "deadline" : reason,
            message: this.getTimeoutMessage(reason),
            idleMs: reason === "inactivity" ? Date.now() - this.lastActivity : undefined,
            wallClockMs: reason === "deadline" ? Date.now() - this.startTime : undefined,
            pid: this.child.pid,
            killed: false,
        };
        // Kill process
        this.killProcess((signal) => {
            error.killed = true;
            error.signal = signal;
        });
        this.config.onTimeout(error);
        return error;
    }
    // ========== Private Methods ==========
    startTimers() {
        // Hard timeout (wall-clock)
        this.hardTimer = setTimeout(() => {
            this.abort("deadline");
        }, this.config.hardTimeoutMs);
        // Inactivity timer (resets on activity)
        this.resetIdleTimer();
        // Warning timer (checks if we should warn)
        this.warnTimer = setInterval(() => {
            this.checkWarning();
        }, 1000);
        // Progress updates (every 30 seconds)
        this.progressTimer = setInterval(() => {
            this.sendProgress();
        }, 30000);
    }
    resetIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
        this.idleTimer = setTimeout(() => {
            this.abort("inactivity");
        }, this.config.idleTimeoutMs);
    }
    checkWarning() {
        if (this.warned || this.aborted)
            return;
        const idle = Date.now() - this.lastActivity;
        const warnAt = this.config.idleTimeoutMs - this.config.warnLeadMs;
        if (idle >= warnAt && idle < this.config.idleTimeoutMs) {
            this.warned = true;
            const warning = {
                level: "warning",
                logger: "codex-timeout-watchdog",
                data: {
                    message: `No output for ${Math.floor(idle / 1000)}s. Will abort in ${Math.floor((this.config.idleTimeoutMs - idle) / 1000)}s unless output resumes.`,
                    idleMs: idle,
                    willAbortInMs: this.config.idleTimeoutMs - idle,
                    taskId: this.taskId,
                },
            };
            this.config.onWarning(warning);
        }
    }
    sendProgress() {
        if (this.aborted)
            return;
        const elapsed = Date.now() - this.startTime;
        const total = this.config.hardTimeoutMs;
        const progress = {
            progressToken: this.progressToken,
            progress: elapsed,
            total: total,
            elapsedMs: elapsed,
            lastActivity: new Date(this.lastActivity),
        };
        this.config.onProgress(progress);
    }
    killProcess(onKilled) {
        const pid = this.child.pid;
        if (!pid)
            return;
        // Try SIGTERM first
        try {
            if (process.platform !== "win32") {
                process.kill(-pid, "SIGTERM"); // Kill process group
            }
            else {
                treeKill(pid, "SIGTERM");
            }
            onKilled("SIGTERM");
        }
        catch (err) {
            // Process might already be dead
        }
        // Force kill after grace period
        setTimeout(() => {
            try {
                if (process.platform !== "win32") {
                    process.kill(-pid, "SIGKILL");
                }
                else {
                    treeKill(pid, "SIGKILL");
                }
                onKilled("SIGKILL");
            }
            catch (err) {
                // Process definitely dead now
            }
        }, this.config.killGraceMs);
    }
    pushToBuffer(buffer, chunk) {
        buffer.push(chunk);
        let size = buffer.reduce((s, b) => s + b.length, 0);
        while (size > TimeoutWatchdog.MAX_TAIL_BYTES && buffer.length > 1) {
            const removed = buffer.shift();
            size -= removed.length;
        }
    }
    clearAllTimers() {
        if (this.idleTimer)
            clearTimeout(this.idleTimer);
        if (this.hardTimer)
            clearTimeout(this.hardTimer);
        if (this.warnTimer)
            clearInterval(this.warnTimer);
        if (this.progressTimer)
            clearInterval(this.progressTimer);
    }
    getTimeoutMessage(reason) {
        switch (reason) {
            case "inactivity":
                return `Codex CLI produced no output within the allowed inactivity window (${this.config.idleTimeoutMs / 1000}s).`;
            case "deadline":
                return `Codex CLI exceeded the maximum allowed wall-clock time (${this.config.hardTimeoutMs / 1000}s).`;
            case "manual":
                return "Codex CLI execution was manually aborted.";
            default:
                return "Codex CLI execution timed out.";
        }
    }
}
//# sourceMappingURL=timeout_watchdog.js.map