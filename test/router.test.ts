/**
 * Router Unit Tests
 *
 * Tests for the Router component that routes parsed intents to primitives.
 * Covers routing logic, parameter validation, error handling, and edge cases.
 */

import { describe, test, expect } from '@jest/globals';
import { Router, PrimitiveTool } from '../src/core/router.js';
import { IntentParseResult } from '../src/core/intent-parser.js';
import { assertDefined } from './test-helpers.js';

/**
 * Mock Primitive Tool for testing
 */
class MockPrimitiveTool implements PrimitiveTool {
  constructor(
    private schema: any,
    private executeImpl?: (params: any) => Promise<any>
  ) {}

  getSchema(): any {
    return this.schema;
  }

  async execute(params: any): Promise<any> {
    if (this.executeImpl) {
      return this.executeImpl(params);
    }
    return { success: true, output: 'Mock execution completed', params };
  }
}

/**
 * Helper: Create mock intent result
 */
function createMockIntent(
  primitive: string,
  confidence: number,
  extractedParams: Record<string, any> = {},
  requiresDisambiguation: boolean = false
): IntentParseResult {
  return {
    intent: {
      primitive,
      confidence,
      extractedParams,
      reasoning: 'Mock reasoning',
    },
    alternatives: [],
    requiresDisambiguation,
  };
}

/**
 * Helper: Create mock schema
 */
function createMockSchema(required: string[] = [], properties: Record<string, any> = {}): any {
  return {
    name: 'mock_primitive',
    description: 'Mock primitive for testing',
    inputSchema: {
      type: 'object',
      required,
      properties,
    },
  };
}

describe('Router - Routing Logic', () => {
  test('Routes intent to correct primitive successfully', async () => {
    const router = new Router();
    const mockTool = new MockPrimitiveTool(createMockSchema());
    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 80);
    const result = await router.route(intent);

    expect(result.success).toBe(true);
    expect(result.primitive).toBe('_test_primitive');
    assertDefined(result.result);
  });

  test('Passes parameters to primitive execution', async () => {
    const router = new Router();
    let capturedParams: any = null;

    const mockTool = new MockPrimitiveTool(
      createMockSchema(),
      async (params) => {
        capturedParams = params;
        return { success: true };
      }
    );

    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 80, { task: 'test task', mode: 'read-only' });
    await router.route(intent);

    expect(capturedParams).toEqual({ task: 'test task', mode: 'read-only' });
  });

  test('Returns error when intent is null', async () => {
    const router = new Router();

    const intentResult: IntentParseResult = {
      intent: null,
      alternatives: [],
      requiresDisambiguation: false,
      error: 'Could not parse input',
    };

    const result = await router.route(intentResult);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Could not parse input');
    assertDefined(result.suggestion);
  });

  test('Returns error when disambiguation required', async () => {
    const router = new Router();

    const intentResult = createMockIntent('_test_primitive', 50, {}, true);

    const result = await router.route(intentResult);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Input is ambiguous');
    assertDefined(result.suggestion);
  });

  test('Returns error when primitive not found', async () => {
    const router = new Router();

    const intent = createMockIntent('_nonexistent_primitive', 80);
    const result = await router.route(intent);

    expect(result.success).toBe(false);
    expect(result.primitive).toBe('_nonexistent_primitive');
    expect(result.error).toContain('not found');
  });

  test('Returns error when confidence too low', async () => {
    const router = new Router();
    const mockTool = new MockPrimitiveTool(createMockSchema());
    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 30); // Below 60% threshold

    const result = await router.route(intent);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Confidence too low');
    expect(result.error).toContain('30%');
  });

  test('Executes with confidence exactly at threshold (60%)', async () => {
    const router = new Router();
    const mockTool = new MockPrimitiveTool(createMockSchema());
    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 60); // Exactly at threshold

    const result = await router.route(intent);

    expect(result.success).toBe(true);
    expect(result.primitive).toBe('_test_primitive');
  });

  test('Executes with high confidence (≥90%)', async () => {
    const router = new Router();
    const mockTool = new MockPrimitiveTool(createMockSchema());
    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 95);

    const result = await router.route(intent);

    expect(result.success).toBe(true);
    expect(result.primitive).toBe('_test_primitive');
  });

  test('Returns result from successful execution', async () => {
    const router = new Router();
    const mockResult = { output: 'Test output', status: 'completed' };

    const mockTool = new MockPrimitiveTool(createMockSchema(), async () => mockResult);
    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 80);
    const result = await router.route(intent);

    expect(result.success).toBe(true);
    expect(result.result).toEqual(mockResult);
  });

  test('Handles execution errors gracefully', async () => {
    const router = new Router();

    const mockTool = new MockPrimitiveTool(
      createMockSchema(),
      async () => {
        throw new Error('Execution failed: Invalid task');
      }
    );

    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 80);
    const result = await router.route(intent);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Execution failed');
    assertDefined(result.suggestion);
  });
});

