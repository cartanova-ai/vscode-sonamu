import { useEffect } from "react";
import { escapeId } from "../utils";

const SCROLL_DELAY_MS = 100;

/**
 * 하이라이트 대상으로 스크롤하는 훅
 *
 * highlightedTest 또는 highlightedTraces가 변경되면 해당 요소로 스크롤합니다.
 * 하이라이트 해제는 useTraceViewerState에서 자동으로 처리됩니다.
 */
export function useScrollToHighlight(
  highlightedTest: string | null,
  highlightedTraces: Set<string>,
) {
  useEffect(() => {
    if (!highlightedTest && highlightedTraces.size === 0) {
      return;
    }

    // DOM 렌더 후 스크롤 (약간의 딜레이)
    const scrollTimeout = setTimeout(() => {
      if (highlightedTest) {
        scrollToElement(highlightedTest);
      } else if (highlightedTraces.size > 0) {
        const firstKey = highlightedTraces.values().next().value;
        if (firstKey) {
          scrollToElement(firstKey);
        }
      }
    }, SCROLL_DELAY_MS);

    return () => {
      clearTimeout(scrollTimeout);
    };
  }, [highlightedTest, highlightedTraces]);
}

function scrollToElement(id: string) {
  const escapedId = escapeId(id);
  const element =
    document.getElementById(`item-${escapedId}`) || document.getElementById(`test-${escapedId}`);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}
