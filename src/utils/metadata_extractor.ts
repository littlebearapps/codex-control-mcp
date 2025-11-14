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

  // Test execution metadata
  test_results?: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    failed_tests?: string[];  // Names of failed tests
  };

  // File operation metadata
  file_operations?: {
    files_changed: string[];
    files_added: string[];
    files_deleted: string[];
    lines_added?: number;
    lines_removed?: number;
  };

  // Thread/SDK metadata
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

  // Task status metadata
  task_status?: {
    status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
    progress_percent?: number;
    task_id?: string;
  };

  // Error/failure metadata
  error_context?: {
    error_message?: string;
    error_type?: string;
    failed_files?: string[];  // Files where errors occurred
    error_locations?: Array<{
      file: string;
      line?: number;
      column?: number;
      message: string;
    }>;
    stack_trace?: string;
    suggestions?: string[];  // Where to look / what to fix
  };
}

/**
 * Extract metadata from Codex output text
 */
export function extractMetadata(
  output: string,
  exitCode?: number,
  threadId?: string,
  taskId?: string
): CodexMetadata {
  const metadata: CodexMetadata = {
    success: exitCode === 0 || exitCode === undefined,
    exit_code: exitCode,
  };

  // Extract test results
  const testResults = extractTestResults(output);
  if (testResults) {
    metadata.test_results = testResults;
    // Override success if tests failed
    if (testResults.failed > 0) {
      metadata.success = false;
    }
  }

  // Extract file operations
  const fileOps = extractFileOperations(output);
  if (fileOps && (fileOps.files_changed.length > 0 || fileOps.files_added.length > 0 || fileOps.files_deleted.length > 0)) {
    metadata.file_operations = fileOps;
  }

  // Extract thread info
  if (threadId) {
    metadata.thread_info = extractThreadInfo(output, threadId);
  }

  // Extract task status
  if (taskId) {
    metadata.task_status = {
      status: metadata.success ? 'completed' : 'failed',
      task_id: taskId,
    };
  }

  // Extract error context if failed
  if (!metadata.success || exitCode !== 0) {
    metadata.error_context = extractErrorContext(output, exitCode);
  }

  // Extract duration
  const duration = extractDuration(output);
  if (duration !== null) {
    metadata.duration_seconds = duration;
  }

  return metadata;
}

/**
 * Extract test results from output
 */
function extractTestResults(output: string): CodexMetadata['test_results'] | null {
  // Common test result patterns
  const patterns = [
    // Jest: "Tests: 2 failed, 45 passed, 47 total"
    /Tests:\s*(\d+)\s*failed,\s*(\d+)\s*passed,\s*(\d+)\s*total/i,
    // Pytest: "45 passed, 2 failed in 12.3s"
    /(\d+)\s*passed,\s*(\d+)\s*failed/i,
    // Mocha: "45 passing, 2 failing"
    /(\d+)\s*passing,\s*(\d+)\s*failing/i,
    // Generic: "✓ 45 | ✗ 2"
    /✓\s*(\d+)\s*\|\s*✗\s*(\d+)/,
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = output.match(patterns[i]);
    if (match) {
      let failed: number;
      let passed: number;

      // Jest pattern captures failed first, passed second
      if (i === 0) {
        failed = parseInt(match[1], 10);
        passed = parseInt(match[2], 10);
      }
      // Pytest and Mocha patterns capture passed first, failed second
      else {
        passed = parseInt(match[1], 10);
        failed = parseInt(match[2], 10);
      }

      const total = match[3] ? parseInt(match[3], 10) : passed + failed;

      return {
        passed,
        failed,
        skipped: total - passed - failed,
        total,
        failed_tests: extractFailedTestNames(output),
      };
    }
  }

  return null;
}

/**
 * Extract names of failed tests
 */
