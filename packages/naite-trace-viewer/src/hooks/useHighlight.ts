import { useCallback, useRef, useState } from "react";

const HIGHLIGHT_DURATION_MS = 2000;
const SCROLL_DELAY_MS = 100;

/**
 * 하이라이트 상태 관리 훅
 *
 * - trace/test 하이라이트 (2초 후 자동 제거)
 * - 스크롤 타겟 관리
 */
export function useHighlight() {
  const [highlightedTraces, setHighlightedTraces] = useState<Set<string>>(new Set());
  const [highlightedTest, setHighlightedTest] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);

  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const testHighlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 여러 trace를 하이라이트하고 첫 번째로 스크롤
   */
  const highlightTraces = useCallback((traceKeys: string[]) => {
    // 기존 타이머 정리
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    // 하이라이트 적용
    setTimeout(() => {
      setHighlightedTraces(new Set(traceKeys));

      // 첫 번째 요소로 스크롤
      if (traceKeys.length > 0) {
        setScrollTarget(traceKeys[0]);
      }

      // 2초 후 하이라이트 제거
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedTraces(new Set());
      }, HIGHLIGHT_DURATION_MS);
    }, SCROLL_DELAY_MS);
  }, []);

  /**
   * 단일 test를 하이라이트하고 스크롤
   */
  const highlightTest = useCallback((testKey: string) => {
    // 기존 타이머 정리
    if (testHighlightTimeoutRef.current) {
      clearTimeout(testHighlightTimeoutRef.current);
    }

    // 하이라이트 적용
    setTimeout(() => {
      setHighlightedTest(testKey);
      setScrollTarget(testKey);

      // 2초 후 하이라이트 제거
      testHighlightTimeoutRef.current = setTimeout(() => {
        setHighlightedTest(null);
      }, HIGHLIGHT_DURATION_MS);
    }, SCROLL_DELAY_MS);
  }, []);

  /**
   * 하이라이트 초기화
   */
  const clearHighlights = useCallback(() => {
    setHighlightedTraces(new Set());
    setHighlightedTest(null);
  }, []);

  /**
   * 스크롤 완료 처리
   */
  const clearScrollTarget = useCallback(() => {
    setScrollTarget(null);
  }, []);

  return {
    highlightedTraces,
    highlightedTest,
    scrollTarget,
    highlightTraces,
    highlightTest,
    clearHighlights,
    clearScrollTarget,
  };
}
