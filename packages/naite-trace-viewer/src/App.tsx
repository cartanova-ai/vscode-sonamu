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
import { SearchView } from "./features/search";
import { useStickyState } from "./features/sticky-headers";
import { NormalView } from "./features/trace-tree";
import { useKeyCombination, useScrollToHighlight, useTraceViewerState } from "./hooks";

export default function App() {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 모든 상태를 관리하는 하나의 엔트리 포인트입니다.
  // 이 친구가 주는 state으로 UI를 그리면 되고, 이벤트는 actions를 통해 전달하면 됩니다.
  // VSCode와의 통신, 상태 저장과 복원 등 많은 일을 해줍니다.
  // searchResult는 state에서 유도되는 derived state입니다.
  const { state, actions } = useTraceViewerState();

  // 코드에서 테스트 케이스 제목이나 Naite 호출 구문을 클릭하면
  // 관련 테스트 또는 트레이스가 Naite Trace Viewer에서 하이라이트되고
  // 그 위치로 스크롤도 해주는 기능이 있습니다.
  // useTraceViewerState가 지저분한 일은 다 해줘서,
  // "지금" 어떤 타겟(테스트 또는 트레이스)이 하이라이트 되어 있는지 state을 통해 알 수 있습니다.
  // 이 훅 호출은 이 타겟이 지정될 때 그 곳으로 스크롤을 수행해줍니다.
  useScrollToHighlight(state.highlightedTest, state.highlightedTraces);

  const openSearch = () => {
    actions.setSearchMode(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 50);
  };

  const closeSearch = () => {
    actions.setSearchMode(false);
  };

  // 전역 리스너를 달아서 "Ctrl + F"가 눌리면 검색창을 열어줍니다(openSearch).
  // 또한 검색 input에서는 "Esc"가 눌리면 검색창을 닫아줍니다(closeSearch).
  useKeyCombination(null, (e) => (e.metaKey || e.ctrlKey) && e.key === "f", openSearch);
  useKeyCombination(searchInputRef, (e) => e.key === "Escape", closeSearch);

  // 트레이스가 많으면 스크롤을 넘기는 중에 "내가 지금 어떤 스위트/케이스를 보고 있는 거지?"하고 길을 잃기 쉽습니다.
  // 사용자를 돕기 위해 마치 VSCode 파일 탐색기의 그것과 같은 스티키 헤더를 제공합니다.
  // "스티키해진"(.stuck 클래스가 붙은) 헤더들은 하단으로 향하는 그림자를 표시하게 됩니다.
  // 그리고 이 훅 호출은 헤더들의 스크롤 위치를 알아내어서 그들이 "스티키한" 상태인지 판단한 다음에 .stuck 클래스를 토글해줍니다.
  // 즉슨 이 훅은 현재 스크롤 상태를 집어다가 "스티키함" 클래스를 토글해주는 친구인겁니다.
  // 그렇다면 그 동작은 언제 수행하는가? 목록이 바뀌거나 스크롤이 이동되었을 때 수행합니다.
  // 목록이 바뀌었는지를 감지해야 하기 때문에, 목록 컨텐츠에 변화를 줄 수 있는 dependencies를 인자로 받습니다.
  useStickyState([
    state.testResults,
    state.collapsedSuites,
    state.expandedTests,
    state.expandedTraces,
    state.searchMode,
    state.debouncedSearchQuery,
  ]);

  return (
    <>
      <Header
        searchMode={state.searchMode}
        searchQuery={state.searchQuery}
        matchCount={state.searchResult.matchCount}
        followEnabled={state.followEnabled}
        stats={calculateStats(state.testResults)}
        searchInputRef={searchInputRef}
        onSearchChange={actions.setSearchQuery}
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
            searchResultGroups={state.searchResult.groups}
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
