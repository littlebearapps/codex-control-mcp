#!/usr/bin/env ts-node
/**
 * Test unified tool using the EXACT MCP server execution path
 */

import { CodexTool } from './dist/tools/codex.js';
import { LocalRunTool } from './dist/tools/local_run.js';
import { ProcessManager } from './dist/executor/process_manager.js';

async function testMCPPath() {
  console.log('🧪 Testing Unified Codex Tool (MCP Server Path)...\n');

  // Create process manager
  const processManager = new ProcessManager(2);

  // Create primitives (minimal set for testing)
  const primitives = {
    _codex_local_run: new LocalRunTool(processManager),
  };

  // Create CodexTool instance (exactly like MCP server does)
  const codexTool = new CodexTool(primitives);

  // Test input (exactly like MCP server receives)
  const params = {
    request: 'list all files in the current directory',
    context: {
      working_dir: process.cwd(),
    },
    explain: true,
  };

  console.log('📝 Input:', JSON.stringify(params, null, 2));
  console.log('\n⏳ Executing via CodexTool.execute()...\n');

  try {
    // This is the EXACT path MCP server takes (line 169 of index.ts):
    // return await this.codexTool.execute(args as any) as any;
    const result = await codexTool.execute(params);

    console.log('✅ Success!');
    console.log('📊 Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error);
  }

  // Cleanup
  process.exit(0);
}

testMCPPath();
