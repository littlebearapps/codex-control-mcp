import { IntentParser } from './dist/core/intent-parser.js';

const parser = new IntentParser();

// Test case that's failing
const input = 'Monitor task T-local-xyz789';
console.log(`\n===== Testing: "${input}" =====\n`);

const result = parser.parse(input);

console.log('Result:', JSON.stringify(result, null, 2));
console.log('\nTop Match:', result.intent?.primitive, '-', result.intent?.confidence, '%');
console.log('Requires Disambiguation:', result.requiresDisambiguation);

if (result.alternatives.length > 0) {
  console.log('\nAlternatives:');
  result.alternatives.forEach((alt, i) => {
    console.log(`  ${i + 1}. ${alt.primitive} - ${alt.confidence}%`);
  });

  if (result.intent && result.alternatives[0]) {
    const diff = Math.abs(result.intent.confidence - result.alternatives[0].confidence);
    console.log(`\nConfidence difference: ${diff} points`);
    console.log(`Threshold: 20 points`);
    console.log(`Should disambiguate: ${diff < 20}`);
  }
}
