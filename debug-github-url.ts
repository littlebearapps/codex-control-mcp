import { IntentParser } from "./dist/core/intent-parser.js";

const parser = new IntentParser();
const input = "Set up GitHub for https://github.com/myorg/myrepo";

console.log("=== DEBUG: GitHub URL Extraction ===");
console.log("Input:", input);
console.log("");

const result = parser.parse(input);
console.log("Parse result:", JSON.stringify(result, null, 2));
console.log("");

if (result.intent) {
  console.log("✅ Intent parsed successfully");
  console.log("Primitive:", result.intent.primitive);
  console.log("Confidence:", result.intent.confidence);
  console.log("Extracted params:", result.intent.extractedParams);
} else {
  console.log("❌ Intent is null - parsing failed");
  console.log("Requires disambiguation?", result.requiresDisambiguation);
  if (result.alternatives && result.alternatives.length > 0) {
    console.log("Alternatives:");
    result.alternatives.forEach((alt, i) => {
      console.log(`  ${i + 1}. ${alt.primitive} (${alt.confidence}%)`);
    });
  }
}