describe('Router - Parameter Validation', () => {
  test('Validates required parameters are present', async () => {
    const router = new Router();

    const schema = createMockSchema(['task', 'mode'], {
      task: { type: 'string', description: 'Task description' },
      mode: { type: 'string', description: 'Execution mode' },
    });

    const mockTool = new MockPrimitiveTool(schema);
    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 80, { task: 'test' }); // Missing 'mode'

    const result = await router.route(intent);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameter');
    expect(result.error).toContain('mode');
  });

  test('Passes validation when all required parameters present', async () => {
    const router = new Router();

    const schema = createMockSchema(['task'], {
      task: { type: 'string', description: 'Task description' },
    });

    const mockTool = new MockPrimitiveTool(schema);
    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 80, { task: 'test task' });

    const result = await router.route(intent);

    expect(result.success).toBe(true);
  });

  test('Handles empty parameters object with no required params', async () => {
    const router = new Router();

    const schema = createMockSchema([]); // No required params

    const mockTool = new MockPrimitiveTool(schema);
    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 80, {});

    const result = await router.route(intent);

    expect(result.success).toBe(true);
  });

  test('Detects undefined parameter values', async () => {
    const router = new Router();

    const schema = createMockSchema(['task']);

    const mockTool = new MockPrimitiveTool(schema);
    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 80, { task: undefined });

    const result = await router.route(intent);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameter');
  });

  test('Provides parameter fix suggestions', async () => {
    const router = new Router();

    const schema = createMockSchema(['task', 'envId'], {
      task: { type: 'string', description: 'Task to execute' },
      envId: { type: 'string', description: 'Environment ID' },
    });

    const mockTool = new MockPrimitiveTool(schema);
    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 80, {});

    const result = await router.route(intent);

    expect(result.success).toBe(false);
    assertDefined(result.suggestion);
    expect(result.suggestion).toContain('task');
    expect(result.suggestion).toContain('envId');
  });
});

describe('Router - Error Messages & Suggestions', () => {
  test('Provides user-friendly error messages', async () => {
    const router = new Router();

    const intentResult: IntentParseResult = {
      intent: null,
      alternatives: [],
      requiresDisambiguation: false,
      error: 'Empty input',
    };

    const result = await router.route(intentResult);

    expect(result.success).toBe(false);
    assertDefined(result.error);
    expect(result.error.length).toBeGreaterThan(0);
  });

  test('Suggests alternatives when available', async () => {
    const router = new Router();

    const intentResult: IntentParseResult = {
      intent: null,
      alternatives: [
        { primitive: '_option1', confidence: 45, extractedParams: {}, reasoning: 'Matched keyword A' },
        { primitive: '_option2', confidence: 40, extractedParams: {}, reasoning: 'Matched keyword B' },
      ],
      requiresDisambiguation: false,
      error: 'Low confidence',
    };

    const result = await router.route(intentResult);

    expect(result.success).toBe(false);
    assertDefined(result.suggestion);
    expect(result.suggestion).toContain('_option1');
    expect(result.suggestion).toContain('_option2');
  });

  test('Handles case with no alternatives gracefully', async () => {
    const router = new Router();

    const intentResult: IntentParseResult = {
      intent: null,
      alternatives: [],
      requiresDisambiguation: false,
      error: 'Could not parse',
    };

    const result = await router.route(intentResult);

    expect(result.success).toBe(false);
    assertDefined(result.suggestion);
    expect(result.suggestion).toContain('more specific');
  });

  test('Formats disambiguation options correctly', async () => {
    const router = new Router();

    const intentResult: IntentParseResult = {
      intent: { primitive: '_option1', confidence: 55, extractedParams: {}, reasoning: 'First match' },
      alternatives: [
        { primitive: '_option2', confidence: 50, extractedParams: {}, reasoning: 'Second match' },
      ],
      requiresDisambiguation: true,
    };

    const result = await router.route(intentResult);

    expect(result.success).toBe(false);
    assertDefined(result.suggestion);
    expect(result.suggestion).toContain('option 1');
    expect(result.suggestion).toContain('option 2');
    expect(result.suggestion).toContain('_option1');
    expect(result.suggestion).toContain('_option2');
  });

  test('Includes Codex CLI installation suggestion on execution error', async () => {
    const router = new Router();

    const mockTool = new MockPrimitiveTool(
      createMockSchema(),
      async () => {
        throw new Error('Command not found');
      }
    );

    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 80);
    const result = await router.route(intent);

    expect(result.success).toBe(false);
    assertDefined(result.suggestion);
    expect(result.suggestion).toContain('Codex CLI');
  });
});

