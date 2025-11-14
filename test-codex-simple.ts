/**
 * Simple E2E Test for Unified Codex Tool
 *
 * Simplified test to debug routing issues.
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
    console.log(`  ✓ ${this.name} called with:`, JSON.stringify(params, null, 2));
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
async function runTest(name: string, input: any, expectedPrimitive: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test: ${name}`);
  console.log('Input:', JSON.stringify(input, null, 2));

  const mocks = createMocks();
  const codexTool = new CodexTool(mocks);

  try {
    const result = await codexTool.execute(input);
    const response = JSON.parse(result.content[0].text);

    console.log(`Response acknowledged: ${response.acknowledged}`);
    console.log(`Response action: ${response.action}`);

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

    console.log(`✅ PASS - ${expectedPrimitive} was called correctly`);
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
  console.log('Unified Codex Tool - Simplified E2E Tests\n');

  const tests = [
    // Local execution
    ['Simple execution', { request: 'run tests' }, '_codex_local_run'],
    ['Code analysis', { request: 'analyze code for bugs' }, '_codex_local_run'],
    ['Start with threading', { request: 'start new task with progress' }, '_codex_local_exec'],
    ['Status with task ID', { request: 'check status of T-local-abc123' }, '_codex_local_status'],
    ['Wait for task', { request: 'wait for T-local-xyz456' }, '_codex_local_wait'],
    ['Cancel task', { request: 'cancel T-local-def789' }, '_codex_local_cancel'],
    ['Get results', { request: 'get results for T-local-ghi012' }, '_codex_local_results'],

    // Cloud execution
    ['Cloud submission', { request: 'run tests in the cloud' }, '_codex_cloud_submit'],
    ['Cloud status', { request: 'check cloud status for T-cloud-abc123' }, '_codex_cloud_status'],
    ['Cloud wait', { request: 'wait for cloud task T-cloud-xyz789' }, '_codex_cloud_wait'],
    ['Cloud cancel', { request: 'cancel cloud task T-cloud-def456' }, '_codex_cloud_cancel'],
    ['Cloud results', { request: 'get cloud results for T-cloud-ghi012' }, '_codex_cloud_results'],

    // Configuration
    ['List environments', { request: 'list environments' }, '_codex_cloud_list_environments'],
    ['GitHub setup', { request: 'setup github for https://github.com/myorg/myrepo' }, '_codex_cloud_github_setup'],
  ];

  let passed = 0;
  let failed = 0;

  for (const [name, input, expected] of tests) {
    const result = await runTest(name as string, input, expected as string);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`Pass rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Test suite crashed:', error);
  process.exit(1);
});
