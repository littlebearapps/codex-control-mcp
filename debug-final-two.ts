import { IntentParser } from "./dist/core/intent-parser.js";

const parser = new IntentParser();

const testCases = [
  { input: "What tasks are active?", expected: "_codex_local_status" },
  {
    input: "Run the full test suite in the cloud",
    expected: "_codex_cloud_submit",
  },
];

console.log("=== DEBUG: Final 2 Failures ===\n");

testCases.forEach(({ input, expected }) => {
  const result = parser.parse(input);
  const actual = result.intent?.primitive || "null";
  const match = actual === expected ? "✅" : "❌";

  console.log(`${match} "${input}"`);
  console.log(`   Expected: ${expected}`);
  console.log(`   Got: ${actual} (${result.intent?.confidence || 0}%)`);
  console.log(`   Reasoning: ${result.intent?.reasoning}`);

  if (result.alternatives && result.alternatives.length > 0) {
    console.log(`   Top 5 alternatives:`);
    result.alternatives.slice(0, 5).forEach((alt, i) => {
      console.log(
        `     ${i + 1}. ${alt.primitive} (${alt.confidence}%) - ${alt.reasoning}`,
      );
    });
  }
  console.log("");
});
