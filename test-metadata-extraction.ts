#!/usr/bin/env ts-node
/**
 * Test Metadata Extraction
 *
 * Validates that structured metadata is correctly extracted from Codex outputs.
 * Tests various scenarios: success, failure, tests, file operations, threading.
 */

import { extractMetadata, type CodexMetadata } from './src/utils/metadata_extractor.ts';

// ANSI colors for output
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';

interface TestCase {
  name: string;
  output: string;
  exitCode?: number;
  threadId?: string;
  taskId?: string;
  expectedMetadata: Partial<CodexMetadata>;
}

const testCases: TestCase[] = [
  // Test 1: Successful test execution with Jest
  {
    name: 'Jest test results (45 passed, 2 failed)',
    output: `
Running tests...
Tests: 2 failed, 45 passed, 47 total
Snapshots: 0 total
Time: 12.45 s

FAIL src/utils.test.ts
  ✗ should handle null input
  ✗ should validate email format

Finished in 12.45s
`,
    exitCode: 1,
    expectedMetadata: {
      success: false,
      exit_code: 1,
      duration_seconds: 12.45,
      test_results: {
        passed: 45,
        failed: 2,
        skipped: 0,
        total: 47,
        failed_tests: ['should handle null input', 'should validate email format'],
      },
    },
  },

  // JSON format: result_set with Jest output in stdout
  {
    name: 'JSON result_set with Jest output',
    output: JSON.stringify({
      version: '3.6',
      schema_id: 'codex/v3.6/result_set/v1',
      tool: '_codex_local_results',
      tool_category: 'result_set',
      status: 'ok',
      data: {
        task_id: 'T-local-json1',
        state: 'completed',
        output: {
          included: true,
          stdout: 'Tests: 1 failed, 12 passed, 13 total\nTime: 3.21 s',
          stderr: '',
          truncated: false,
        },
      },
    }),
    exitCode: 1,
    expectedMetadata: {
      success: false,
      test_results: { passed: 12, failed: 1, total: 13 },
      duration_seconds: 3.21,
    },
  },

  // JSON format: file operations embedded in stdout
  {
    name: 'JSON result_set with file ops',
    output: JSON.stringify({
      version: '3.6',
      schema_id: 'codex/v3.6/result_set/v1',
      tool: '_codex_local_results',
      status: 'ok',
      data: {
        task_id: 'T-local-json2',
        state: 'completed',
        output: {
          included: true,
          stdout: 'modified: src/api.ts\nadded: src/new.ts\ndeleted: src/old.ts\n\n3 files changed, 10 insertions(+), 2 deletions(-)\n',
          stderr: '',
          truncated: false,
        },
      },
    }),
    exitCode: 0,
    expectedMetadata: {
      success: true,
      file_operations: {
        files_changed: ['src/api.ts'],
        files_added: ['src/new.ts'],
        files_deleted: ['src/old.ts'],
        lines_added: 10,
        lines_removed: 2,
      },
    },
  },

  // JSON format: error context in stderr
  {
    name: 'JSON result_set with TypeError in stderr',
    output: JSON.stringify({
      version: '3.6',
      schema_id: 'codex/v3.6/result_set/v1',
      tool: '_codex_local_results',
      status: 'ok',
      data: {
        task_id: 'T-local-json3',
        state: 'failed',
        output: {
          included: true,
          stdout: '',
          stderr: 'TypeError: Cannot read property \'name\' of null\n    at main (main.ts:12:5)\n',
          truncated: false,
        },
      },
    }),
    exitCode: 1,
    expectedMetadata: {
      success: false,
      error_context: {
        error_type: 'TypeError',
        failed_files: ['main.ts'],
        suggestions: expect.any(Array) as any,
      },
    },
  },

  // JSON format: no extractable data
  {
    name: 'JSON result_set no extractable data',
    output: JSON.stringify({
      version: '3.6',
      schema_id: 'codex/v3.6/result_set/v1',
      tool: '_codex_local_results',
      status: 'ok',
      data: { task_id: 'T-local-empty', state: 'completed', output: { included: true, stdout: 'Done.', stderr: '' } },
    }),
    exitCode: 0,
    expectedMetadata: {
      success: true,
    },
  },

  // Test 2: File operations (git diff style)
  {
    name: 'File operations from git diff',
    output: `
modified: src/api.ts
modified: src/utils.ts
added: src/validators.ts
deleted: src/deprecated.ts

3 files changed, 145 insertions(+), 67 deletions(-)
`,
    exitCode: 0,
    expectedMetadata: {
      success: true,
      exit_code: 0,
      file_operations: {
        files_changed: ['src/api.ts', 'src/utils.ts'],
        files_added: ['src/validators.ts'],
        files_deleted: ['src/deprecated.ts'],
        lines_added: 145,
        lines_removed: 67,
      },
    },
  },

  // Test 3: Thread info with token usage
  {
    name: 'Thread info with cache hit rate',
    output: `
Task completed successfully.

"total_token_usage": {
  "input_tokens": 11373,
  "cached_input_tokens": 11008,
  "output_tokens": 245,
  "total_tokens": 11618
}
`,
    exitCode: 0,
    threadId: '019a80a9-7c5b-77c3-b144-260c0e154fa1',
    expectedMetadata: {
      success: true,
      exit_code: 0,
      thread_info: {
        thread_id: '019a80a9-7c5b-77c3-b144-260c0e154fa1',
        cache_hit_rate: 96.8, // 11008/11373 = 96.8%
        tokens: {
          input: 11373,
          cached: 11008,
          output: 245,
          total: 11618,
        },
      },
    },
  },

  // Test 4: Error with file location and suggestions
  {
    name: 'TypeError with file location',
    output: `
Error: Cannot read property 'name' of null
TypeError: Cannot read property 'name' of null
    at processUser (utils.ts:42:15)
    at validateInput (utils.ts:38:10)
    at main (main.ts:12:5)

Stack trace:
  at processUser (utils.ts:42:15)
  at validateInput (utils.ts:38:10)
  at main (main.ts:12:5)
`,
    exitCode: 1,
    expectedMetadata: {
      success: false,
      exit_code: 1,
      error_context: {
        error_message: "Cannot read property 'name' of null",
        error_type: 'TypeError',
        failed_files: ['utils.ts', 'main.ts'],
        error_locations: [
          { file: 'utils.ts', line: 42, column: 15, message: '' },
          { file: 'utils.ts', line: 38, column: 10, message: '' },
          { file: 'main.ts', line: 12, column: 5, message: '' },
        ],
        suggestions: [
          'Check utils.ts, main.ts for errors',
          'Start investigation at utils.ts:42',
          'Check variable types and null/undefined values',
        ],
      },
    },
  },

  // Test 5: Task status with task ID
  {
    name: 'Completed task with ID',
    output: 'Task completed successfully.',
    exitCode: 0,
    taskId: 'T-local-abc123xyz',
    expectedMetadata: {
      success: true,
      exit_code: 0,
      task_status: {
        status: 'completed',
        task_id: 'T-local-abc123xyz',
      },
    },
  },

  // Test 6: Pytest test results
  {
    name: 'Pytest test results (30 passed, 1 failed)',
    output: `
============================= test session starts ==============================
collected 31 items

tests/test_api.py::test_get_user PASSED
tests/test_api.py::test_create_user FAILED
tests/test_utils.py::test_validate PASSED
...

30 passed, 1 failed in 8.23s
`,
    exitCode: 1,
    expectedMetadata: {
      success: false,
      exit_code: 1,
      test_results: {
        passed: 30,
        failed: 1,
        skipped: 0,
        total: 31,
      },
    },
  },

  // Test 7: Multiple error locations with suggestions
  {
    name: 'SyntaxError with specific location',
    output: `
SyntaxError: Unexpected token '}' in JSON at position 42
    at JSON.parse
    at parseConfig (config.ts:15:20)
    at loadSettings (main.ts:8:5)

Failed: Invalid JSON in configuration file
`,
    exitCode: 1,
    expectedMetadata: {
      success: false,
      exit_code: 1,
      error_context: {
        error_message: "Unexpected token '}' in JSON at position 42",
        error_type: 'SyntaxError',
        failed_files: ['config.ts', 'main.ts'],
        suggestions: [
          'Check config.ts, main.ts for errors',
          'Start investigation at config.ts:15',
          'Review syntax near the error location',
        ],
      },
    },
  },
];

