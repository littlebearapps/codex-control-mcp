/**
 * Progress Inference from JSONL Event Streams
 *
 * Extracts meaningful progress information from Codex execution events.
 * Tracks turns, items, file changes, and commands to provide real-time status.
 */

import { CodexEvent, getItemType } from './jsonl_parser.js';

export interface ProgressStep {
  type: 'turn' | 'item' | 'file_change' | 'command';
  description: string;
  status: 'started' | 'completed' | 'failed';
  timestamp?: string;
  details?: any;
}

export interface ProgressSummary {
  currentAction: string | null;
  completedSteps: number;
  totalSteps: number;
  progressPercentage: number;
  steps: ProgressStep[];
  filesChanged: number;
  commandsExecuted: number;
  isComplete: boolean;
  hasFailed: boolean;
}

/**
 * Infer progress from a stream of JSONL events
 */
export class ProgressInferenceEngine {
  private turns: Map<string, ProgressStep> = new Map();
  private items: Map<string, ProgressStep> = new Map();
  private fileChanges: number = 0;
  private commandsExecuted: number = 0;
  private currentTurnId: string | null = null;
  private isComplete: boolean = false;
  private hasFailed: boolean = false;

  /**
   * Process a single event and update progress state
   */
  processEvent(event: CodexEvent): void {
    switch (event.type) {
      case 'turn.started':
        this.handleTurnStarted(event);
        break;

      case 'turn.completed':
        this.handleTurnCompleted(event);
        break;

      case 'turn.failed':
        this.handleTurnFailed(event);
        break;

      case 'item.started':
        this.handleItemStarted(event);
        break;

      case 'item.completed':
        this.handleItemCompleted(event);
        break;

      case 'item.updated':
        this.handleItemUpdated(event);
        break;

      default:
        // Ignore other event types
        break;
    }
  }

  /**
   * Get current progress summary
   */
  getProgress(): ProgressSummary {
    const allSteps = [
      ...Array.from(this.turns.values()),
      ...Array.from(this.items.values()),
    ];

    const completedSteps = allSteps.filter(
      (s) => s.status === 'completed'
    ).length;
    const totalSteps = allSteps.length || 1; // Avoid division by zero

    const progressPercentage = Math.round((completedSteps / totalSteps) * 100);

    // Find current action (last started item or turn)
    let currentAction: string | null = null;
    const startedSteps = allSteps
      .filter((s) => s.status === 'started')
      .sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA; // Descending (newest first)
      });

    if (startedSteps.length > 0) {
      currentAction = startedSteps[0].description;
    }

    return {
      currentAction,
      completedSteps,
      totalSteps,
      progressPercentage,
      steps: allSteps,
      filesChanged: this.fileChanges,
      commandsExecuted: this.commandsExecuted,
      isComplete: this.isComplete,
      hasFailed: this.hasFailed,
    };
  }

  /**
   * Reset progress state (for reuse)
   */
  reset(): void {
    this.turns.clear();
    this.items.clear();
    this.fileChanges = 0;
    this.commandsExecuted = 0;
    this.currentTurnId = null;
    this.isComplete = false;
    this.hasFailed = false;
  }

  // Private handlers

  private handleTurnStarted(event: CodexEvent): void {
    const turnId = event.turnId || event.data?.turnId || 'unknown';
    this.currentTurnId = turnId;

    this.turns.set(turnId, {
      type: 'turn',
      description: `Processing turn ${turnId}`,
      status: 'started',
      timestamp: event.timestamp,
      details: event.data,
    });
  }

  private handleTurnCompleted(event: CodexEvent): void {
    const turnId = event.turnId || event.data?.turnId || this.currentTurnId;
    if (!turnId) return;

    const existing = this.turns.get(turnId);
    if (existing) {
      existing.status = 'completed';
      existing.timestamp = event.timestamp;
    }

    this.isComplete = true;
  }

  private handleTurnFailed(event: CodexEvent): void {
    const turnId = event.turnId || event.data?.turnId || this.currentTurnId;
    if (!turnId) return;

    const existing = this.turns.get(turnId);
    if (existing) {
      existing.status = 'failed';
      existing.timestamp = event.timestamp;
      existing.details = {
        ...existing.details,
        error: event.error || event.data?.error,
      };
    }

    this.hasFailed = true;
    this.isComplete = true; // Failed is also a terminal state
  }

  private handleItemStarted(event: CodexEvent): void {
    const itemId = event.itemId || event.data?.itemId || 'unknown';
    const itemType = getItemType(event) || 'unknown';

    let description = `Started ${itemType}`;

    // Enhance description based on item type
    if (itemType === 'file_change' && event.data?.path) {
      description = `Editing ${event.data.path}`;
    } else if (itemType === 'command_execution' && event.data?.command) {
      description = `Running command: ${event.data.command}`;
    } else if (event.data?.description) {
      description = event.data.description;
    }

    this.items.set(itemId, {
      type: 'item',
      description,
      status: 'started',
      timestamp: event.timestamp,
      details: event.data,
    });
  }

  private handleItemCompleted(event: CodexEvent): void {
    const itemId = event.itemId || event.data?.itemId;
    if (!itemId) return;

    const existing = this.items.get(itemId);
    if (existing) {
      existing.status = 'completed';
      existing.timestamp = event.timestamp;

      // Track counters
      const itemType = getItemType(event);
      if (itemType === 'file_change') {
        this.fileChanges++;
      } else if (itemType === 'command_execution') {
        this.commandsExecuted++;
      }
    }
  }

  private handleItemUpdated(event: CodexEvent): void {
    const itemId = event.itemId || event.data?.itemId;
    if (!itemId) return;

    const existing = this.items.get(itemId);
    if (existing) {
      // Update details with new information
      existing.details = {
        ...existing.details,
        ...event.data,
      };
      existing.timestamp = event.timestamp;
    }
  }
}

/**
 * Convenience function to process a batch of events
 */
export function inferProgress(events: CodexEvent[]): ProgressSummary {
  const engine = new ProgressInferenceEngine();
  for (const event of events) {
    engine.processEvent(event);
  }
  return engine.getProgress();
}
