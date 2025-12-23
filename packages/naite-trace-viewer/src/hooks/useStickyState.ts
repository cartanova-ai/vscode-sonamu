import { useEffect } from "react";
import { getStickyOffsets } from "../utils";

/**
 * 스티키 헤더 상태 감지 훅
 *
 * - 스크롤 이벤트로 .trace-header의 스티키 상태 감지
 * - 스티키 상태일 때 .stuck 클래스 추가 (그림자 표시용)
 * - requestAnimationFrame으로 성능 최적화
 * - passive listener로 스크롤 성능 저하 방지
 */
export function useStickyState(dependencies: unknown[]) {
  useEffect(() => {
    let ticking = false;

    const updateStickyState = () => {
      const offsets = getStickyOffsets();
      const normalViewStickyTop = offsets.trace;
      const searchViewStickyTop = offsets.searchTrace;

      const headers = document.querySelectorAll(".trace-header");
      for (const header of headers) {
        const rect = header.getBoundingClientRect();
        const isSearchResult = header.closest(".search-result-trace") !== null;
        const stickyTop = isSearchResult ? searchViewStickyTop : normalViewStickyTop;

        // 약간의 여유를 두고 판단 (1px)
        const isStuck = rect.top <= stickyTop + 1;
        header.classList.toggle("stuck", isStuck);
      }

      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateStickyState);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // 초기 상태 및 DOM 변경 후 업데이트
    requestAnimationFrame(updateStickyState);

    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}