/**
 * Deep comparison of metadata fields
 */
function compareMetadata(
  actual: CodexMetadata,
  expected: Partial<CodexMetadata>,
  path: string = ''
): { pass: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const key of Object.keys(expected)) {
    const currentPath = path ? `${path}.${key}` : key;
    const actualValue = (actual as any)[key];
    const expectedValue = (expected as any)[key];

    if (expectedValue === undefined) {
      continue;
    }

    if (typeof expectedValue === 'object' && !Array.isArray(expectedValue)) {
      // Nested object comparison
      if (typeof actualValue !== 'object' || actualValue === null) {
        errors.push(`${currentPath}: Expected object, got ${typeof actualValue}`);
      } else {
        const nestedResult = compareMetadata(actualValue, expectedValue, currentPath);
        errors.push(...nestedResult.errors);
      }
    } else if (Array.isArray(expectedValue)) {
      // Array comparison
      if (!Array.isArray(actualValue)) {
        errors.push(`${currentPath}: Expected array, got ${typeof actualValue}`);
      } else if (actualValue.length < expectedValue.length) {
        errors.push(
          `${currentPath}: Expected at least ${expectedValue.length} items, got ${actualValue.length}`
        );
      } else {
        // Check if expected items are present (subset match)
        for (let i = 0; i < expectedValue.length; i++) {
          if (typeof expectedValue[i] === 'string') {
            // String array - check if expected items are present
            if (!actualValue.includes(expectedValue[i])) {
              errors.push(`${currentPath}[${i}]: Missing expected value "${expectedValue[i]}"`);
            }
          } else if (typeof expectedValue[i] === 'object') {
            // Object array - compare each object
            const nestedResult = compareMetadata(
              actualValue[i],
              expectedValue[i],
              `${currentPath}[${i}]`
            );
            errors.push(...nestedResult.errors);
          }
        }
      }
    } else {
      // Primitive comparison
      if (actualValue !== expectedValue) {
        errors.push(`${currentPath}: Expected ${expectedValue}, got ${actualValue}`);
      }
    }
  }

  return { pass: errors.length === 0, errors };
}

