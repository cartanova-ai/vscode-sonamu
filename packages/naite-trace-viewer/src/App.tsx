/**
 * naite-trace-viewer 메인 컴포넌트
 *
 * ## 이 앱이 하는 일
 * Sonamu 프레임워크의 테스트 실행 시 `Naite.t("key", value)`로 기록된
 * 트레이스 데이터를 VSCode 웹뷰에 트리 형태로 표시합니다.
 *
 * ## 데이터 흐름
 * ```
 * VSCode Extension ──(postMessage)──▶ useTraceViewerState ──▶ state
 *                                              │
 *                    ┌─────────────────────────┘
 *                    ▼
 *        ┌───────────────────────┐
 *        │  state.testResults    │
 *        │  state.expanded*      │
 *        │  state.searchMode     │
 *        └───────────┬───────────┘
 *                    │
 *      ┌─────────────┼─────────────┐
 *      ▼             ▼             ▼
 * NormalView   SearchView      Header
 * (트리 뷰)    (검색 결과)    (검색/액션)
 * ```
 *
 * ## 주요 상태 (useTraceViewerState)
 * - testResults: 테스트 결과 배열 (Suite > Test > Trace 계층)
 * - collapsedSuites / expandedTests / expandedTraces: UI 토글 상태
 * - searchMode / searchQuery: 검색 모드 및 검색어
 * - highlightedTest / highlightedTraces: 하이라이트 대상
 *
 * ## 수정 가이드
 * - 검색 기능 → features/search/
 * - 트리 렌더링 → features/trace-tree/
 * - 스티키 헤더 → features/sticky-headers/
 * - 상태 관리 + VSCode 통신 → hooks/useTraceViewerState.ts
 * - 스타일 → index.css
 */

import { useRef } from "react";
import { Header } from "./components";
import { SearchView, useSearch } from "./features/search";
import { useStickyState } from "./features/sticky-headers";
import { NormalView } from "./features/trace-tree";
import { useKeyboardShortcuts, useScrollToHighlight, useTraceViewerState } from "./hooks";

export default function App() {
  const { state, actions } = useTraceViewerState();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 검색 기능
  const {
    debouncedQuery,
    searchResultGroups,
    matchCount,
    openSearch,
    closeSearch,
    handleSearchChange,
  } = useSearch(state.testResults, actions.setSearchMode, actions.setSearchQuery, searchInputRef);

  // 하이라이트 대상으로 스크롤 (해제는 useTraceViewerState에서 자동 처리)
  useScrollToHighlight(state.highlightedTest, state.highlightedTraces);

  // 키보드 단축키
  useKeyboardShortcuts(state.searchMode, openSearch, closeSearch, searchInputRef);

  // 스티키 상태 감지
  useStickyState([state.testResults, state.expandedTests, state.searchMode, debouncedQuery]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      closeSearch();
    }
  };

  return (
    <>
      <Header
        searchMode={state.searchMode}
        searchQuery={state.searchQuery}
        matchCount={matchCount}
        followEnabled={state.followEnabled}
        stats={calculateStats(state.testResults)}
        searchInputRef={searchInputRef}
        onSearchChange={handleSearchChange}
        onSearchKeyDown={handleSearchKeyDown}
        onOpenSearch={openSearch}
        onCloseSearch={closeSearch}
        onToggleFollow={actions.toggleFollow}
        onCollapseAll={actions.collapseAll}
      />

      <div id="traces-container">
        {state.testResults.length === 0 ? (
          <div className="empty">테스트를 실행하면 trace가 여기에 표시됩니다.</div>
        ) : state.searchMode && state.searchQuery ? (
          <SearchView
            searchResultGroups={searchResultGroups}
            searchQuery={state.searchQuery}
            expandedTraces={state.expandedTraces}
            onToggleTrace={actions.toggleTrace}
          />
        ) : (
          <NormalView
            testResults={state.testResults}
            collapsedSuites={state.collapsedSuites}
            expandedTests={state.expandedTests}
            expandedTraces={state.expandedTraces}
            highlightedTest={state.highlightedTest}
            highlightedTraces={state.highlightedTraces}
            onToggleSuite={actions.toggleSuite}
            onToggleTest={actions.toggleTest}
            onToggleTrace={actions.toggleTrace}
          />
        )}
      </div>
    </>
  );
}

function calculateStats(testResults: { suiteName: string; traces: unknown[] }[]) {
  const suites = new Set<string>();
  let tests = 0;
  let traces = 0;

  for (const result of testResults) {
    suites.add(result.suiteName || "(no suite)");
    tests++;
    traces += result.traces.length;
  }

  return { suites: suites.size, tests, traces };
}