function extractFailedTestNames(output: string): string[] {
  const failedTests: string[] = [];

  // Pattern: "✗ test name" or "FAIL test name"
  const patterns = [
    /(?:✗|FAIL|Failed:)\s+(.+?)(?:\n|$)/g,
    /\d+\)\s+(.+?)\n/g,  // Numbered list: "1) test name"
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(output)) !== null) {
      const testName = match[1].trim();
      if (testName && !failedTests.includes(testName)) {
        failedTests.push(testName);
      }
    }
  }

  return failedTests.slice(0, 10);  // Limit to 10 failed tests
}

/**
 * Extract file operations from output
 */
function extractFileOperations(output: string): CodexMetadata['file_operations'] {
  const fileOps: CodexMetadata['file_operations'] = {
    files_changed: [],
    files_added: [],
    files_deleted: [],
  };

  // Git-style diff patterns
  const modifiedPattern = /modified:\s+(.+?)(?:\n|$)/gi;
  const addedPattern = /(?:new file|added):\s+(.+?)(?:\n|$)/gi;
  const deletedPattern = /deleted:\s+(.+?)(?:\n|$)/gi;

  let match;

  while ((match = modifiedPattern.exec(output)) !== null) {
    fileOps.files_changed.push(match[1].trim());
  }

  while ((match = addedPattern.exec(output)) !== null) {
    fileOps.files_added.push(match[1].trim());
  }

  while ((match = deletedPattern.exec(output)) !== null) {
    fileOps.files_deleted.push(match[1].trim());
  }

  // Extract lines added/removed
  const linesMatch = output.match(/(\d+)\s*insertions?\(\+\),\s*(\d+)\s*deletions?\(-\)/i);
  if (linesMatch) {
    fileOps.lines_added = parseInt(linesMatch[1], 10);
    fileOps.lines_removed = parseInt(linesMatch[2], 10);
  }

  return fileOps;
}

/**
 * Extract thread info from output
 */
function extractThreadInfo(output: string, threadId: string): CodexMetadata['thread_info'] {
  const threadInfo: CodexMetadata['thread_info'] = {
    thread_id: threadId,
  };

  // Extract token usage from Codex SDK output
  const tokenPattern = /"total_token_usage":\s*\{[^}]*"input_tokens":\s*(\d+),[^}]*"cached_input_tokens":\s*(\d+),[^}]*"output_tokens":\s*(\d+),[^}]*"total_tokens":\s*(\d+)/;
  const tokenMatch = output.match(tokenPattern);

  if (tokenMatch) {
    const input = parseInt(tokenMatch[1], 10);
    const cached = parseInt(tokenMatch[2], 10);
    const outputTokens = parseInt(tokenMatch[3], 10);
    const total = parseInt(tokenMatch[4], 10);

    threadInfo.tokens = {
      input,
      cached,
      output: outputTokens,
      total,
    };

    // Calculate cache hit rate
    if (input > 0) {
      threadInfo.cache_hit_rate = Math.round((cached / input) * 1000) / 10;  // 1 decimal place
    }
  }

  return threadInfo;
}

/**
 * Extract error context from failed output
 */