/**
 * Run all tests
 */
function runTests(): void {
  console.log(`${BLUE}=== Metadata Extraction Test Suite ===${RESET}\n`);

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`${YELLOW}Test:${RESET} ${testCase.name}`);

    try {
      const metadata = extractMetadata(
        testCase.output,
        testCase.exitCode,
        testCase.threadId,
        testCase.taskId
      );

      const comparison = compareMetadata(metadata, testCase.expectedMetadata);

      if (comparison.pass) {
        console.log(`${GREEN}✓ PASS${RESET}\n`);
        passed++;
      } else {
        console.log(`${RED}✗ FAIL${RESET}`);
        console.log(`${RED}Errors:${RESET}`);
        for (const error of comparison.errors) {
          console.log(`  ${RED}- ${error}${RESET}`);
        }
        console.log(`${RED}Actual metadata:${RESET}`);
        console.log(JSON.stringify(metadata, null, 2));
        console.log();
        failed++;
      }
    } catch (error) {
      console.log(`${RED}✗ EXCEPTION${RESET}`);
      console.log(`${RED}Error: ${error}${RESET}\n`);
      failed++;
    }
  }

  console.log(`${BLUE}=== Test Summary ===${RESET}`);
  console.log(`${GREEN}Passed: ${passed}${RESET}`);
  console.log(`${RED}Failed: ${failed}${RESET}`);
  console.log(`${BLUE}Total: ${passed + failed}${RESET}`);

  if (failed > 0) {
    console.log(`\n${RED}❌ Some tests failed${RESET}`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}✅ All tests passed!${RESET}`);
    process.exit(0);
  }
}

// Run tests
runTests();
