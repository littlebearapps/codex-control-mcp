#!/bin/bash
# Setup npm link for mcp-delegator
# This creates a global symlink so all MCP configs can use "mcp-delegator" command

set -e  # Exit on error

echo "🔗 Setting up npm link for mcp-delegator..."
echo ""

# Check we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json not found"
  echo "Please run this script from the mcp-delegator directory"
  exit 1
fi

# Check package name
PACKAGE_NAME=$(node -p "require('./package.json').name")
if [ "$PACKAGE_NAME" != "@littlebearapps/mcp-delegator" ]; then
  echo "❌ Error: Wrong package (found: $PACKAGE_NAME)"
  exit 1
fi

# Ensure we have a build
if [ ! -d "dist" ]; then
  echo "📦 Building TypeScript first..."
  npm run build
  echo ""
fi

# Check if old link exists (migration)
if [ -L "$(npm config get prefix)/lib/node_modules/codex-control-mcp" ]; then
  echo "⚠️  Old codex-control-mcp link found - removing..."
  npm unlink -g codex-control-mcp || true
  echo ""
fi

# Check if already linked
if [ -L "$(npm config get prefix)/lib/node_modules/@littlebearapps/mcp-delegator" ]; then
  echo "⚠️  mcp-delegator is already linked"
  echo "Unlinking and re-linking..."
  npm unlink -g @littlebearapps/mcp-delegator || true
  echo ""
fi

# Create the link
echo "🔗 Creating global symlink..."
npm link

echo ""
echo "✅ npm link setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update MCP configs to use: 'command': 'mcp-delegator'"
echo "2. Restart Claude Code in all working directories"
echo ""
echo "💡 Development workflow:"
echo "  - Edit files in src/"
echo "  - Run: npm run build"
echo "  - Changes propagate to all projects automatically!"
echo ""
echo "🧪 Test the command:"
echo "  mcp-delegator  # Should work globally (MCP server mode)"
echo ""
