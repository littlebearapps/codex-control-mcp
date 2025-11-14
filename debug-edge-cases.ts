import { IntentParser } from './dist/core/intent-parser.js';

const parser = new IntentParser();

const testCases = [
  { input: 'Run the test suite', expected: '_codex_local_run' },
  { input: 'Execute a comprehensive security audit', expected: '_codex_local_exec' },
  { input: 'Keep working on that refactoring', expected: '_codex_local_resume' },
  { input: 'Show me what completed', expected: '_codex_local_results' },
  { input: 'Run tests in background and create PR if passing', expected: '_codex_cloud_submit' },
  { input: 'Show cloud tasks', expected: '_codex_cloud_status' },
  { input: 'Show me the PR that was created', expected: '_codex_cloud_results' },
];

console.log('=== DEBUG: P3 Edge Cases ===\n');

testCases.forEach(({ input, expected }) => {
  const result = parser.parse(input);
  const actual = result.intent?.primitive || 'null';
  const match = actual === expected ? '✅' : '❌';

  console.log(`${match} "${input}"`);
  console.log(`   Expected: ${expected}`);
  console.log(`   Got: ${actual} (${result.intent?.confidence || 0}%)`);

  if (result.alternatives && result.alternatives.length > 0) {
    console.log(`   Top 3 alternatives:`);
    result.alternatives.slice(0, 3).forEach((alt, i) => {
      console.log(`     ${i + 1}. ${alt.primitive} (${alt.confidence}%)`);
    });
  }
  console.log('');
});
