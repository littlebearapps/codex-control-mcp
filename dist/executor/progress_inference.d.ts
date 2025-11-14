/**
 * Progress Inference from JSONL Event Streams
 *
 * Extracts meaningful progress information from Codex execution events.
 * Tracks turns, items, file changes, and commands to provide real-time status.
 */
import { CodexEvent } from './jsonl_parser.js';
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
export declare class ProgressInferenceEngine {
    private turns;
    private items;
    private fileChanges;
    private commandsExecuted;
    private currentTurnId;
    private isComplete;
    private hasFailed;
    /**
     * Process a single event and update progress state
     */
    processEvent(event: CodexEvent): void;
    /**
     * Get current progress summary
     */
    getProgress(): ProgressSummary;
    /**
     * Reset progress state (for reuse)
     */
    reset(): void;
    private handleTurnStarted;
    private handleTurnCompleted;
    private handleTurnFailed;
    private handleItemStarted;
    private handleItemCompleted;
    private handleItemUpdated;
}
/**
 * Convenience function to process a batch of events
 */
export declare function inferProgress(events: CodexEvent[]): ProgressSummary;
//# sourceMappingURL=progress_inference.d.ts.map