describe('Router - Edge Cases', () => {
  test('Handles empty router (no registered primitives)', () => {
    const router = new Router();

    const primitives = router.getRegisteredPrimitives();

    expect(primitives.length).toBe(0);
  });

  test('Lists all registered primitives', () => {
    const router = new Router();

    router.registerPrimitive('_primitive1', new MockPrimitiveTool(createMockSchema()));
    router.registerPrimitive('_primitive2', new MockPrimitiveTool(createMockSchema()));
    router.registerPrimitive('_primitive3', new MockPrimitiveTool(createMockSchema()));

    const primitives = router.getRegisteredPrimitives();

    expect(primitives.length).toBe(3);
    expect(primitives).toContain('_primitive1');
    expect(primitives).toContain('_primitive2');
    expect(primitives).toContain('_primitive3');
  });

  test('Allows duplicate primitive registration (overwrites)', () => {
    const router = new Router();

    const tool1 = new MockPrimitiveTool(createMockSchema(), async () => ({ version: 1 }));
    const tool2 = new MockPrimitiveTool(createMockSchema(), async () => ({ version: 2 }));

    router.registerPrimitive('_test_primitive', tool1);
    router.registerPrimitive('_test_primitive', tool2); // Overwrite

    const primitives = router.getRegisteredPrimitives();

    expect(primitives.length).toBe(1);
    expect(primitives[0]).toBe('_test_primitive');
  });

  test('Handles very high confidence (100%)', async () => {
    const router = new Router();
    const mockTool = new MockPrimitiveTool(createMockSchema());
    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 100);

    const result = await router.route(intent);

    expect(result.success).toBe(true);
    expect(result.primitive).toBe('_test_primitive');
  });

  test('Handles very low confidence (0%)', async () => {
    const router = new Router();
    const mockTool = new MockPrimitiveTool(createMockSchema());
    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 0);

    const result = await router.route(intent);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Confidence too low');
  });

  test('Formats alternatives with top 3 only', async () => {
    const router = new Router();

    const intentResult: IntentParseResult = {
      intent: null,
      alternatives: [
        { primitive: '_alt1', confidence: 40, extractedParams: {}, reasoning: 'First' },
        { primitive: '_alt2', confidence: 35, extractedParams: {}, reasoning: 'Second' },
        { primitive: '_alt3', confidence: 30, extractedParams: {}, reasoning: 'Third' },
        { primitive: '_alt4', confidence: 25, extractedParams: {}, reasoning: 'Fourth' },
        { primitive: '_alt5', confidence: 20, extractedParams: {}, reasoning: 'Fifth' },
      ],
      requiresDisambiguation: false,
      error: 'Low confidence',
    };

    const result = await router.route(intentResult);

    assertDefined(result.suggestion);
    expect(result.suggestion).toContain('_alt1');
    expect(result.suggestion).toContain('_alt2');
    expect(result.suggestion).toContain('_alt3');
    expect(result.suggestion).not.toContain('_alt4'); // Should not include 4th+
  });

  test('Handles malformed schema gracefully', async () => {
    const router = new Router();

    const malformedSchema = {}; // No inputSchema

    const mockTool = new MockPrimitiveTool(malformedSchema);
    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 80);

    const result = await router.route(intent);

    // Should not crash, may succeed if no required params
    expect(result.success === true || result.success === false).toBeTruthy();
  });

  test('Handles non-Error exceptions', async () => {
    const router = new Router();

    const mockTool = new MockPrimitiveTool(
      createMockSchema(),
      async () => {
        throw 'String error'; // Non-Error exception
      }
    );

    router.registerPrimitive('_test_primitive', mockTool);

    const intent = createMockIntent('_test_primitive', 80);
    const result = await router.route(intent);

    expect(result.success).toBe(false);
    assertDefined(result.error);
    expect(result.error).toBe('String error');
  });

  test('Provides available primitives list on "not found" error', async () => {
    const router = new Router();

    router.registerPrimitive('_available1', new MockPrimitiveTool(createMockSchema()));
    router.registerPrimitive('_available2', new MockPrimitiveTool(createMockSchema()));

    const intent = createMockIntent('_nonexistent', 80);
    const result = await router.route(intent);

    expect(result.success).toBe(false);
    assertDefined(result.suggestion);
    expect(result.suggestion).toContain('_available1');
    expect(result.suggestion).toContain('_available2');
  });

  test('Handles disambiguation with empty alternatives array', async () => {
    const router = new Router();

    const intentResult: IntentParseResult = {
      intent: { primitive: '_test', confidence: 55, extractedParams: {}, reasoning: 'Match' },
      alternatives: [], // Empty alternatives despite disambiguation needed
      requiresDisambiguation: true,
    };

    const result = await router.route(intentResult);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Input is ambiguous');
    assertDefined(result.suggestion);
    // Should handle gracefully even with no alternatives
  });
});
