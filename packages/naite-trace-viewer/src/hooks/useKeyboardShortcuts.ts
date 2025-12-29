import { type RefObject, useEffect } from "react";

/**
 * 전역 키보드 단축키 훅
 *
 * - Cmd/Ctrl+F: 검색 열기 또는 검색어 전체 선택
 * - ESC: 검색 닫기
 */
export function useKeyboardShortcuts(
  searchMode: boolean,
  openSearch: () => void,
  closeSearch: () => void,
  searchInputRef: RefObject<HTMLInputElement | null>,
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F: 검색창 열기 또는 검색어 전체 선택
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        if (searchMode) {
          searchInputRef.current?.select();
        } else {
          openSearch();
        }
      }

      // ESC: 검색창 닫기 (검색창에 포커스 없어도)
      if (e.key === "Escape" && searchMode) {
        closeSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchMode, openSearch, closeSearch, searchInputRef]);
}
