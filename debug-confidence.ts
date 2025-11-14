import { IntentParser } from './dist/core/intent-parser.js';

const parser = new IntentParser();
const input = 'Check the status';

console.log('=== DEBUG: Medium Confidence Scoring ===');
console.log('Input:', input);
console.log('Expected: 60-89% confidence (medium)');
console.log('');

const result = parser.parse(input);
console.log('Parse result:', JSON.stringify(result, null, 2));
console.log('');

if (result.intent) {
  console.log('✅ Intent parsed successfully');
  console.log('Primitive:', result.intent.primitive);
  console.log('Confidence:', result.intent.confidence, '%');

  if (result.intent.confidence >= 60 && result.intent.confidence <= 89) {
    console.log('✅ Confidence is in medium range (60-89%)');
  } else if (result.intent.confidence >= 90) {
    console.log('❌ Confidence too HIGH (≥90%) - should be medium');
  } else {
    console.log('❌ Confidence too LOW (<60%) - should be medium');
  }
} else {
  console.log('❌ Intent is null - parsing failed');
}
