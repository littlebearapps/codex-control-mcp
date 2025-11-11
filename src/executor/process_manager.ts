/**
 * Process Manager for Codex CLI
 *
 * Spawns and manages `codex exec` processes with:
 * - Safe spawning (no shell injection)
 * - Concurrency control (max 2-4 parallel)
 * - Event stream parsing
 * - Error handling and cleanup
 */

import { spawn, ChildProcess } from 'child_process';
import { JSONLParser, CodexEvent } from './jsonl_parser.js';

export interface CodexProcessOptions {
  task: string;
  mode?: 'read-only' | 'full-auto' | 'danger-full-access';
  outputSchema?: any;
  model?: string;
  workingDir?: string;

  /**
   * Environment variable policy for Codex Cloud execution
   * - 'inherit-none': No environment variables (default, most secure)
   * - 'inherit-all': All environment variables (convenient, less secure)
   * - 'allow-list': Only specified variables (recommended)
   */
  envPolicy?: 'inherit-all' | 'inherit-none' | 'allow-list';

  /**
   * Allowed environment variables (only used with envPolicy='allow-list')
   * Example: ['OPENAI_API_KEY', 'DATABASE_URL']
   */
  envAllowList?: string[];
}

export interface CodexProcessResult {
  success: boolean;
  events: CodexEvent[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  error?: Error;
}

export class ProcessQueue {
  private queue: Array<() => Promise<void>> = [];
  private running: number = 0;
  private maxConcurrency: number;

  constructor(maxConcurrency: number = 2) {
    this.maxConcurrency = maxConcurrency;
  }

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedTask = async () => {
        this.running++;
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processNext();
        }
      };

      this.queue.push(wrappedTask);
      this.processNext();
    });
  }

  private processNext() {
    if (this.running < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        task();
      }
    }
  }

  getStats() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrency: this.maxConcurrency,
    };
  }
}

export class ProcessManager {
  private processes: Map<string, ChildProcess> = new Map();
  private queue: ProcessQueue;

  constructor(maxConcurrency: number = 2) {
    this.queue = new ProcessQueue(maxConcurrency);
  }

  /**
   * Execute a Codex task
   * Returns promise that resolves when process completes
   */
  async execute(options: CodexProcessOptions): Promise<CodexProcessResult> {
    return this.queue.add(() => this.runProcess(options));
  }

  /**
   * Internal: Run a single Codex process
   */
  private async runProcess(options: CodexProcessOptions): Promise<CodexProcessResult> {
    const { task, mode, outputSchema, model, workingDir, envPolicy, envAllowList } = options;

    // Build command args safely (no shell injection)
    const args = ['exec', '--json'];

    if (mode) {
      args.push(`--sandbox=${mode}`);
    }

    if (model) {
      args.push(`--model=${model}`);
    }

    if (outputSchema) {
      args.push(`--output-schema=${JSON.stringify(outputSchema)}`);
    }

    // Environment variable policy (default: inherit-none)
    const policy = envPolicy || 'inherit-none';
    if (policy === 'inherit-all') {
      args.push('-c', 'shell_environment_policy.inherit=all');
    } else if (policy === 'allow-list' && envAllowList && envAllowList.length > 0) {
      args.push('-c', `shell_environment_policy.allow=${JSON.stringify(envAllowList)}`);
    }
    // Note: 'inherit-none' is the Codex CLI default, no flag needed

    // Task goes last as positional argument
    args.push(task);

    return new Promise((resolve) => {
      const parser = new JSONLParser();
      const events: CodexEvent[] = [];
      let stdout = '';
      let stderr = '';

      // Spawn process (no shell = no injection risk)
      const proc = spawn('codex', args, {
        cwd: workingDir || process.cwd(),
        env: {
          ...process.env,
          // Inherit CODEX_API_KEY if set, otherwise use ChatGPT Pro
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const processId = `codex-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      this.processes.set(processId, proc);

      // Parse JSONL from stdout
      proc.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8');
        stdout += text;

        const parsedEvents = parser.feed(text);
        events.push(...parsedEvents);
      });

      // Capture stderr (warnings, errors)
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8');
      });

      // Handle process completion
      proc.on('close', (exitCode, signal) => {
        // Flush any remaining buffered events
        const finalEvent = parser.flush();
        if (finalEvent) {
          events.push(finalEvent);
        }

        // Cleanup
        this.processes.delete(processId);

        resolve({
          success: exitCode === 0,
          events,
          stdout,
          stderr,
          exitCode,
          signal,
        });
      });

      // Handle process errors (spawn failures, etc.)
      proc.on('error', (error) => {
        this.processes.delete(processId);

        resolve({
          success: false,
          events,
          stdout,
          stderr,
          exitCode: null,
          signal: null,
          error,
        });
      });
    });
  }

  /**
   * Kill all running processes (cleanup on shutdown)
   */
  killAll() {
    for (const [id, proc] of this.processes.entries()) {
      console.log(`[ProcessManager] Killing process ${id}`);
      proc.kill('SIGTERM');
    }
    this.processes.clear();
  }

  /**
   * Get stats about active processes
   */
  getStats() {
    return {
      activeProcesses: this.processes.size,
      ...this.queue.getStats(),
    };
  }
}
