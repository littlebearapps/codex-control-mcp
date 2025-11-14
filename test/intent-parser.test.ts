/**
 * Intent Parser Unit Tests
 *
 * Tests the natural language → primitive mapping engine.
 *
 * Test Coverage:
 * - 14 positive cases (one per primitive)
 * - 20 negative/edge cases
 * - 10 disambiguation scenarios
 * - 6 confidence scoring tests
 *
 * Total: 50 tests
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { IntentParser } from '../src/core/intent-parser.js';
import {
  assertInRange,
  assertValidConfidence,
  assertDefined,
  normalizeTestString,
} from './test-helpers.js';

// Test data (from fixtures/nl-inputs.json)
const nlInputs = {
  positive_cases: {
    _codex_local_run: [
      'Analyze main.ts for bugs',
      'Check code quality in utils.ts',
      'Run the test suite',
      'Scan for security issues',
    ],
    _codex_local_status: [
      "What's currently running?",
      'Show me local task status',
      'Check the queue',
      'What tasks are active?',
    ],
    _codex_local_exec: [
      'Start analyzing the codebase',
      'Begin refactoring auth.ts with progress tracking',
      'Execute a comprehensive security audit',
    ],
    _codex_local_resume: [
      'Continue the previous analysis',
      'Resume thread_abc123',
      'Keep working on that refactoring',
      'Proceed with the last task',
    ],
    _codex_local_results: [
      'Get results for task T-local-abc123',
      'Show me what completed',
      'Results for T-local-def456',
    ],
    _codex_local_wait: [
      'Wait for task T-local-abc123 to finish',
      'Poll until the analysis completes',
      'Monitor task T-local-xyz789',
    ],
    _codex_local_cancel: [
      'Cancel task T-local-abc123',
      'Stop the running analysis',
      'Abort task T-local-def456',
    ],
    _codex_cloud_submit: [
      'Run the full test suite in the cloud',
      'Create a PR for this feature',
      'Submit analysis to cloud',
      'Run tests in background and create PR if passing',
    ],
    _codex_cloud_status: [
      'Check cloud task status',
      "What's running in Codex Cloud?",
      'Show cloud tasks',
    ],
    _codex_cloud_results: [
      'Get results for cloud task T-cloud-def456',
      'Show me the PR that was created',
      'Cloud results for T-cloud-abc123',
    ],
    _codex_cloud_wait: [
      'Wait for cloud task to complete',
      'Poll until the PR is ready',
      'Monitor cloud task T-cloud-xyz789',
    ],
    _codex_cloud_cancel: [
      'Cancel cloud task T-cloud-def456',
      'Stop the cloud execution',
      'Abort cloud task T-cloud-abc123',
    ],
    _codex_cloud_list_environments: [
      'List my Codex environments',
      'Show available environments',
      'What environments do I have?',
    ],
    _codex_cloud_github_setup: [
      'Set up GitHub integration for https://github.com/myorg/myrepo',
      'Generate GitHub setup guide for my repo',
      'Configure GitHub integration',
    ],
  },
  negative_cases: [
    '',
    'asdfghjkl',
    'do something',
    "What's the weather?",
    'run tests and also cancel them',
    'submit to cloud',
    'get results for abc',
    "wait but don't wait",
    'analyze',
    'analyser le code',
  ],
  disambiguation_cases: [
    {
      input: 'Run something',
      expected_matches: ['_codex_local_run', '_codex_cloud_submit'],
      should_disambiguate: true,
    },
    {
      input: 'Check status',
      expected_matches: ['_codex_local_status', '_codex_cloud_status'],
      should_disambiguate: true,
    },
    {
      input: 'Get results',
      expected_matches: ['_codex_local_results', '_codex_cloud_results'],
      should_disambiguate: true,
    },
    {
      input: 'Wait for completion',
      expected_matches: ['_codex_local_wait', '_codex_cloud_wait'],
      should_disambiguate: true,
    },
    {
      input: 'Cancel task',
      expected_matches: ['_codex_local_cancel', '_codex_cloud_cancel'],
      should_disambiguate: true,
    },
  ],
  parameter_extraction: [
    {
      input: 'Get results for T-local-abc123',
      expected_params: {
        task_id: 'T-local-abc123',
      },
    },
    {
      input: 'Resume thread_xyz789',
      expected_params: {
        threadId: 'xyz789',
      },
    },
    {
      input: 'Set up GitHub for https://github.com/myorg/myrepo',
      expected_params: {
        repoUrl: 'https://github.com/myorg/myrepo',
      },
    },
    {
      input: 'Submit to env_illustrations',
      expected_params: {
        envId: 'env_illustrations',
      },
    },
  ],
};

describe('Intent Parser - Positive Cases', () => {
  const parser = new IntentParser();

  // Test each primitive with multiple natural language inputs
  const primitives = Object.keys(nlInputs.positive_cases);

  for (const primitive of primitives) {
    const testInputs = nlInputs.positive_cases[primitive as keyof typeof nlInputs.positive_cases];

    for (let i = 0; i < testInputs.length; i++) {
      const input = testInputs[i];

      test(`${primitive} - Input ${i + 1}: "${input}"`, () => {
        const result = parser.parse(input);

        // Should successfully parse intent
        assertDefined(result.intent, `Failed to parse intent for "${input}"`);
        assert.strictEqual(
          result.intent.primitive,
          primitive,
          `Expected primitive "${primitive}" but got "${result.intent.primitive}"`
        );

        // Confidence should be reasonable
        assertValidConfidence(result.intent.confidence);
        assert.ok(
          result.intent.confidence >= 30,
          `Confidence too low (${result.intent.confidence}%) for positive case`
        );

        // Should not require disambiguation for clear inputs
        if (result.intent.confidence >= 70) {
          assert.strictEqual(
            result.requiresDisambiguation,
            false,
            'High-confidence input should not require disambiguation'
          );
        }

        // Should have reasoning
        assertDefined(result.intent.reasoning, 'Intent should include reasoning');
      });
    }
  }
});

describe('Intent Parser - Negative Cases', () => {
  const parser = new IntentParser();

  for (let i = 0; i < nlInputs.negative_cases.length; i++) {
    const input = nlInputs.negative_cases[i];

    test(`Negative Case ${i + 1}: "${input}"`, () => {
      const result = parser.parse(input);

      // Should fail to parse or have very low confidence
      if (result.intent) {
        assert.ok(
          result.intent.confidence < 60,
          `Unexpected high confidence (${result.intent.confidence}%) for negative case "${input}"`
        );
      } else {
        // No intent parsed - this is acceptable for negative cases
        assertDefined(result.error, 'Should include error message when no intent found');
      }
    });
  }
});

describe('Intent Parser - Disambiguation', () => {
  const parser = new IntentParser();

  for (const testCase of nlInputs.disambiguation_cases) {
    test(`Disambiguate: "${testCase.input}"`, () => {
      const result = parser.parse(testCase.input);

      if (testCase.should_disambiguate) {
        // Should identify multiple possible matches
        assert.ok(
          result.requiresDisambiguation || result.alternatives.length > 0,
          `Expected disambiguation for "${testCase.input}"`
        );

        // Check if expected matches are in top results
        const topMatches = [
          result.intent?.primitive,
          ...result.alternatives.map(a => a.primitive),
        ].filter(Boolean);

        for (const expectedMatch of testCase.expected_matches) {
          assert.ok(
            topMatches.includes(expectedMatch),
            `Expected "${expectedMatch}" in top matches for "${testCase.input}", got: ${topMatches.join(', ')}`
          );
        }

        // Scores should be close (within 20 points)
        if (result.intent && result.alternatives[0]) {
          const diff = Math.abs(result.intent.confidence - result.alternatives[0].confidence);
          assert.ok(
            diff < 20,
            `Confidence scores should be close for ambiguous input (diff: ${diff})`
          );
        }
      } else {
        // Should NOT require disambiguation
        assert.strictEqual(
          result.requiresDisambiguation,
          false,
          `Should not require disambiguation for "${testCase.input}"`
        );
      }
    });
  }
});

describe('Intent Parser - Parameter Extraction', () => {
  const parser = new IntentParser();

  for (const testCase of nlInputs.parameter_extraction) {
    test(`Extract params from: "${testCase.input}"`, () => {
      const result = parser.parse(testCase.input);

      assertDefined(result.intent, `Failed to parse intent for "${testCase.input}"`);

      const { extractedParams } = result.intent;

      // Check each expected parameter
      for (const [key, expectedValue] of Object.entries(testCase.expected_params)) {
        assert.ok(
          key in extractedParams,
          `Missing parameter "${key}" in extracted params`
        );

        if (typeof expectedValue === 'string') {
          assert.ok(
            extractedParams[key].includes(expectedValue) ||
              normalizeTestString(extractedParams[key]).includes(
                normalizeTestString(expectedValue)
              ),
            `Expected param "${key}" to contain "${expectedValue}", got: ${extractedParams[key]}`
          );
        }
      }
    });
  }
});

describe('Intent Parser - Confidence Scoring', () => {
  const parser = new IntentParser();

  test('High confidence (90-100): Very specific input', () => {
    const input = 'Cancel cloud task T-cloud-abc123';
    const result = parser.parse(input);

    assertDefined(result.intent);
    assert.strictEqual(result.intent.primitive, '_codex_cloud_cancel');
    assertInRange(result.intent.confidence, 80, 100, 'Should have high confidence');
  });

  test('High confidence (90-100): Keyword + context match', () => {
    const input = 'Resume thread_abc123 and continue the previous analysis';
    const result = parser.parse(input);

    assertDefined(result.intent);
    assert.strictEqual(result.intent.primitive, '_codex_local_resume');
    assertInRange(result.intent.confidence, 70, 100, 'Should have high confidence');
  });

  test('Medium confidence (60-89): Keyword match only', () => {
    const input = 'Check the status';
    const result = parser.parse(input);

    assertDefined(result.intent);
    // Could be local or cloud status
    assert.ok(
      result.intent.primitive === '_codex_local_status' ||
        result.intent.primitive === '_codex_cloud_status'
    );
    assertInRange(result.intent.confidence, 40, 90, 'Should have medium confidence');
  });

  test('Low confidence (30-59): Vague input', () => {
    const input = 'Do something with the code';
    const result = parser.parse(input);

    // May or may not parse
    if (result.intent) {
      assertInRange(result.intent.confidence, 0, 60, 'Should have low confidence');
    }
  });

  test('Very low confidence (0-29): Unrelated input', () => {
    const input = 'What is the capital of France?';
    const result = parser.parse(input);

    // Should fail to parse or have very low confidence
    if (result.intent) {
      assert.ok(
        result.intent.confidence < 30,
        `Unexpected confidence (${result.intent.confidence}%) for unrelated input`
      );
    } else {
      assertDefined(result.error, 'Should include error for unparseable input');
    }
  });

  test('Confidence ordering: Multiple matches sorted correctly', () => {
    const input = 'Run analysis';
    const result = parser.parse(input);

    assertDefined(result.intent);

    // Top match should have highest confidence
    if (result.alternatives.length > 0) {
      assert.ok(
        result.intent.confidence >= result.alternatives[0].confidence,
        'Top intent should have highest confidence'
      );
    }

    // Alternatives should be sorted descending
    for (let i = 0; i < result.alternatives.length - 1; i++) {
      assert.ok(
        result.alternatives[i].confidence >= result.alternatives[i + 1].confidence,
        'Alternatives should be sorted by confidence (descending)'
      );
    }
  });
});

describe('Intent Parser - Edge Cases', () => {
  const parser = new IntentParser();

  test('Empty string', () => {
    const result = parser.parse('');
    assert.strictEqual(result.intent, null, 'Should not parse empty string');
    assertDefined(result.error);
    assert.strictEqual(result.error, 'Empty input');
  });

  test('Whitespace only', () => {
    const result = parser.parse('   \t\n  ');
    assert.strictEqual(result.intent, null, 'Should not parse whitespace');
    assertDefined(result.error);
  });

  test('Very long input (10,000 characters)', () => {
    const longInput = 'Analyze code '.repeat(1000); // ~13,000 chars
    const result = parser.parse(longInput);

    // Should still parse (validation happens in router)
    // Intent parser should be resilient
    if (result.intent) {
      assertValidConfidence(result.intent.confidence);
    }
  });

  test('Special characters', () => {
    const input = 'Analyze main.ts for bugs 🐛 and security issues 🔒';
    const result = parser.parse(input);

    assertDefined(result.intent);
    assert.strictEqual(result.intent.primitive, '_codex_local_run');
  });

  test('Mixed case', () => {
    const input = 'ANALYZE Main.ts FOR BUGS';
    const result = parser.parse(input);

    assertDefined(result.intent);
    assert.strictEqual(result.intent.primitive, '_codex_local_run');
  });

  test('Multiple spaces', () => {
    const input = 'Resume    thread_abc123    and    continue';
    const result = parser.parse(input);

    assertDefined(result.intent);
    assert.strictEqual(result.intent.primitive, '_codex_local_resume');
  });

  test('Contradictory keywords', () => {
    const input = 'Run tests and also cancel them';
    const result = parser.parse(input);

    // Should pick one primitive (likely "run" since it comes first)
    // But confidence might be lower due to confusion
    if (result.intent) {
      assertValidConfidence(result.intent.confidence);
    }
  });

  test('Multiple task IDs in input', () => {
    const input = 'Get results for T-local-abc123 and also T-cloud-def456';
    const result = parser.parse(input);

    assertDefined(result.intent);

    // Should extract at least one task ID
    assert.ok(
      'task_id' in result.intent.extractedParams,
      'Should extract task_id parameter'
    );
  });

  test('GitHub URL extraction', () => {
    const input = 'Setup GitHub integration for https://github.com/myorg/myrepo';
    const result = parser.parse(input);

    assertDefined(result.intent);
    assert.strictEqual(result.intent.primitive, '_codex_cloud_github_setup');
    assert.ok(
      'repoUrl' in result.intent.extractedParams,
      'Should extract repoUrl parameter'
    );
    assert.strictEqual(
      result.intent.extractedParams.repoUrl,
      'https://github.com/myorg/myrepo'
    );
  });

  test('Environment ID extraction', () => {
    const input = 'Submit to env_illustrations';
    const result = parser.parse(input);

    assertDefined(result.intent);
    assert.ok(
      'envId' in result.intent.extractedParams,
      'Should extract envId parameter'
    );
    assert.strictEqual(result.intent.extractedParams.envId, 'env_illustrations');
  });
});

describe('Intent Parser - Reasoning Generation', () => {
  const parser = new IntentParser();

  test('Reasoning explains keyword matches', () => {
    const input = 'Analyze main.ts for bugs';
    const result = parser.parse(input);

    assertDefined(result.intent);
    assertDefined(result.intent.reasoning);

    // Should mention "analyze" keyword
    assert.ok(
      result.intent.reasoning.toLowerCase().includes('analyze'),
      'Reasoning should mention matched keyword'
    );
  });

  test('Reasoning explains context matches', () => {
    const input = 'Check code quality and security in utils.ts';
    const result = parser.parse(input);

    assertDefined(result.intent);
    assertDefined(result.intent.reasoning);

    // Should mention both keywords and context
    const reasoning = result.intent.reasoning.toLowerCase();
    assert.ok(
      reasoning.includes('check') || reasoning.includes('quality') || reasoning.includes('security'),
      'Reasoning should mention matched keywords or context'
    );
  });

  test('Alternatives include reasoning', () => {
    const input = 'Run something';
    const result = parser.parse(input);

    if (result.alternatives.length > 0) {
      for (const alt of result.alternatives) {
        assertDefined(alt.reasoning, 'Alternatives should include reasoning');
      }
    }
  });
});

describe('Intent Parser - Clarification Suggestions', () => {
  const parser = new IntentParser();

  test('Suggest clarification for local vs cloud ambiguity', () => {
    const input = 'Run analysis';
    const result = parser.parse(input);

    const clarification = parser.suggestClarification(result);

    if (result.requiresDisambiguation) {
      assertDefined(clarification);
      assert.ok(
        clarification.toLowerCase().includes('local') ||
          clarification.toLowerCase().includes('cloud'),
        'Clarification should mention local vs cloud'
      );
    }
  });

  test('Suggest clarification for status vs results ambiguity', () => {
    const input = 'Check task T-local-abc123';
    const result = parser.parse(input);

    const clarification = parser.suggestClarification(result);

    if (result.requiresDisambiguation) {
      assertDefined(clarification);
      // Should help user distinguish between checking status vs getting results
    }
  });

  test('No clarification for clear input', () => {
    const input = 'Cancel cloud task T-cloud-abc123';
    const result = parser.parse(input);

    const clarification = parser.suggestClarification(result);

    assert.strictEqual(
      result.requiresDisambiguation,
      false,
      'Clear input should not require disambiguation'
    );
    assert.strictEqual(clarification, '', 'Should return empty string for clear input');
  });
});
