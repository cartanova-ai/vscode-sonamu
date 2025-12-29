import type { NaiteMessagingTypes } from "naite-types";
import { type Dispatch, type RefObject, useMemo, useRef, useState } from "react";
import type { MatchedTrace, SearchResultGroup } from "../../types";
import { traceMatchesQuery } from "./fuzzyMatch";

const DEBOUNCE_MS = 100;

type Action =
  | { type: "SET_SEARCH_MODE"; mode: boolean }
  | { type: "SET_SEARCH_QUERY"; query: string };

/**
 * 검색 기능 훅
 *
 * - 검색어 입력 (디바운싱 100ms)
 * - 검색 모드 열기/닫기
 * - 검색 결과 그룹화 (메모이제이션)
 */
export function useSearch(
  _searchQuery: string,
  _searchMode: boolean,
  testResults: NaiteMessagingTypes.TestResult[],
  dispatch: Dispatch<Action>,
  searchInputRef: RefObject<HTMLInputElement | null>,
) {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openSearch = () => {
    dispatch({ type: "SET_SEARCH_MODE", mode: true });
    setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 50);
  };

  const closeSearch = () => {
    dispatch({ type: "SET_SEARCH_MODE", mode: false });
  };

  const handleSearchChange = (value: string) => {
    dispatch({ type: "SET_SEARCH_QUERY", query: value });

    // 디바운싱
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, DEBOUNCE_MS);
  };

  // 검색 결과 그룹화 (메모이제이션)
  const { searchResultGroups, matchCount } = useMemo(() => {
    const groups: SearchResultGroup[] = [];
    let count = 0;

    if (debouncedQuery) {
      for (const result of testResults) {
        const suiteName = result.suiteName || "(no suite)";
        const testName = result.testName || "(no test)";
        const matchedTraces: MatchedTrace[] = [];

        result.traces.forEach((trace, traceIdx) => {
          if (traceMatchesQuery(trace.key, debouncedQuery)) {
            matchedTraces.push({ trace, traceIdx });
            count++;
          }
        });

        if (matchedTraces.length > 0) {
          groups.push({ suiteName, testName, result, matchedTraces });
        }
      }
    }

    return { searchResultGroups: groups, matchCount: count };
  }, [debouncedQuery, testResults]);

  return {
    debouncedQuery,
    searchResultGroups,
    matchCount,
    openSearch,
    closeSearch,
    handleSearchChange,
  };
}
