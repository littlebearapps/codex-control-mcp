import { IntentParser } from './dist/core/intent-parser.js';

const parser = new IntentParser();
const input = 'submit to cloud';

console.log('=== DEBUG: Negative Case "submit to cloud" ===');
console.log('Input:', input);
console.log('Expected: confidence < 60% (negative case)');
console.log('');

const result = parser.parse(input);
console.log('Parse result:', JSON.stringify(result, null, 2));
console.log('');

if (result.intent) {
  console.log('Got intent:', result.intent.primitive);
  console.log('Confidence:', result.intent.confidence, '%');

  if (result.intent.confidence >= 60) {
    console.log('❌ Confidence too HIGH (≥60%) for negative case');
  } else {
    console.log('✅ Confidence acceptable (<60%)');
  }
} else {
  console.log('✅ Intent is null (acceptable for negative case)');
}
