import { type RefObject, useLayoutEffect } from "react";

/**
 * 소스 요소의 높이를 관찰하여 타겟 요소에 CSS 변수로 설정
 *
 * @param sourceRef 높이를 측정할 요소
 * @param targetRef CSS 변수를 설정할 요소
 * @param cssVarName CSS 변수 이름 (-- 접두사 없이)
 */
export function useResizeObserverCSSVar(
  sourceRef: RefObject<HTMLElement | null>,
  targetRef: RefObject<HTMLElement | null>,
  cssVarName: string,
) {
  useLayoutEffect(() => {
    const sourceEl = sourceRef.current;
    const targetEl = targetRef.current;
    if (!sourceEl || !targetEl) return;

    const updateHeight = () => {
      const height = sourceEl.offsetHeight;
      targetEl.style.setProperty(`--${cssVarName}`, `${height}px`);
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(sourceEl);

    return () => observer.disconnect();
  }, [sourceRef, targetRef, cssVarName]);
}
