/**
 * Error Case Tests for Unified Codex Tool
 *
 * Tests error handling, edge cases, and malformed inputs.
 */

import { CodexTool } from './dist/tools/codex.js';

/**
 * Mock primitive tool
 */
class MockPrimitive {
  name: string;
  callCount: number = 0;
  lastParams: any = null;

  constructor(name: string) {
    this.name = name;
  }

  async execute(params: any) {
    this.callCount++;
    this.lastParams = params;
    return {
      content: [{ type: 'text', text: `Result from ${this.name}` }],
      isError: false,
    };
  }
}

/**
 * Create mock primitives
 */
function createMocks() {
  return {
    _codex_local_run: new MockPrimitive('local_run'),
    _codex_local_status: new MockPrimitive('local_status'),
    _codex_local_exec: new MockPrimitive('local_exec'),
    _codex_local_resume: new MockPrimitive('local_resume'),
    _codex_local_results: new MockPrimitive('local_results'),
    _codex_local_wait: new MockPrimitive('local_wait'),
    _codex_local_cancel: new MockPrimitive('local_cancel'),
    _codex_cloud_submit: new MockPrimitive('cloud_submit'),
    _codex_cloud_status: new MockPrimitive('cloud_status'),
    _codex_cloud_results: new MockPrimitive('cloud_results'),
    _codex_cloud_wait: new MockPrimitive('cloud_wait'),
    _codex_cloud_cancel: new MockPrimitive('cloud_cancel'),
    _codex_cloud_list_environments: new MockPrimitive('list_environments'),
    _codex_cloud_github_setup: new MockPrimitive('github_setup'),
  };
}

/**
 * Run single test
 */
