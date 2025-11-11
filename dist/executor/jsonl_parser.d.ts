/**
 * JSONL Parser for Codex CLI Event Stream
 *
 * Parses newline-delimited JSON events from `codex exec --json` output.
 * Implements tolerant parsing with line buffering to handle:
 * - Partial lines (chunks may split mid-line)
 * - Non-JSON stderr output (warnings, debug logs)
 * - Malformed events (graceful degradation)
 */
export interface CodexEvent {
    type: string;
    timestamp?: string;
    data?: any;
    [key: string]: any;
}
export declare class JSONLParser {
    private buffer;
    private lineCount;
    private parseErrors;
    /**
     * Feed a chunk of output from codex exec --json
     * Returns array of successfully parsed events
     */
    feed(chunk: string): CodexEvent[];
    /**
     * Flush remaining buffer (call when stream ends)
     * Returns final event if buffer contains complete JSON
     */
    flush(): CodexEvent | null;
    /**
     * Get parsing statistics
     */
    getStats(): {
        linesProcessed: number;
        parseErrors: number;
        bufferSize: number;
    };
    /**
     * Reset parser state (for reuse)
     */
    reset(): void;
}
/**
 * Event type guards for type safety
 */
export declare const isThreadStarted: (event: CodexEvent) => boolean;
export declare const isTurnStarted: (event: CodexEvent) => boolean;
export declare const isTurnCompleted: (event: CodexEvent) => boolean;
export declare const isTurnFailed: (event: CodexEvent) => boolean;
export declare const isItemStarted: (event: CodexEvent) => boolean;
export declare const isItemUpdated: (event: CodexEvent) => boolean;
export declare const isItemCompleted: (event: CodexEvent) => boolean;
/**
 * Extract item type from event (for item.* events)
 */
export declare const getItemType: (event: CodexEvent) => string | null;
/**
 * Check if event represents a file modification
 */
export declare const isFileChange: (event: CodexEvent) => boolean;
/**
 * Check if event represents a command execution
 */
export declare const isCommandExecution: (event: CodexEvent) => boolean;
//# sourceMappingURL=jsonl_parser.d.ts.map