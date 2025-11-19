/**
 * JSONL Parser for Codex CLI Event Stream
 *
 * Parses newline-delimited JSON events from `codex exec --json` output.
 * Implements tolerant parsing with line buffering to handle:
 * - Partial lines (chunks may split mid-line)
 * - Non-JSON stderr output (warnings, debug logs)
 * - Malformed events (graceful degradation)
 */
export class JSONLParser {
    buffer = "";
    lineCount = 0;
    parseErrors = 0;
    /**
     * Feed a chunk of output from codex exec --json
     * Returns array of successfully parsed events
     */
    feed(chunk) {
        this.buffer += chunk;
        const lines = this.buffer.split("\n");
        // Keep incomplete last line in buffer
        this.buffer = lines.pop() || "";
        const events = [];
        for (const line of lines) {
            this.lineCount++;
            // Skip empty lines
            if (!line.trim()) {
                continue;
            }
            try {
                const event = JSON.parse(line);
                events.push(event);
            }
            catch (parseError) {
                this.parseErrors++;
                // Log non-JSON lines (likely stderr) but don't crash
                console.warn(`[JSONLParser] Non-JSON line ${this.lineCount}:`, line.substring(0, 100));
            }
        }
        return events;
    }
    /**
     * Flush remaining buffer (call when stream ends)
     * Returns final event if buffer contains complete JSON
     */
    flush() {
        if (!this.buffer.trim()) {
            return null;
        }
        try {
            const event = JSON.parse(this.buffer);
            this.buffer = "";
            return event;
        }
        catch (parseError) {
            console.warn("[JSONLParser] Incomplete buffer at end of stream:", this.buffer.substring(0, 100));
            this.buffer = "";
            return null;
        }
    }
    /**
     * Get parsing statistics
     */
    getStats() {
        return {
            linesProcessed: this.lineCount,
            parseErrors: this.parseErrors,
            bufferSize: this.buffer.length,
        };
    }
    /**
     * Reset parser state (for reuse)
     */
    reset() {
        this.buffer = "";
        this.lineCount = 0;
        this.parseErrors = 0;
    }
}
/**
 * Event type guards for type safety
 */
export const isThreadStarted = (event) => event.type === "thread.started";
export const isTurnStarted = (event) => event.type === "turn.started";
export const isTurnCompleted = (event) => event.type === "turn.completed";
export const isTurnFailed = (event) => event.type === "turn.failed";
export const isItemStarted = (event) => event.type === "item.started";
export const isItemUpdated = (event) => event.type === "item.updated";
export const isItemCompleted = (event) => event.type === "item.completed";
/**
 * Extract item type from event (for item.* events)
 */
export const getItemType = (event) => {
    if (!event.type.startsWith("item.")) {
        return null;
    }
    return event.data?.type || null;
};
/**
 * Check if event represents a file modification
 */
export const isFileChange = (event) => {
    return getItemType(event) === "file_change";
};
/**
 * Check if event represents a command execution
 */
export const isCommandExecution = (event) => {
    return getItemType(event) === "command_execution";
};
//# sourceMappingURL=jsonl_parser.js.map