import type { StickyOffsets } from "../types";

/**
 * CSS 변수에서 스티키 헤더 높이를 읽고 각 레벨의 top 오프셋을 계산
 *
 * CSS 변수 (index.css에 정의):
 * - --header-height: 40px (이제 고정 헤더이므로 스크롤 오프셋에 포함 안함)
 * - --suite-header-height: 32px
 * - --test-header-height: 34px
 * - --trace-header-height: 28px
 * - --breadcrumb-height: 28px
 *
 * 스크롤 컨테이너가 #traces-container이므로 헤더 높이는 제외됨
 */
export function getStickyOffsets(): StickyOffsets {
  const style = getComputedStyle(document.documentElement);

  const headerHeight = parseInt(style.getPropertyValue("--header-height")) || 40;
  const suiteHeaderHeight = parseInt(style.getPropertyValue("--suite-header-height")) || 32;
  const testHeaderHeight = parseInt(style.getPropertyValue("--test-header-height")) || 34;
  const traceHeaderHeight = parseInt(style.getPropertyValue("--trace-header-height")) || 28;
  const breadcrumbHeight = parseInt(style.getPropertyValue("--breadcrumb-height")) || 28;

  return {
    headerHeight,
    suiteHeaderHeight,
    testHeaderHeight,
    traceHeaderHeight,
    breadcrumbHeight,
    // 각 헤더 타입의 스티키 top 위치 (CSS top 값과 일치해야 함)
    suite: 7,
    test: suiteHeaderHeight + 7,
    trace: suiteHeaderHeight + testHeaderHeight + 6,
    searchBreadcrumb: 7,
    searchTrace: breadcrumbHeight + 7,
  };
}
