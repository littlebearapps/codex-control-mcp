import { ChildProcess } from 'child_process';
import treeKill from 'tree-kill';

export interface WatchdogConfig {
  // Timeouts
  idleTimeoutMs?: number;        // Default: 5 minutes (300000)
  hardTimeoutMs?: number;        // Default: 20 minutes (1200000)
  warnLeadMs?: number;           // Default: 30 seconds (30000)
  killGraceMs?: number;          // Default: 5 seconds (5000)

  // Callbacks
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
  level: 'warning';
  logger: string;
  data: {
    message: string;
    idleMs: number;
    willAbortInMs: number;
    taskId: string;
  };
}

export interface TimeoutError {
  code: 'ETIMEDOUT' | 'EIDLE';
  kind: 'inactivity' | 'deadline' | 'manual';
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

export class TimeoutWatchdog {
  private startTime: number;
  private lastActivity: number;
  private warned: boolean = false;
  private aborted: boolean = false;

  private idleTimer?: NodeJS.Timeout;
  private hardTimer?: NodeJS.Timeout;
  private warnTimer?: NodeJS.Timeout;
  private progressTimer?: NodeJS.Timeout;

  private config: Required<WatchdogConfig>;
  private progressToken: string;

  // Partial result buffers
  private stdoutChunks: Buffer[] = [];
  private stderrChunks: Buffer[] = [];
  private lastEvents: any[] = [];

  private static readonly MAX_TAIL_BYTES = 64 * 1024;
  private static readonly MAX_EVENTS = 50;

  constructor(
    private child: ChildProcess,
    private taskId: string,
    config: WatchdogConfig = {}
  ) {
    this.startTime = Date.now();
    this.lastActivity = Date.now();
    this.progressToken = `progress-${taskId}`;

    // Default config
    this.config = {
      idleTimeoutMs: config.idleTimeoutMs ?? 5 * 60 * 1000,      // 5 minutes
      hardTimeoutMs: config.hardTimeoutMs ?? 20 * 60 * 1000,     // 20 minutes
      warnLeadMs: config.warnLeadMs ?? 30 * 1000,                // 30 seconds
      killGraceMs: config.killGraceMs ?? 5 * 1000,               // 5 seconds
      onProgress: config.onProgress ?? (() => {}),
      onWarning: config.onWarning ?? (() => {}),
      onTimeout: config.onTimeout ?? (() => {}),
      onActivity: config.onActivity ?? (() => {})
    };

    this.startTimers();
  }

  /**
   * Call this whenever child process produces output
   */
  public recordActivity(): void {
    if (this.aborted) return;

    this.lastActivity = Date.now();
    this.warned = false;  // Reset warning state
    this.config.onActivity();

    // Reset inactivity timer
    this.resetIdleTimer();
  }

  /**
   * Record stdout chunk for partial results
   */
  public recordStdout(chunk: Buffer): void {
    this.recordActivity();
    this.pushToBuffer(this.stdoutChunks, chunk);
  }

  /**
   * Record stderr chunk for partial results
   */
  public recordStderr(chunk: Buffer): void {
    this.recordActivity();
    this.pushToBuffer(this.stderrChunks, chunk);
  }

  /**
   * Record parsed JSONL event for partial results
   */
  public recordEvent(event: any): void {
    this.recordActivity();
    this.lastEvents.push(event);
    if (this.lastEvents.length > TimeoutWatchdog.MAX_EVENTS) {
      this.lastEvents.shift();
    }
  }

  /**
   * Get partial results collected so far
   */
  public getPartialResults(): PartialResults {
    return {
      lastEvents: [...this.lastEvents],
      stdoutTail: Buffer.concat(this.stdoutChunks).toString('utf8'),
      stderrTail: Buffer.concat(this.stderrChunks).toString('utf8'),
      lastActivityAt: new Date(this.lastActivity),
      eventsCount: this.lastEvents.length
    };
  }

  /**
   * Stop all timers and cleanup
   */
  public stop(): void {
    this.clearAllTimers();
  }

