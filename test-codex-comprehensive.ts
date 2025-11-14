/**
 * Comprehensive E2E Tests for Unified Codex Tool
 *
 * Tests natural language variations, edge cases, and parameter extraction.
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
  expectedPrimitive: string,
  paramCheck?: (params: any) => boolean
) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test: ${name}`);
  console.log('Input:', JSON.stringify(input, null, 2));

  const mocks = createMocks();
  const codexTool = new CodexTool(mocks);

  try {
    const result = await codexTool.execute(input);
    const response = JSON.parse(result.content[0].text);

    if (response.error) {
      console.log(`❌ Error: ${response.error.code} - ${response.error.message}`);
      return false;
    }

    // Check if expected primitive was called
    const mockPrimitive = (mocks as any)[expectedPrimitive];
    if (!mockPrimitive) {
      console.log(`❌ Test error: Unknown expected primitive ${expectedPrimitive}`);
      return false;
    }

    if (mockPrimitive.callCount === 0) {
      console.log(`❌ Expected ${expectedPrimitive} to be called, but it wasn't`);
      console.log('Response:', JSON.stringify(response, null, 2));
      return false;
    }

    // Optional parameter validation
    if (paramCheck && !paramCheck(mockPrimitive.lastParams)) {
      console.log(`❌ Parameter check failed`);
      console.log('Params:', JSON.stringify(mockPrimitive.lastParams, null, 2));
      return false;
    }

    console.log(`✅ PASS - ${expectedPrimitive} called correctly`);
    return true;
  } catch (error) {
    console.log(`❌ Test threw error: ${error}`);
    return false;
  }
}

/**
 * Main test suite
 */
