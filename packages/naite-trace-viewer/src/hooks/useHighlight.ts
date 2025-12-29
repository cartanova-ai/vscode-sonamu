import { useEffect, useRef, useState } from "react";
import type { PendingHighlight } from "../types";
import { escapeId } from "../utils";

const HIGHLIGHT_DURATION_MS = 2000;
const SCROLL_DELAY_MS = 100;

/**
 * 하이라이트 상태 관리 훅
 *
 * ## pendingHighlight 패턴
 * VSCode에서 포커스 요청이 오면, reducer는 트리를 펼치고 pendingHighlight를 설정합니다.
 * 하지만 스크롤/하이라이트는 DOM이 렌더된 후에야 가능하므로, 이 훅에서 "예약된 요청"을
 * 감지하여 실제 처리 후 클리어합니다.
 *
 * 흐름: VSCode 메시지 → reducer(트리 펼침 + pending 설정) → 렌더 → useHighlight(스크롤 + 하이라이트)
 */
export function useHighlight(
  pendingHighlight: PendingHighlight | null,
  clearPendingHighlight: () => void,
) {
  const [highlightedTraces, setHighlightedTraces] = useState<Set<string>>(new Set());
  const [highlightedTest, setHighlightedTest] = useState<string | null>(null);

  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const testHighlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 요소로 스크롤
   */
  const scrollToElement = (id: string) => {
    const escapedId = escapeId(id);
    const element =
      document.getElementById(`item-${escapedId}`) || document.getElementById(`test-${escapedId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  /**
   * 여러 trace를 하이라이트하고 첫 번째로 스크롤
   */
  const highlightTraces = (traceKeys: string[]) => {
    // 기존 타이머 정리
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    // 하이라이트 적용 (약간의 딜레이로 DOM 업데이트 후 스크롤)
    setTimeout(() => {
      setHighlightedTraces(new Set(traceKeys));

      // 첫 번째 요소로 스크롤
      if (traceKeys.length > 0) {
        scrollToElement(traceKeys[0]);
      }

      // 2초 후 하이라이트 제거
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedTraces(new Set());
      }, HIGHLIGHT_DURATION_MS);
    }, SCROLL_DELAY_MS);
  };

  /**
   * 단일 test를 하이라이트하고 스크롤
   */
  const highlightTest = (testKey: string) => {
    // 기존 타이머 정리
    if (testHighlightTimeoutRef.current) {
      clearTimeout(testHighlightTimeoutRef.current);
    }

    // 하이라이트 적용
    setTimeout(() => {
      setHighlightedTest(testKey);
      scrollToElement(testKey);

      // 2초 후 하이라이트 제거
      testHighlightTimeoutRef.current = setTimeout(() => {
        setHighlightedTest(null);
      }, HIGHLIGHT_DURATION_MS);
    }, SCROLL_DELAY_MS);
  };

  // pendingHighlight 감지 → 하이라이트 적용
  useEffect(() => {
    if (!pendingHighlight) {
      return;
    }

    const { type, targets } = pendingHighlight;
    if (type === "traces" && targets.length > 0) {
      highlightTraces(targets);
    } else if (type === "test" && targets.length > 0) {
      highlightTest(targets[0]);
    }

    clearPendingHighlight();
  }, [pendingHighlight, clearPendingHighlight]);

  return {
    highlightedTest,
    highlightedTraces,
  };
}
