#!/usr/bin/env ts-node

/**
 * Token counter for enhanced tool schemas
 * Uses approximate token counting (1 token ≈ 4 characters for English text)
 */

import { CloudSubmitTool, CloudStatusTool, CloudResultsTool, CloudListTasksTool } from '../src/tools/cloud';

function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for English text
  // More accurate would use tiktoken, but this is sufficient for verification
  return Math.ceil(text.length / 4);
}

function analyzeSchema(name: string, schema: any): void {
  const description = schema.description || '';
  const tokens = estimateTokens(description);
  const chars = description.length;

  console.log(`\n${name}:`);
  console.log(`  Characters: ${chars}`);
  console.log(`  Estimated tokens: ${tokens}`);
}

console.log('=== Enhanced Schema Token Analysis ===\n');
console.log('Target: < 3,000 tokens total for all schemas');
console.log('Budget per schema: ~750 tokens (with headroom)');

const schemas = [
  { name: 'CloudSubmitTool', schema: CloudSubmitTool.getSchema() },
  { name: 'CloudStatusTool', schema: CloudStatusTool.getSchema() },
  { name: 'CloudResultsTool', schema: CloudResultsTool.getSchema() },
  { name: 'CloudListTasksTool', schema: CloudListTasksTool.getSchema() },
];

let totalTokens = 0;
let totalChars = 0;

schemas.forEach(({ name, schema }) => {
  analyzeSchema(name, schema);
  const tokens = estimateTokens(schema.description || '');
  const chars = (schema.description || '').length;
  totalTokens += tokens;
  totalChars += chars;
});

console.log('\n=== TOTALS ===');
console.log(`Total characters: ${totalChars}`);
console.log(`Total estimated tokens: ${totalTokens}`);
console.log(`\nBudget: 3,000 tokens`);
console.log(`Used: ${totalTokens} tokens (${Math.round((totalTokens / 3000) * 100)}%)`);
console.log(`Remaining: ${3000 - totalTokens} tokens`);

if (totalTokens < 3000) {
  console.log('\n✅ SUCCESS: Under token budget!');
  process.exit(0);
} else {
  console.log('\n❌ FAILURE: Over token budget!');
  console.log(`Need to reduce by ${totalTokens - 3000} tokens`);
  process.exit(1);
}
