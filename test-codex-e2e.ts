/**
 * E2E Tests for Unified Codex Tool
 *
 * Tests the complete flow from natural language input to primitive execution.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CodexTool } from '../src/tools/codex.js';

/**
 * Mock primitive tool for testing
 */
class MockPrimitive {
  name: string;
  lastParams: any = null;

  constructor(name: string) {
    this.name = name;
  }

  async execute(params: any) {
    this.lastParams = params;
    return {
      content: [
        {
          type: 'text',
          text: `Mock result from ${this.name}`,
        },
      ],
      isError: false,
    };
  }

  reset() {
    this.lastParams = null;
  }
}

/**
 * Create mock primitive tool map
 */
function createMockPrimitives() {
  return {
    _codex_local_run: new MockPrimitive('local_run'),
    _codex_local_status: new MockPrimitive('local_status'),
    _codex_local_exec: new MockPrimitive('local_exec'),
    _codex_local_resume: new MockPrimitive('local_resume'),
    _codex_local_results: new MockPrimitive('local_results'),
    _codex_local_wait: new MockPrimitive('local_wait'),
    _codex_local_cancel: new MockPrimitive('local_cancel'),
    _codex_cloud_submit: new MockPrimitive('cloud_submit'),
    _codex_cloud_status: new MockPrimitive('cloud_status'),
    _codex_cloud_results: new MockPrimitive('cloud_results'),
    _codex_cloud_wait: new MockPrimitive('cloud_wait'),
    _codex_cloud_cancel: new MockPrimitive('cloud_cancel'),
    _codex_cloud_list_environments: new MockPrimitive('list_environments'),
    _codex_cloud_github_setup: new MockPrimitive('github_setup'),
  };
}

/**
 * Helper to parse codex tool response
 */
function parseResponse(result: any) {
  const text = result.content[0].text;
  return JSON.parse(text);
}

/**
 * Helper to assert primitive was called
 */
function assertPrimitiveCalled(primitives: any, primitiveName: string) {
  const primitive = (primitives as any)[primitiveName];
  assert.ok(primitive.lastParams !== null, `Expected ${primitiveName} to be called`);
  return primitive.lastParams;
}

