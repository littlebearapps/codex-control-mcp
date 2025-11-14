#!/bin/bash
# Setup npm link for codex-control-mcp
# This creates a global symlink so all MCP configs can use "codex-control-mcp" command

set -e  # Exit on error

echo "🔗 Setting up npm link for codex-control-mcp..."
echo ""

# Check we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json not found"
  echo "Please run this script from the codex-control directory"
  exit 1
fi

# Check package name
PACKAGE_NAME=$(node -p "require('./package.json').name")
if [ "$PACKAGE_NAME" != "codex-control-mcp" ]; then
  echo "❌ Error: Wrong package (found: $PACKAGE_NAME)"
  exit 1
fi

# Ensure we have a build
if [ ! -d "dist" ]; then
  echo "📦 Building TypeScript first..."
  npm run build
  echo ""
fi

# Check if already linked
if [ -L "$(npm config get prefix)/lib/node_modules/codex-control-mcp" ]; then
  echo "⚠️  codex-control-mcp is already linked"
  echo "Unlinking and re-linking..."
  npm unlink -g codex-control-mcp || true
  echo ""
fi

# Create the link
echo "🔗 Creating global symlink..."
npm link

echo ""
echo "✅ npm link setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update MCP configs to use: 'command': 'codex-control-mcp'"
echo "2. Restart Claude Code in all working directories"
echo ""
echo "💡 Development workflow:"
echo "  - Edit files in src/"
echo "  - Run: npm run build"
echo "  - Changes propagate to all projects automatically!"
echo ""
echo "🧪 Test the command:"
echo "  codex-control-mcp --help  # Should work globally"
echo ""
