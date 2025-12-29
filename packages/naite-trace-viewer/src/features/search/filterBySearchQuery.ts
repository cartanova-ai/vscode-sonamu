import type { NaiteMessagingTypes } from "naite-types";
import type { MatchedTrace, SearchResultGroup } from "../../types";
import { traceMatchesQuery } from "./fuzzyMatch";

/**
 * 검색어로 테스트 결과 필터링
 *
 * 순수 함수: testResults와 query를 받아 매칭되는 결과만 반환
 */
export function filterBySearchQuery(
  testResults: NaiteMessagingTypes.TestResult[],
  query: string,
): { groups: SearchResultGroup[]; matchCount: number } {
  const groups: SearchResultGroup[] = [];
  let matchCount = 0;

  if (!query) {
    return { groups, matchCount };
  }

  for (const result of testResults) {
    const suiteName = result.suiteName || "(no suite)";
    const testName = result.testName || "(no test)";
    const matchedTraces: MatchedTrace[] = [];

    result.traces.forEach((trace, traceIdx) => {
      if (traceMatchesQuery(trace.key, query)) {
        matchedTraces.push({ trace, traceIdx });
        matchCount++;
      }
    });

    if (matchedTraces.length > 0) {
      groups.push({ suiteName, testName, result, matchedTraces });
    }
  }

  return { groups, matchCount };
}
