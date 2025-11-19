const input = "Set up GitHub for https://github.com/myorg/myrepo";
const normalized = input.toLowerCase();

console.log("=== Keyword Matching Test ===");
console.log("Input:", input);
console.log("Normalized:", normalized);
console.log("");

const keywords = [
  "setup github",
  "set up github",
  "github integration",
  "configure github",
  "github guide",
];

keywords.forEach((keyword) => {
  const matches = normalized.includes(keyword);
  console.log(`"${keyword}" matches? ${matches ? "✅ YES" : "❌ NO"}`);
});
