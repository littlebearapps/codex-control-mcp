/**
 * Test Helpers - Shared utilities for test suites
 */

/**
 * Assert that value is within range
 */
export function assertInRange(value: number, min: number, max: number, message?: string): void {
  if (value < min || value > max) {
    throw new Error(message || `Expected ${value} to be between ${min} and ${max}`);
  }
}

/**
 * Assert that array contains value
 */
export function assertContains<T>(array: T[], value: T, message?: string): void {
  if (!array.includes(value)) {
    throw new Error(message || `Expected array to contain ${value}`);
  }
}

/**
 * Assert that object has property
 */
export function assertHasProperty(obj: any, prop: string, message?: string): void {
  if (!(prop in obj)) {
    throw new Error(message || `Expected object to have property "${prop}"`);
  }
}

/**
 * Assert that string matches regex
 */
export function assertMatches(str: string, regex: RegExp, message?: string): void {
  if (!regex.test(str)) {
    throw new Error(message || `Expected "${str}" to match ${regex}`);
  }
}

/**
 * Create a mock primitive tool for testing
 */
export function createMockPrimitive(name: string, requiredParams: string[] = []) {
  return {
    getSchema() {
      return {
        name,
        description: `Mock ${name} for testing`,
        inputSchema: {
          type: 'object',
          properties: requiredParams.reduce((acc, param) => {
            acc[param] = { type: 'string', description: `Mock ${param}` };
            return acc;
          }, {} as Record<string, any>),
          required: requiredParams,
        },
      };
    },
    async execute(params: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Mock execution of ${name} with params: ${JSON.stringify(params)}`,
          },
        ],
      };
    },
  };
}

/**
 * Sleep utility for async tests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Assert that promise rejects with specific error
 */
export async function assertRejects(
  fn: () => Promise<any>,
  expectedError?: string | RegExp
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected promise to reject, but it resolved');
  } catch (error) {
    if (expectedError) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (typeof expectedError === 'string') {
        if (!errorMessage.includes(expectedError)) {
          throw new Error(
            `Expected error to include "${expectedError}", but got: ${errorMessage}`
          );
        }
      } else {
        if (!expectedError.test(errorMessage)) {
          throw new Error(
            `Expected error to match ${expectedError}, but got: ${errorMessage}`
          );
        }
      }
    }
  }
}

/**
 * Assert that value is defined (not null/undefined)
 */
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to be defined');
  }
}

/**
 * Create a test task ID
 */
export function createTestTaskId(origin: 'local' | 'cloud' = 'local'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `T-${origin}-${timestamp}${random}`;
}

/**
 * Create a test thread ID
 */
export function createTestThreadId(): string {
  return `thread_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Assert that confidence score is valid
 */
export function assertValidConfidence(confidence: number): void {
  assertInRange(confidence, 0, 100, 'Confidence must be between 0 and 100');
}

/**
 * Normalize test string for comparison (lowercase, trim, collapse whitespace)
 */
export function normalizeTestString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Assert that two strings are equal (case-insensitive, whitespace-normalized)
 */
export function assertStringsEqual(actual: string, expected: string, message?: string): void {
  const normalizedActual = normalizeTestString(actual);
  const normalizedExpected = normalizeTestString(expected);

  if (normalizedActual !== normalizedExpected) {
    throw new Error(message || `Expected "${expected}" but got "${actual}"`);
  }
}
