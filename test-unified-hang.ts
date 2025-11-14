#!/usr/bin/env ts-node
/**
 * Test to reproduce the unified codex tool hanging issue
 */

import { handleCodexTool } from './dist/tools/codex.js';
import { LocalRunTool } from './dist/tools/local_run.js';
import { ProcessManager } from './dist/executor/process_manager.js';

async function testUnifiedTool() {
  console.log('🧪 Testing Unified Codex Tool...\n');

  // Create process manager
  const processManager = new ProcessManager(2);

  // Create primitives
  const primitives = {
    _codex_local_run: new LocalRunTool(processManager),
  };

  // Test input
  const input = {
    request: 'list all files in the current directory',
    context: {
      working_dir: process.cwd(),
    },
    explain: true,
  };

  console.log('📝 Input:', JSON.stringify(input, null, 2));
  console.log('\n⏳ Executing...\n');

  try {
    const result = await handleCodexTool(input, primitives);
    console.log('✅ Success!');
    console.log('📊 Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error);
  }

  // Cleanup
  process.exit(0);
}

testUnifiedTool();
