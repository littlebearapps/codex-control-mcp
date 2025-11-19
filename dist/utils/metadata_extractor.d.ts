/**
 * Metadata Extractor for Codex Control MCP
 *
 * Extracts structured metadata from Codex outputs to help AI agents
 * make programmatic decisions without parsing natural language.
 */
export interface CodexMetadata {
    success: boolean;
    exit_code?: number;
    duration_seconds?: number;
    test_results?: {
        passed: number;
        failed: number;
        skipped: number;
        total: number;
        failed_tests?: string[];
    };
    file_operations?: {
        files_changed: string[];
        files_added: string[];
        files_deleted: string[];
        lines_added?: number;
        lines_removed?: number;
    };
    thread_info?: {
        thread_id?: string;
        cache_hit_rate?: number;
        tokens?: {
            input: number;
            cached: number;
            output: number;
            total: number;
        };
    };
    task_status?: {
        status: "pending" | "running" | "completed" | "failed" | "canceled";
        progress_percent?: number;
        task_id?: string;
    };
    error_context?: {
        error_message?: string;
        error_type?: string;
        failed_files?: string[];
        error_locations?: Array<{
            file: string;
            line?: number;
            column?: number;
            message: string;
        }>;
        stack_trace?: string;
        suggestions?: string[];
    };
}
/**
 * Extract metadata from Codex output text
 */
export declare function extractMetadata(output: string, exitCode?: number, threadId?: string, taskId?: string): CodexMetadata;
//# sourceMappingURL=metadata_extractor.d.ts.map