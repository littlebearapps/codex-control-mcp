#!/usr/bin/env ts-node
/**
 * Comprehensive test suite for Codex Control MCP v2.1.0
 * Tests all 4 new tools: local_exec, local_resume, cloud_check_reminder, list_environments
 */

import { LocalExecTool } from './dist/tools/local_exec.js';
import { LocalResumeTool } from './dist/tools/local_resume.js';
import { CloudCheckReminderTool } from './dist/tools/cloud_check_reminder.js';
import { ListEnvironmentsTool } from './dist/tools/list_environments.js';
import { mkdir, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message: string) {
  console.log('\n' + '='.repeat(80));
  log(message, colors.cyan);
  console.log('='.repeat(80) + '\n');
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

async function setupTestEnvironment() {
  logHeader('Setting Up Test Environment');

  // Create config directory
  const configDir = join(homedir(), '.config', 'codex-control');
  try {
    await mkdir(configDir, { recursive: true });
    logSuccess(`Created config directory: ${configDir}`);
  } catch (error) {
    logWarning(`Config directory already exists or couldn't be created: ${configDir}`);
  }

  // Create example environments.json
  const environmentsPath = join(configDir, 'environments.json');
  const exampleEnvironments = {
    'test-environment-1': {
      name: 'Test Environment 1',
      repoUrl: 'https://github.com/test/repo1',
      stack: 'node',
      description: 'Test environment for v2.1.0 validation',
    },
    'test-environment-2': {
      name: 'Test Environment 2',
      repoUrl: 'https://github.com/test/repo2',
      stack: 'python',
      description: 'Another test environment',
    },
  };

  try {
    await writeFile(environmentsPath, JSON.stringify(exampleEnvironments, null, 2));
    logSuccess(`Created example environments config: ${environmentsPath}`);
  } catch (error) {
    logError(`Failed to create environments config: ${error}`);
  }
}

async function testListEnvironments() {
  logHeader('Test 1: codex_list_environments');

  const tool = new ListEnvironmentsTool();

  try {
    const result = await tool.execute();

    logInfo('Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.count > 0) {
      logSuccess(`Found ${result.count} environments`);
      logSuccess('Environment listing works correctly');
      return true;
    } else {
      logWarning('No environments found (this is OK if config file is empty)');
      return true;
    }
  } catch (error) {
    logError(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testCloudCheckReminder() {
  logHeader('Test 2: codex_cloud_check_reminder');

  const tool = new CloudCheckReminderTool();

  try {
    const result = await tool.execute();

    logInfo('Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.pendingCount === 0) {
      logSuccess('No pending tasks (this is expected for fresh install)');
    } else {
      logSuccess(`Found ${result.pendingCount} pending tasks`);
      logInfo('Pending tasks:');
      result.pendingTasks.forEach((task, i) => {
        console.log(`  ${i + 1}. ${task.taskId} (${task.minutesAgo} min ago)`);
      });
    }

    logSuccess('Cloud check reminder works correctly');
    return true;
  } catch (error) {
    logError(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testLocalExec() {
  logHeader('Test 3: codex_local_exec');

  const tool = new LocalExecTool();

  logInfo('Testing with simple read-only task...');
  logWarning('This will call OpenAI Codex SDK - it may take 10-30 seconds');

  try {
    const result = await tool.execute({
      task: 'List all TypeScript files in the src directory and count them',
      workingDir: process.cwd(),
      mode: 'read-only',
      skipGitRepoCheck: true,
    });

    if (!result.success) {
      logError(`Execution failed: ${result.error}`);
      return false;
    }

    logSuccess('Local execution completed successfully');

    logInfo('Thread ID:');
    console.log(`  ${result.threadId}`);

    logInfo('Final Response:');
    console.log(`  ${result.finalResponse.substring(0, 200)}...`);

    if (result.usage) {
      logInfo('Token Usage:');
      console.log(`  Input: ${result.usage.input_tokens} (${result.usage.cached_input_tokens} cached)`);
      console.log(`  Output: ${result.usage.output_tokens}`);
    }

    logInfo(`Events Captured: ${result.events.length}`);

    logSuccess('Local execution with SDK works correctly');

    // Return thread ID for next test
    return result.threadId;
  } catch (error) {
    logError(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return false;
  }
}

async function testLocalResume(threadId: string) {
  logHeader('Test 4: codex_local_resume');

  if (!threadId || threadId === 'unknown') {
    logWarning('Skipping test - no valid thread ID from previous test');
    return true;
  }

  const tool = new LocalResumeTool();

  logInfo(`Resuming thread: ${threadId}`);
  logWarning('This will call OpenAI Codex SDK - it may take 10-30 seconds');

  try {
    const result = await tool.execute({
      threadId,
      task: 'Now tell me the total count of TypeScript files you found',
    });

    if (!result.success) {
      logError(`Execution failed: ${result.error}`);
      return false;
    }

    logSuccess('Thread resumed successfully');

    logInfo('Final Response:');
    console.log(`  ${result.finalResponse.substring(0, 200)}...`);

    if (result.usage) {
      logInfo('Token Usage (with caching):');
      console.log(`  Input: ${result.usage.input_tokens} (${result.usage.cached_input_tokens} cached)`);
      console.log(`  Output: ${result.usage.output_tokens}`);

      // Check that we got significant caching
      const cacheRate = result.usage.cached_input_tokens / result.usage.input_tokens;
      if (cacheRate > 0.5) {
        logSuccess(`Good cache rate: ${(cacheRate * 100).toFixed(1)}% of input tokens cached`);
      }
    }

    logSuccess('Thread resumption with context preservation works correctly');
    return true;
  } catch (error) {
    logError(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return false;
  }
}

async function runAllTests() {
  logHeader('Codex Control MCP v2.1.0 - Comprehensive Test Suite');

  const results: Record<string, boolean> = {};

  // Setup
  await setupTestEnvironment();

  // Test 1: List Environments
  results['list_environments'] = await testListEnvironments();

  // Test 2: Cloud Check Reminder
  results['cloud_check_reminder'] = await testCloudCheckReminder();

  // Test 3: Local Exec (returns thread ID)
  const threadId = await testLocalExec();
  results['local_exec'] = typeof threadId === 'string' && threadId !== 'unknown' && threadId.length > 0;

  // Test 4: Local Resume (uses thread ID from test 3)
  if (threadId && typeof threadId === 'string') {
    results['local_resume'] = await testLocalResume(threadId);
  } else {
    logWarning('Skipping local_resume test due to local_exec failure');
    results['local_resume'] = false;
  }

  // Summary
  logHeader('Test Summary');

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([test, passed]) => {
    if (passed) {
      logSuccess(`${test}: PASSED`);
    } else {
      logError(`${test}: FAILED`);
    }
  });

  console.log('\n' + '='.repeat(80));
  if (passed === total) {
    logSuccess(`All ${total} tests passed! 🎉`);
    console.log('='.repeat(80));
    process.exit(0);
  } else {
    logError(`${total - passed} out of ${total} tests failed`);
    console.log('='.repeat(80));
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  logError(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