function extractErrorContext(output: string, exitCode?: number): CodexMetadata['error_context'] {
  const errorContext: CodexMetadata['error_context'] = {};

  // Extract error message (first line of error)
  const errorPatterns = [
    /Error:\s*(.+?)(?:\n|$)/i,
    /Exception:\s*(.+?)(?:\n|$)/i,
    /Failed:\s*(.+?)(?:\n|$)/i,
    /✗\s*(.+?)(?:\n|$)/,
  ];

  for (const pattern of errorPatterns) {
    const match = output.match(pattern);
    if (match) {
      errorContext.error_message = match[1].trim();
      break;
    }
  }

  // Extract error type
  const typeMatch = output.match(/(\w+Error|\w+Exception):/);
  if (typeMatch) {
    errorContext.error_type = typeMatch[1];
  }

  // Extract error locations (file:line:column)
  const errorLocations: Array<{ file: string; line?: number; column?: number; message: string }> = [];
  // Use [ \t] instead of \s to avoid matching newlines in the separator
  const locationPattern = /(?:at\s+)?([\/\w.-]+\.(?:ts|js|tsx|jsx|py|go|rs)):(\d+)(?::(\d+))?[:,\t ]*(.+?)(?:\n|$)/gi;
  const seen = new Set<string>(); // Track unique locations

  let match;
  while ((match = locationPattern.exec(output)) !== null) {
    const file = match[1];
    const line = parseInt(match[2], 10);
    const column = match[3] ? parseInt(match[3], 10) : undefined;
    let message = match[4].trim();

    // Filter out noise messages
    const noisePatterns = [
      /^Stack trace:?$/i,
      /^at\s+$/,
      /^\d+$/,  // Just a number
      /^[\s:]+$/,  // Just whitespace/colons
      /^[)]+$/,  // Just closing parens
    ];

    const isNoise = noisePatterns.some(pattern => pattern.test(message));
    if (isNoise) {
      message = '';  // Clear noise messages
    }

    // Create unique key for deduplication
    const key = `${file}:${line}:${column || 0}`;

    // Only add if not seen before
    if (!seen.has(key)) {
      seen.add(key);
      errorLocations.push({
        file,
        line,
        column,
        message,
      });
    }
  }

  if (errorLocations.length > 0) {
    errorContext.error_locations = errorLocations.slice(0, 5);  // Limit to 5 locations
    errorContext.failed_files = [...new Set(errorLocations.map(loc => loc.file))];
  }

  // Extract stack trace (first 5 lines)
  const stackMatch = output.match(/(?:Stack trace|Traceback)[:\s]*\n((?:.*\n){1,5})/i);
  if (stackMatch) {
    errorContext.stack_trace = stackMatch[1].trim();
  }

  // Generate suggestions based on error context
  errorContext.suggestions = generateSuggestions(errorContext, output, exitCode);

  return errorContext;
}

/**
 * Generate suggestions for where to look / what to fix
 */
function generateSuggestions(errorContext: CodexMetadata['error_context'], output: string, exitCode?: number): string[] {
  const suggestions: string[] = [];

  // File-specific suggestions
  if (errorContext?.failed_files && errorContext.failed_files.length > 0) {
    suggestions.push(`Check ${errorContext.failed_files.join(', ')} for errors`);
  }

  // Error location suggestions
  if (errorContext?.error_locations && errorContext.error_locations.length > 0) {
    const firstError = errorContext.error_locations[0];
    suggestions.push(`Start investigation at ${firstError.file}:${firstError.line}`);
  }

  // Test failure suggestions
  if (output.includes('test') && output.includes('fail')) {
    suggestions.push('Run failing tests individually to isolate issues');
    suggestions.push('Check test setup and teardown logic');
  }

  // Common error patterns
  if (errorContext?.error_type === 'TypeError') {
    suggestions.push('Check variable types and null/undefined values');
  } else if (errorContext?.error_type === 'SyntaxError') {
    suggestions.push('Review syntax near the error location');
  } else if (errorContext?.error_type === 'ReferenceError') {
    suggestions.push('Verify all variables and imports are defined');
  }

  // Exit code suggestions
  if (exitCode === 1) {
    suggestions.push('Review command output for specific error messages');
  } else if (exitCode && exitCode > 1) {
    suggestions.push(`Exit code ${exitCode} indicates specific failure type - check documentation`);
  }

  return suggestions.slice(0, 3);  // Limit to 3 suggestions
}

/**
 * Extract duration from output
 */
function extractDuration(output: string): number | null {
  // Patterns: "Finished in 12.3s", "Duration: 12.3s", "Time: 12.3 sec"
  const patterns = [
    /(?:finished|duration|time|took)[\s:]+(\d+\.?\d*)\s*(?:s|sec|seconds)/i,
    /(\d+\.?\d*)\s*(?:s|sec|seconds)/,
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }
  }

  return null;
}