  /**
   * Manually trigger timeout (for testing or external kill)
   */
  public abort(reason: 'inactivity' | 'deadline' | 'manual'): TimeoutError {
    if (this.aborted) {
      throw new Error('Watchdog already aborted');
    }

    this.aborted = true;
    this.clearAllTimers();

    const error: TimeoutError = {
      code: reason === 'inactivity' ? 'EIDLE' : 'ETIMEDOUT',
      kind: reason === 'manual' ? 'deadline' : reason,
      message: this.getTimeoutMessage(reason),
      idleMs: reason === 'inactivity' ? Date.now() - this.lastActivity : undefined,
      wallClockMs: reason === 'deadline' ? Date.now() - this.startTime : undefined,
      pid: this.child.pid!,
      killed: false
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

  private startTimers(): void {
    // Hard timeout (wall-clock)
    this.hardTimer = setTimeout(() => {
      this.abort('deadline');
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

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      this.abort('inactivity');
    }, this.config.idleTimeoutMs);
  }

  private checkWarning(): void {
    if (this.warned || this.aborted) return;

    const idle = Date.now() - this.lastActivity;
    const warnAt = this.config.idleTimeoutMs - this.config.warnLeadMs;

    if (idle >= warnAt && idle < this.config.idleTimeoutMs) {
      this.warned = true;

      const warning: TimeoutWarning = {
        level: 'warning',
        logger: 'codex-timeout-watchdog',
        data: {
          message: `No output for ${Math.floor(idle / 1000)}s. Will abort in ${Math.floor((this.config.idleTimeoutMs - idle) / 1000)}s unless output resumes.`,
          idleMs: idle,
          willAbortInMs: this.config.idleTimeoutMs - idle,
          taskId: this.taskId
        }
      };

      this.config.onWarning(warning);
    }
  }

  private sendProgress(): void {
    if (this.aborted) return;

    const elapsed = Date.now() - this.startTime;
    const total = this.config.hardTimeoutMs;

    const progress: ProgressUpdate = {
      progressToken: this.progressToken,
      progress: elapsed,
      total: total,
      elapsedMs: elapsed,
      lastActivity: new Date(this.lastActivity)
    };

    this.config.onProgress(progress);
  }

  private killProcess(onKilled: (signal: string) => void): void {
    const pid = this.child.pid;
    if (!pid) return;

    // Try SIGTERM first
    try {
      if (process.platform !== 'win32') {
        process.kill(-pid, 'SIGTERM');  // Kill process group
      } else {
        treeKill(pid, 'SIGTERM');
      }
      onKilled('SIGTERM');
    } catch (err) {
      // Process might already be dead
    }

    // Force kill after grace period
    setTimeout(() => {
      try {
        if (process.platform !== 'win32') {
          process.kill(-pid, 'SIGKILL');
        } else {
          treeKill(pid, 'SIGKILL');
        }
        onKilled('SIGKILL');
      } catch (err) {
        // Process definitely dead now
      }
    }, this.config.killGraceMs);
  }

  private pushToBuffer(buffer: Buffer[], chunk: Buffer): void {
    buffer.push(chunk);
    let size = buffer.reduce((s, b) => s + b.length, 0);

    while (size > TimeoutWatchdog.MAX_TAIL_BYTES && buffer.length > 1) {
      const removed = buffer.shift()!;
      size -= removed.length;
    }
  }

  private clearAllTimers(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.hardTimer) clearTimeout(this.hardTimer);
    if (this.warnTimer) clearInterval(this.warnTimer);
    if (this.progressTimer) clearInterval(this.progressTimer);
  }

  private getTimeoutMessage(reason: string): string {
    switch (reason) {
      case 'inactivity':
        return `Codex CLI produced no output within the allowed inactivity window (${this.config.idleTimeoutMs / 1000}s).`;
      case 'deadline':
        return `Codex CLI exceeded the maximum allowed wall-clock time (${this.config.hardTimeoutMs / 1000}s).`;
      case 'manual':
        return 'Codex CLI execution was manually aborted.';
      default:
        return 'Codex CLI execution timed out.';
    }
  }
}
