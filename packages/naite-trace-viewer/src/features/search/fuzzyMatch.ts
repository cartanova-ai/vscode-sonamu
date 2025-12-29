import type { FuzzyMatchResult } from "../../types";

/**
 * 퍼지 매칭: 쿼리의 각 문자가 텍스트에 순서대로 존재하는지 확인
 *
 * - 대소문자 무시
 * - 연속 문자 매칭 시 보너스 점수 (+10)
 * - 빈 쿼리는 항상 매칭
 *
 * @example
 * fuzzyMatch("MathService", "ms") → { matched: true, indices: [0, 4], score: 100 }
 * fuzzyMatch("calculate", "cal") → { matched: true, indices: [0, 1, 2], score: 120 }
 * fuzzyMatch("test", "xyz") → { matched: false, indices: [], score: 0 }
 */
export function fuzzyMatch(text: string, query: string): FuzzyMatchResult {
  if (!query) {
    return { matched: true, indices: [], score: 0 };
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const indices: number[] = [];
  let queryIdx = 0;
  let consecutiveBonus = 0;
  let lastMatchIdx = -1;

  for (let i = 0; i < lowerText.length && queryIdx < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIdx]) {
      indices.push(i);
      if (lastMatchIdx === i - 1) {
        consecutiveBonus += 10;
      }
      lastMatchIdx = i;
      queryIdx++;
    }
  }

  const matched = queryIdx === lowerQuery.length;
  const score = matched ? 100 + consecutiveBonus : 0;

  return { matched, indices, score };
}

/**
 * trace의 key가 검색어와 매칭되는지 확인
 * 빈 쿼리는 항상 true
 */
export function traceMatchesQuery(traceKey: string, query: string): boolean {
  if (!query) return true;
  return fuzzyMatch(traceKey, query).matched;
}
