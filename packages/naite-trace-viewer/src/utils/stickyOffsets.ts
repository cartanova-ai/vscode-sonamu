import type { StickyOffsets } from "../types";

/**
 * CSS 변수에서 스티키 헤더 높이를 읽고 각 레벨의 top 오프셋을 계산
 *
 * CSS 변수 (index.css에 정의):
 * - --header-height: 40px
 * - --suite-header-height: 30px
 * - --test-header-height: 34px
 * - --trace-header-height: 28px
 * - --breadcrumb-height: 28px
 *
 * 각 레벨의 스티키 top 위치에는 미세한 픽셀 보정이 있음:
 * - suite: header + 6px
 * - test: header + suite + 7px
 * - trace: header + suite + test + 5px
 * - searchBreadcrumb: header - 1px (1px 겹침으로 틈 방지)
 * - searchTrace: header + breadcrumb - 2px
 */
export function getStickyOffsets(): StickyOffsets {
  const style = getComputedStyle(document.documentElement);

  const headerHeight = parseInt(style.getPropertyValue("--header-height")) || 40;
  const suiteHeaderHeight = parseInt(style.getPropertyValue("--suite-header-height")) || 30;
  const testHeaderHeight = parseInt(style.getPropertyValue("--test-header-height")) || 34;
  const traceHeaderHeight = parseInt(style.getPropertyValue("--trace-header-height")) || 28;
  const breadcrumbHeight = parseInt(style.getPropertyValue("--breadcrumb-height")) || 28;

  return {
    headerHeight,
    suiteHeaderHeight,
    testHeaderHeight,
    traceHeaderHeight,
    breadcrumbHeight,
    // 각 헤더 타입의 스티키 top 위치 (미세 보정 포함)
    suite: headerHeight + 6,
    test: headerHeight + suiteHeaderHeight + 7,
    trace: headerHeight + suiteHeaderHeight + testHeaderHeight + 5,
    searchBreadcrumb: headerHeight - 1,
    searchTrace: headerHeight + breadcrumbHeight - 2,
  };
}