async function runTest(
  name: string,
  input: any,
  expectError: boolean,
  errorCheck?: (response: any) => boolean
) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test: ${name}`);
  console.log('Input:', JSON.stringify(input, null, 2));

  const mocks = createMocks();
  const codexTool = new CodexTool(mocks);

  try {
    const result = await codexTool.execute(input);
    const response = JSON.parse(result.content[0].text);

    if (expectError) {
      // Should have error
      if (response.error) {
        if (errorCheck && !errorCheck(response)) {
          console.log(`❌ Error check failed`);
          console.log('Response:', JSON.stringify(response, null, 2));
          return false;
        }
        console.log(`✅ PASS - Error handled correctly: ${response.error.code}`);
        return true;
      } else {
        console.log(`❌ Expected error but got success`);
        console.log('Response:', JSON.stringify(response, null, 2));
        return false;
      }
    } else {
      // Should succeed
      if (response.error) {
        console.log(`❌ Unexpected error: ${response.error.code}`);
        console.log('Response:', JSON.stringify(response, null, 2));
        return false;
      }
      console.log(`✅ PASS - Handled gracefully`);
      return true;
    }
  } catch (error) {
    if (expectError) {
      console.log(`✅ PASS - Exception thrown as expected: ${error}`);
      return true;
    } else {
      console.log(`❌ Unexpected exception: ${error}`);
      return false;
    }
  }
}

/**
 * Main test suite
 */
async function main() {
  console.log('Unified Codex Tool - Error Case Tests\n');

  const tests: Array<[string, any, boolean, ((response: any) => boolean)?]> = [
    // ========================================
    // Missing Required Parameters
    // ========================================
    [
      'Missing: empty request',
      { request: '' },
      false, // Empty string defaults to execution
    ],
    [
      'Missing: whitespace only',
      { request: '   ' },
      false, // Whitespace defaults to execution
    ],

    // ========================================
    // Invalid Task IDs
    // ========================================
    [
      'Invalid: malformed task ID',
      { request: 'check status of T-invalid' },
      true, // Task ID doesn't match pattern
      (r) => r.error.code === 'ROUTING_ERROR',
    ],
    [
      'Invalid: incomplete task ID',
      { request: 'wait for T-local-' },
      true, // Incomplete task ID
      (r) => r.error.code === 'ROUTING_ERROR',
    ],
    [
      'Invalid: wrong prefix',
      { request: 'cancel TASK-abc123' },
      false, // No task ID extracted, defaults to execution
    ],

    // ========================================
    // Ambiguous Inputs (No Task ID for Task-Specific Operations)
    // ========================================
    [
      'Ambiguous: check status (no task ID)',
      { request: 'check status' },
      true, // Error: no recent tasks to check
      (r) => r.error.code === 'ROUTING_ERROR' && r.error.message.includes('No recent tasks'),
    ],
    [
      'Ambiguous: wait (no task ID)',
      { request: 'wait for completion' },
      true, // Error: no recent tasks to wait for
      (r) => r.error.code === 'ROUTING_ERROR' && r.error.message.includes('No recent tasks'),
    ],
    [
      'Ambiguous: cancel (no task ID)',
      { request: 'cancel task' },
      false, // "cancel task" defaults to execution (no cancel keyword match without task ID context)
    ],
    [
      'Ambiguous: get results (no task ID)',
      { request: 'get results' },
      true, // Error: no recent tasks to get results from
      (r) => r.error.code === 'ROUTING_ERROR' && r.error.message.includes('No recent tasks'),
    ],

    // ========================================
    // Special Characters
    // ========================================
    [
      'Special: emoji in request',
      { request: 'run tests 🚀' },
      false, // Should handle gracefully
    ],
    [
      'Special: unicode characters',
      { request: 'run tests with ñ and 中文' },
      false, // Should handle gracefully
    ],
    [
      'Special: newlines',
      { request: 'run tests\nand build\nand deploy' },
      false, // Should handle gracefully
    ],
    [
      'Special: quotes',
      { request: 'run "tests" and \'build\'' },
      false, // Should handle gracefully
    ],

    // ========================================
    // Edge Cases with Task IDs
    // ========================================
    [
      'Edge: multiple task IDs',
      { request: 'check T-local-abc123 and T-cloud-xyz789' },
      false, // Should extract first task ID
    ],
    [
      'Edge: task ID in middle',
      { request: 'please check status of T-local-abc123 for me' },
      false, // Should extract task ID correctly
    ],
    [
      'Edge: task ID with uppercase',
      { request: 'cancel T-LOCAL-ABC123' },
      false, // Task ID extraction should be case-insensitive
    ],

    // ========================================
    // Conflicting Intent Keywords
    // ========================================
    [
      'Conflict: run and cancel',
      { request: 'run tests then cancel T-local-abc123' },
      false, // Should extract task ID and route to cancel (priority)
    ],
    [
      'Conflict: cloud and local',
      { request: 'run tests locally in the cloud' },
      false, // Cloud should win (stronger keyword)
    ],

    // ========================================
    // Very Long Inputs
    // ========================================
    [
      'Long: 100-word request',
      { request: 'run tests ' + 'and fix bugs '.repeat(50) },
      false, // Should handle gracefully
    ],

    // ========================================
    // Dry Run Mode
    // ========================================
    [
      'Dry run: valid request',
      { request: 'run tests', dry_run: true },
      false, // Should return routing decision without error
    ],
    [
      'Dry run: with task ID',
      { request: 'check status of T-local-abc123', dry_run: true },
      false, // Should return routing decision
    ],

    // ========================================
    // Explain Mode
    // ========================================
    [
      'Explain: valid request',
      { request: 'run tests in the cloud', explain: true },
      false, // Should include decision trace
    ],

    // ========================================
    // Combined Modes
    // ========================================
    [
      'Combined: dry run + explain',
      { request: 'analyze code with progress', dry_run: true, explain: true },
      false, // Should work together
    ],

    // ========================================
    // Extreme Edge Cases
    // ========================================
    [
      'Extreme: single character',
      { request: 'a' },
      false, // Should default to execution
    ],
    [
      'Extreme: numbers only',
      { request: '123456' },
      false, // Should default to execution
    ],
    [
      'Extreme: special chars only',
      { request: '!@#$%^&*()' },
      false, // Should default to execution
    ],
  ];

  let passed = 0;
  let failed = 0;

  for (const [name, input, expectError, errorCheck] of tests) {
    const result = await runTest(name, input, expectError, errorCheck);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log(`🎉 Pass rate: 100%`);
  } else {
    console.log(`Pass rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  }
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Test suite crashed:', error);
  process.exit(1);
});