async function main() {
  console.log('Unified Codex Tool - Comprehensive E2E Tests\n');

  const tests: Array<[string, any, string, ((params: any) => boolean)?]> = [
    // ========================================
    // Local Execution - Natural Variations
    // ========================================
    ['Local: run tests', { request: 'run tests' }, '_codex_local_run'],
    ['Local: execute tests', { request: 'execute tests' }, '_codex_local_run'],
    ['Local: run the test suite', { request: 'run the test suite' }, '_codex_local_run'],
    ['Local: build the project', { request: 'build the project' }, '_codex_local_run'],
    ['Local: compile TypeScript', { request: 'compile TypeScript' }, '_codex_local_run'],

    // Analysis variations (should NOT trigger threading)
    ['Local: analyze code', { request: 'analyze code for bugs' }, '_codex_local_run'],
    ['Local: quick analysis', { request: 'quick security analysis' }, '_codex_local_run'],
    ['Local: check for issues', { request: 'check for issues in main.ts' }, '_codex_local_run'],

    // Threading variations (explicit progress intent)
    [
      'Threading: with progress',
      { request: 'analyze codebase with progress' },
      '_codex_local_exec',
    ],
    [
      'Threading: show progress',
      { request: 'review code and show progress' },
      '_codex_local_exec',
    ],
    [
      'Threading: real-time',
      { request: 'investigate bug with real-time updates' },
      '_codex_local_exec',
    ],
    ['Threading: step by step', { request: 'debug step by step' }, '_codex_local_exec'],

    // ========================================
    // Cloud Execution - Natural Variations
    // ========================================
    ['Cloud: in the cloud', { request: 'run tests in the cloud' }, '_codex_cloud_submit'],
    ['Cloud: to cloud', { request: 'submit task to cloud' }, '_codex_cloud_submit'],
    ['Cloud: on cloud', { request: 'execute on cloud' }, '_codex_cloud_submit'],
    ['Cloud: with cloud', { request: 'run with cloud' }, '_codex_cloud_submit'],
    [
      'Cloud: to the cloud',
      { request: 'submit tests to the cloud' },
      '_codex_cloud_submit',
    ],
    [
      'Cloud: comprehensive',
      { request: 'run comprehensive test suite' },
      '_codex_cloud_submit',
    ],
    ['Cloud: full test', { request: 'run full test suite' }, '_codex_cloud_submit'],
    ['Cloud: integration test', { request: 'run integration tests' }, '_codex_cloud_submit'],
    ['Cloud: create PR', { request: 'fix bugs and create PR' }, '_codex_cloud_submit'],

    // ========================================
    // Task ID Extraction
    // ========================================
    [
      'TaskID: status check',
      { request: 'check status of T-local-abc123' },
      '_codex_local_status',
      (params) => params.task_id === 'T-local-abc123',
    ],
    [
      'TaskID: cloud status',
      { request: 'status of T-cloud-xyz789' },
      '_codex_cloud_status',
      (params) => params.task_id === 'T-cloud-xyz789',
    ],
    [
      'TaskID: wait',
      { request: 'wait for T-local-abc123 to complete' },
      '_codex_local_wait',
      (params) => params.task_id === 'T-local-abc123',
    ],
    [
      'TaskID: cancel',
      { request: 'cancel T-cloud-def456' },
      '_codex_cloud_cancel',
      (params) => params.task_id === 'T-cloud-def456',
    ],

    // ========================================
    // Results Fetching - Various Phrasings
    // ========================================
    [
      'Results: get results',
      { request: 'get results for T-local-ghi012' },
      '_codex_local_results',
      (params) => params.task_id === 'T-local-ghi012',
    ],
    [
      'Results: show output',
      { request: 'show output for T-local-abc123' },
      '_codex_local_results',
      (params) => params.task_id === 'T-local-abc123',
    ],
    [
      'Results: fetch results',
      { request: 'fetch results for T-cloud-xyz789' },
      '_codex_cloud_results',
      (params) => params.task_id === 'T-cloud-xyz789',
    ],
    [
      'Results: get cloud results',
      { request: 'get cloud results for T-cloud-ghi012' },
      '_codex_cloud_results',
      (params) => params.task_id === 'T-cloud-ghi012',
    ],
    [
      'Results: retrieve output',
      { request: 'retrieve output for T-cloud-def456' },
      '_codex_cloud_results',
      (params) => params.task_id === 'T-cloud-def456',
    ],

    // ========================================
    // Status Checks - Various Phrasings
    // ========================================
    [
      'Status: check status',
      { request: 'check status of T-local-abc123' },
      '_codex_local_status',
    ],
    [
      'Status: how is it going',
      { request: 'how is T-local-abc123 doing?' },
      '_codex_local_status',
    ],
    [
      'Status: is it done',
      { request: 'is T-cloud-xyz789 done?' },
      '_codex_cloud_status',
    ],
    [
      "Status: what's the status",
      { request: "what's the status of T-local-abc123" },
      '_codex_local_status',
    ],

    // ========================================
    // Wait Operations - Various Phrasings
    // ========================================
    [
      'Wait: wait for completion',
      { request: 'wait for T-local-abc123 to complete' },
      '_codex_local_wait',
    ],
    [
      'Wait: wait until finished',
      { request: 'wait until T-cloud-xyz789 is finished' },
      '_codex_cloud_wait',
    ],
    ['Wait: poll until', { request: 'poll until T-local-abc123 finishes' }, '_codex_local_wait'],

    // ========================================
    // Cancel Operations - Various Phrasings
    // ========================================
    ['Cancel: cancel', { request: 'cancel T-local-abc123' }, '_codex_local_cancel'],
    ['Cancel: stop', { request: 'stop T-cloud-xyz789' }, '_codex_cloud_cancel'],
    ['Cancel: abort', { request: 'abort T-local-def456' }, '_codex_local_cancel'],
    ['Cancel: kill', { request: 'kill T-cloud-ghi012' }, '_codex_cloud_cancel'],
    ['Cancel: terminate', { request: 'terminate T-local-jkl345' }, '_codex_local_cancel'],

    // ========================================
    // Setup & Configuration
    // ========================================
    ['Setup: list environments', { request: 'list environments' }, '_codex_cloud_list_environments'],
    [
      'Setup: list config',
      { request: 'list configuration environments' },
      '_codex_cloud_list_environments',
    ],
    [
      'Setup: show environments',
      { request: 'show available environments' },
      '_codex_cloud_list_environments',
    ],
    [
      'Setup: github',
      { request: 'setup github for https://github.com/myorg/myrepo' },
      '_codex_cloud_github_setup',
    ],
    [
      'Setup: github integration',
      { request: 'configure github integration' },
      '_codex_cloud_github_setup',
    ],
    ['Setup: set up github', { request: 'set up github' }, '_codex_cloud_github_setup'],

    // ========================================
    // Mixed Context Tests
    // ========================================
    [
      'Mixed: cloud with task ID',
      { request: 'check cloud status for T-cloud-abc123' },
      '_codex_cloud_status',
    ],
    [
      'Mixed: local with task ID',
      { request: 'get results for local task T-local-abc123' },
      '_codex_local_results',
    ],
    [
      'Mixed: cloud + progress',
      { request: 'run tests in the cloud with progress' },
      '_codex_cloud_submit',
    ],
  ];

  let passed = 0;
  let failed = 0;

  for (const [name, input, expected, paramCheck] of tests) {
    const result = await runTest(name, input, expected, paramCheck);
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
