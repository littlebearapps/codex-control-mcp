/**
 * Manual Test for Unified Codex Tool
 *
 * Tests the unified codex tool with mock primitives.
 */

import { CodexTool } from './dist/tools/codex.js';

/**
 * Primitive tool map type (for mock creation)
 */
type PrimitiveToolMap = {
  _codex_local_run: any;
  _codex_local_status: any;
  _codex_local_exec: any;
  _codex_local_resume: any;
  _codex_local_results: any;
  _codex_local_wait: any;
  _codex_local_cancel: any;
  _codex_cloud_submit: any;
  _codex_cloud_status: any;
  _codex_cloud_results: any;
  _codex_cloud_wait: any;
  _codex_cloud_cancel: any;
  _codex_cloud_list_environments: any;
  _codex_cloud_github_setup: any;
};

/**
 * Mock primitive tool
 */
class MockPrimitive {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  async execute(params: any) {
    console.log(`  [${this.name}] Called with params:`, params);
    return {
      content: [
        {
          type: 'text',
          text: `Mock result from ${this.name}`,
        },
      ],
      isError: false,
    };
  }
}

/**
 * Create mock primitive tool map
 */
function createMockPrimitives(): PrimitiveToolMap {
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
 * Run test
 */
async function runTest(description: string, input: any) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test: ${description}`);
  console.log('='.repeat(60));
  console.log('Input:', JSON.stringify(input, null, 2));
  console.log('');

  const primitives = createMockPrimitives();
  const codexTool = new CodexTool(primitives);

  try {
    const result = await codexTool.execute(input);
    console.log('Result:', JSON.stringify(result, null, 2));

    // Parse the JSON response
    const parsedResult = JSON.parse(result.content[0].text);
    console.log('\nParsed Response:');
    console.log('  Acknowledged:', parsedResult.acknowledged);
    console.log('  Action:', parsedResult.action);
    console.log('  User Message:', parsedResult.user_message);

    if (parsedResult.error) {
      console.log('  ❌ Error:', parsedResult.error.message);
    } else {
      console.log('  ✅ Success');
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Main test suite
 */
async function main() {
  console.log('Unified Codex Tool - Manual Tests');
  console.log('==================================\n');

  // Test 1: Simple execution request
  await runTest('Simple execution request', {
    request: 'run tests',
  });

  // Test 2: Status check request
  await runTest('Status check request', {
    request: 'check status',
  });

  // Test 3: Dry run mode
  await runTest('Dry run mode', {
    request: 'run tests',
    dry_run: true,
  });

  // Test 4: With explain flag
  await runTest('With explain flag', {
    request: 'run tests',
    dry_run: true,
    explain: true,
  });

  // Test 5: Cloud-specific request
  await runTest('Cloud execution request', {
    request: 'submit task to cloud',
  });

  // Test 6: Task ID specific request
  await runTest('Task ID status check', {
    request: 'check status of T-local-abc123',
  });

  console.log('\n\n' + '='.repeat(60));
  console.log('All tests completed!');
  console.log('='.repeat(60));
}

// Run tests
main().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
