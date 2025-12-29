import { getStickyOffsets } from "../utils";

type StickyLevel = "suite" | "test" | "trace" | "searchTrace";

/**
 * 스티키 상태에서 토글 시 스크롤 보정을 위한 헬퍼
 *
 * 스티키 상태에서 접으면 스크롤이 갑자기 점프하는 것을 방지합니다.
 * 접은 후 헤더가 스티키 위치에 오도록 스크롤을 조정합니다.
 *
 * @param headerElement - 토글할 헤더 요소
 * @param level - 스티키 레벨 (suite, test, trace, searchTrace)
 * @param willCollapse - 접을 것인지 여부
 * @param onToggle - 실제 토글 수행 함수
 */
export function handleStickyToggle(
  headerElement: HTMLElement | undefined,
  level: StickyLevel,
  willCollapse: boolean,
  onToggle: () => void,
) {
  // 스티키 상태에서 접을 때만 특수 처리
  if (!willCollapse || !headerElement) {
    onToggle();
    return;
  }

  const container = document.getElementById("traces-container");
  if (!container) {
    onToggle();
    return;
  }

  const rect = headerElement.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const offsets = getStickyOffsets();
  const stickyTop = containerRect.top + offsets[level];

  // 현재 스티키 상태인지 확인 (1px 여유)
  const isStuck = rect.top <= stickyTop + 1;

  if (!isStuck) {
    onToggle();
    return;
  }

  // 상태 변경
  onToggle();

  // DOM 업데이트 후 스크롤 조정
  requestAnimationFrame(() => {
    headerElement.scrollIntoView({ block: "start" });
    container.scrollBy({ top: -offsets[level], behavior: "instant" });
  });
}
