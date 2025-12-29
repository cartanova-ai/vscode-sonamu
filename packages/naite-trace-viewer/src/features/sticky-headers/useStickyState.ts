import { useEffect } from "react";

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
    const container = document.getElementById("traces-container");
    if (!container) return;

    let ticking = false;

    const updateStickyState = () => {
      const rootStyle = getComputedStyle(document.documentElement);
      const testHeaderHeight = parseInt(rootStyle.getPropertyValue("--test-header-height")) || 34;

      // 컨테이너의 상단 위치 (헤더 바로 아래)
      const containerRect = container.getBoundingClientRect();

      const headers = document.querySelectorAll(".trace-header");
      for (const header of headers) {
        const rect = header.getBoundingClientRect();
        const isSearchResult = header.closest(".search-result-trace") !== null;

        let stickyTop: number;
        if (isSearchResult) {
          // 검색 결과: breadcrumb 높이 + 7px (CSS top 값과 일치)
          const tracesContainerEl = header.closest(".search-result-traces");
          const breadcrumbHeight = tracesContainerEl
            ? parseInt(
                getComputedStyle(tracesContainerEl).getPropertyValue("--breadcrumb-height"),
              ) || 28
            : 28;
          stickyTop = containerRect.top + breadcrumbHeight + 7;
        } else {
          // 일반 뷰: suite + test 헤더 높이 + 6px (CSS top 값과 일치)
          const suiteContent = header.closest(".suite-content");
          const suiteHeaderHeight = suiteContent
            ? parseInt(getComputedStyle(suiteContent).getPropertyValue("--suite-header-height")) ||
              32
            : 32;
          stickyTop = containerRect.top + suiteHeaderHeight + testHeaderHeight + 6;
        }

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

    container.addEventListener("scroll", onScroll, { passive: true });
    // 초기 상태 및 DOM 변경 후 업데이트
    requestAnimationFrame(updateStickyState);

    return () => container.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}
