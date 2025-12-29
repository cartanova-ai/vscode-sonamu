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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 모든 상태를 관리하는 하나의 엔트리 포인트입니다.
  // 이 친구가 주는 state으로 UI를 그리면 되고, 이벤트는 actions를 통해 전달하면 됩니다.
  // VSCode와의 통신, 상태 저장과 복원 등 많은 일을 해줍니다.
  const { state, actions } = useTraceViewerState();

  // 코드에서 테스트 케이스 제목이나 Naite 호출 구문을 클릭하면
  // 관련 테스트 또는 트레이스가 Naite Trace Viewer에서 하이라이트되고
  // 그 위치로 스크롤도 해주는 기능이 있습니다.
  // useTraceViewerState가 지저분한 일은 다 해줘서,
  // "지금" 어떤 타겟(테스트 또는 트레이스)이 하이라이트 되어 있는지 state을 통해 알 수 있습니다.
  // 이 훅 호출은 이 타겟이 지정될 때 그 곳으로 스크롤을 수행해줍니다.
  useScrollToHighlight(state.highlightedTest, state.highlightedTraces);

  // 검색 기능
  const {
    debouncedQuery,
    searchResultGroups,
    matchCount,
    openSearch,
    closeSearch,
    handleSearchChange,
  } = useSearch(state.testResults, actions.setSearchMode, actions.setSearchQuery, searchInputRef);

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
