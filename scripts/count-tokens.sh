#!/bin/bash

# Extract and count tokens for each enhanced schema description
# Approximation: 1 token ≈ 4 characters for English text

echo "=== Enhanced Schema Token Analysis ==="
echo ""
echo "Target: < 3,000 tokens total for all schemas"
echo "Budget per schema: ~750 tokens (with headroom)"
echo ""

# CloudSubmitTool description (lines 251-283)
submit_desc=$(sed -n '251,283p' /Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control/src/tools/cloud.ts | sed '1s/.*description: `//; $s/`,.*//')
submit_chars=$(echo "$submit_desc" | wc -c | xargs)
submit_tokens=$((submit_chars / 4))

echo "CloudSubmitTool:"
echo "  Characters: $submit_chars"
echo "  Estimated tokens: $submit_tokens"
echo ""

# CloudStatusTool description (lines 401-421)
status_desc=$(sed -n '401,421p' /Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control/src/tools/cloud.ts | sed '1s/.*description: `//; $s/`,.*//')
status_chars=$(echo "$status_desc" | wc -c | xargs)
status_tokens=$((status_chars / 4))

echo "CloudStatusTool:"
echo "  Characters: $status_chars"
echo "  Estimated tokens: $status_tokens"
echo ""

# CloudResultsTool description (lines 525-551)
results_desc=$(sed -n '525,551p' /Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control/src/tools/cloud.ts | sed '1s/.*description: `//; $s/`,.*//')
results_chars=$(echo "$results_desc" | wc -c | xargs)
results_tokens=$((results_chars / 4))

echo "CloudResultsTool:"
echo "  Characters: $results_chars"
echo "  Estimated tokens: $results_tokens"
echo ""

# CloudListTasksTool description (lines 705-739)
list_desc=$(sed -n '705,739p' /Users/nathanschram/claude-code-tools/lba/apps/mcp-servers/codex-control/src/tools/cloud.ts | sed '1s/.*description: `//; $s/`,.*//')
list_chars=$(echo "$list_desc" | wc -c | xargs)
list_tokens=$((list_chars / 4))

echo "CloudListTasksTool:"
echo "  Characters: $list_chars"
echo "  Estimated tokens: $list_tokens"
echo ""

# Calculate totals
total_chars=$((submit_chars + status_chars + results_chars + list_chars))
total_tokens=$((total_chars / 4))

echo "=== TOTALS ==="
echo "Total characters: $total_chars"
echo "Total estimated tokens: $total_tokens"
echo ""
echo "Budget: 3,000 tokens"
echo "Used: $total_tokens tokens ($((total_tokens * 100 / 3000))%)"
echo "Remaining: $((3000 - total_tokens)) tokens"
echo ""

if [ $total_tokens -lt 3000 ]; then
  echo "✅ SUCCESS: Under token budget!"
  exit 0
else
  echo "❌ FAILURE: Over token budget!"
  echo "Need to reduce by $((total_tokens - 3000)) tokens"
  exit 1
fi