describe('Unified Codex Tool - E2E Tests', () => {
  describe('Local Execution Primitives', () => {
    it('routes "run tests" to _codex_local_run', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({ request: 'run tests' });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.action, 'run');
      const params = assertPrimitiveCalled(primitives, '_codex_local_run');
      assert.strictEqual(params.task, 'run tests');
      assert.strictEqual(params.mode, 'read-only');
    });

    it('routes "analyze code for bugs" to _codex_local_run', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({ request: 'analyze code for bugs' });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.action, 'run');
      assertPrimitiveCalled(primitives, '_codex_local_run');
    });

    it('routes "start new task with progress tracking" to _codex_local_exec', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'start new task with progress tracking',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.action, 'run');
      assertPrimitiveCalled(primitives, '_codex_local_exec');
    });

    it('routes "continue thread thread_abc123" to _codex_local_resume', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'continue thread thread_abc123xyz',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.action, 'run');
      const params = assertPrimitiveCalled(primitives, '_codex_local_resume');
      assert.strictEqual(params.threadId, 'thread_abc123xyz');
    });

    it('routes "check status of T-local-abc123" to _codex_local_status', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'check status of T-local-abc123',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.action, 'check');
      const params = assertPrimitiveCalled(primitives, '_codex_local_status');
      assert.strictEqual(params.task_id, 'T-local-abc123');
    });

    it('routes "wait for T-local-xyz456" to _codex_local_wait', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'wait for T-local-xyz456',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.action, 'wait');
      const params = assertPrimitiveCalled(primitives, '_codex_local_wait');
      assert.strictEqual(params.task_id, 'T-local-xyz456');
    });

    it('routes "cancel T-local-def789" to _codex_local_cancel', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'cancel T-local-def789',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.action, 'cancel');
      const params = assertPrimitiveCalled(primitives, '_codex_local_cancel');
      assert.strictEqual(params.task_id, 'T-local-def789');
    });

    it('routes "get results for T-local-ghi012" to _codex_local_results', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'get results for T-local-ghi012',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.action, 'results');
      const params = assertPrimitiveCalled(primitives, '_codex_local_results');
      assert.strictEqual(params.task_id, 'T-local-ghi012');
    });
  });

  describe('Cloud Execution Primitives', () => {
    it('routes "run comprehensive tests in the cloud" to _codex_cloud_submit', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'run comprehensive tests in the cloud',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.action, 'run');
      assertPrimitiveCalled(primitives, '_codex_cloud_submit');
    });

    it('routes "check cloud status for T-cloud-abc123" to _codex_cloud_status', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'check cloud status for T-cloud-abc123',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.action, 'check');
      const params = assertPrimitiveCalled(primitives, '_codex_cloud_status');
      assert.strictEqual(params.task_id, 'T-cloud-abc123');
    });

    it('routes "wait for cloud task T-cloud-xyz789" to _codex_cloud_wait', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'wait for cloud task T-cloud-xyz789',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.action, 'wait');
      const params = assertPrimitiveCalled(primitives, '_codex_cloud_wait');
      assert.strictEqual(params.task_id, 'T-cloud-xyz789');
    });

    it('routes "cancel cloud task T-cloud-def456" to _codex_cloud_cancel', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'cancel cloud task T-cloud-def456',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.action, 'cancel');
      const params = assertPrimitiveCalled(primitives, '_codex_cloud_cancel');
      assert.strictEqual(params.task_id, 'T-cloud-def456');
    });

    it('routes "get cloud results for T-cloud-ghi012" to _codex_cloud_results', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'get cloud results for T-cloud-ghi012',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.action, 'results');
      const params = assertPrimitiveCalled(primitives, '_codex_cloud_results');
      assert.strictEqual(params.task_id, 'T-cloud-ghi012');
    });
  });

  describe('Configuration & Setup Primitives', () => {
    it('routes "list environments" to _codex_cloud_list_environments', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'list environments',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.action, 'setup');
      assertPrimitiveCalled(primitives, '_codex_cloud_list_environments');
    });

    it('routes "setup github for https://github.com/user/repo" to _codex_cloud_github_setup', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'setup github for https://github.com/myorg/myrepo',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.action, 'setup');
      const params = assertPrimitiveCalled(primitives, '_codex_cloud_github_setup');
      assert.strictEqual(params.repoUrl, 'https://github.com/myorg/myrepo');
    });
  });

  describe('Dry Run Mode', () => {
    it('does not execute primitive when dry_run=true', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'run tests',
        dry_run: true,
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.action, 'run');
      assert.ok(response.user_message.includes('[Dry Run]'));
      assert.ok(response.user_message.includes('_codex_local_run'));

      // Verify primitive was NOT called
      const primitive = primitives._codex_local_run;
      assert.strictEqual(primitive.lastParams, null, 'Primitive should not be called in dry-run mode');
    });
  });

  describe('Explain Mode', () => {
    it('includes decision trace when explain=true', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'run tests',
        dry_run: true,
        explain: true,
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.ok(Array.isArray(response.decision_trace), 'Should include decision_trace');
      assert.ok(response.decision_trace.length > 0, 'Decision trace should not be empty');
      assert.ok(
        response.decision_trace.some((trace: string) => trace.includes('Parsed intent')),
        'Should include intent parsing step'
      );
    });

    it('does not include decision trace when explain=false', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'run tests',
        dry_run: true,
        explain: false,
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      assert.strictEqual(response.decision_trace, undefined, 'Should not include decision_trace');
    });
  });

  describe('Error Cases', () => {
    it('returns error when primitives not provided', async () => {
      const codexTool = new CodexTool(); // No primitives

      const result = await codexTool.execute({
        request: 'run tests',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, false);
      assert.ok(response.error);
      assert.strictEqual(response.error.code, 'MISSING_PRIMITIVES');
    });

    it('handles routing errors gracefully', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      // Empty request should cause routing error
      const result = await codexTool.execute({
        request: '',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, false);
      assert.ok(response.error);
    });

    it('handles primitive execution errors', async () => {
      const primitives = createMockPrimitives();

      // Make primitive return error
      primitives._codex_local_run.execute = async () => ({
        content: [{ type: 'text', text: 'Execution failed' }],
        isError: true,
      });

      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'run tests',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, false);
      assert.ok(response.error);
      assert.strictEqual(response.error.code, 'PRIMITIVE_ERROR');
    });
  });

  describe('Parameter Extraction', () => {
    it('extracts task ID from natural language', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'check status of T-local-abc123',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      const params = assertPrimitiveCalled(primitives, '_codex_local_status');
      assert.strictEqual(params.task_id, 'T-local-abc123');
    });

    it('extracts thread ID from natural language', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'resume thread_abc123def456',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      const params = assertPrimitiveCalled(primitives, '_codex_local_resume');
      assert.strictEqual(params.threadId, 'thread_abc123def456');
    });

    it('extracts GitHub URL from natural language', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const result = await codexTool.execute({
        request: 'set up github for https://github.com/anthropics/claude-code',
      });
      const response = parseResponse(result);

      assert.strictEqual(response.acknowledged, true);
      const params = assertPrimitiveCalled(primitives, '_codex_cloud_github_setup');
      assert.strictEqual(params.repoUrl, 'https://github.com/anthropics/claude-code');
    });
  });

  describe('Natural Language Variations', () => {
    it('handles different phrasings for execution', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const phrasings = [
        'run tests',
        'execute tests',
        'run the test suite',
        'analyze code',
        'check for bugs',
        'review the code',
      ];

      for (const phrasing of phrasings) {
        primitives._codex_local_run.reset();

        const result = await codexTool.execute({ request: phrasing });
        const response = parseResponse(result);

        assert.strictEqual(
          response.acknowledged,
          true,
          `"${phrasing}" should be acknowledged`
        );
        assertPrimitiveCalled(primitives, '_codex_local_run');
      }
    });

    it('handles different phrasings for status check', async () => {
      const primitives = createMockPrimitives();
      const codexTool = new CodexTool(primitives);

      const phrasings = [
        'check status of T-local-abc123',
        'what is the status of T-local-abc123',
        'show status for T-local-abc123',
        'status T-local-abc123',
      ];

      for (const phrasing of phrasings) {
        primitives._codex_local_status.reset();

        const result = await codexTool.execute({ request: phrasing });
        const response = parseResponse(result);

        assert.strictEqual(
          response.acknowledged,
          true,
          `"${phrasing}" should be acknowledged`
        );
        const params = assertPrimitiveCalled(primitives, '_codex_local_status');
        assert.strictEqual(params.task_id, 'T-local-abc123');
      }
    });
  });
});
