/**
 * Test 상태 키 생성
 *
 * @example
 * createTestKey("MathService", "should add numbers") → "MathService::should add numbers"
 */
export function createTestKey(suiteName: string, testName: string): string {
  return `${suiteName}::${testName}`;
}

/**
 * Trace 상태 키 생성
 * suite, test, trace key, timestamp, index를 조합하여 고유 키 생성
 *
 * @example
 * createTraceKey("MathService", "add", "result", "2024-01-01T00:00:00Z", 0)
 * → "MathService::add::result::2024-01-01T00:00:00Z::0"
 */
export function createTraceKey(
  suiteName: string,
  testName: string,
  traceKey: string,
  traceAt: string,
  traceIdx: number,
): string {
  return `${suiteName}::${testName}::${traceKey}::${traceAt}::${traceIdx}`;
}
