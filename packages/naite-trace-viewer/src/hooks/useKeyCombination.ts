import type { RefObject } from "react";
import { useEffect } from "react";

/**
 * 키 조합 감지 훅
 *
 * @param target 이벤트를 등록할 대상 (null이면 window)
 * @param predicate 키 이벤트가 조건에 맞는지 판별하는 함수
 * @param handler 조건이 맞을 때 실행할 핸들러
 */
export function useKeyCombination(
  target: RefObject<HTMLElement | null> | null,
  predicate: (e: KeyboardEvent) => boolean,
  handler: () => void,
) {
  useEffect(() => {
    const element = target?.current ?? window;

    const handleKeyDown = (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (predicate(keyEvent)) {
        e.preventDefault();
        handler();
      }
    };

    element.addEventListener("keydown", handleKeyDown);
    return () => element.removeEventListener("keydown", handleKeyDown);
  }, [target, predicate, handler]);
}
