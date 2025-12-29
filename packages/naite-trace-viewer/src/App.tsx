/**
 * naite-trace-viewer 메인 컴포넌트
 *
 * ## 이 앱이 하는 일
 * Sonamu 프레임워크의 테스트 실행 시 `Naite.t("key", value)`로 기록된
 * 트레이스 데이터를 VSCode 웹뷰에 트리 형태로 표시합니다.
 *
 * ## 데이터 흐름
 * ```
 * VSCode Extension ──(postMessage)──▶ useVSCodeSync ──(dispatch)──▶ useTraceViewerState
 *                                                                          │
 *                                      ┌───────────────────────────────────┘
 *                                      ▼
 *                          ┌───────────────────────┐
 *                          │  state.testResults    │
 *                          │  state.expanded*      │
 *                          │  state.searchMode     │
 *                          └───────────┬───────────┘
 *                                      │
 *                    ┌─────────────────┼─────────────────┐
 *                    ▼                 ▼                 ▼
 *              NormalView        SearchView          Header
 *              (트리 뷰)         (검색 결과)        (검색/액션)
 * ```
 *
 * ## 주요 상태 (useTraceViewerState)
 * - testResults: 테스트 결과 배열 (Suite > Test > Trace 계층)
 * - collapsedSuites / expandedTests / expandedTraces: UI 토글 상태
 * - searchMode / searchQuery: 검색 모드 및 검색어
 * - pendingHighlight: 포커스 요청 시 하이라이트 대상 (일회성)
 *
 * ## 수정 가이드
 * - 검색 기능 → features/search/
 * - 트리 렌더링 → features/trace-tree/
 * - 스티키 헤더 → features/sticky-headers/
 * - VSCode 통신 → features/vscode-sync/
 * - 상태 관리 → hooks/useTraceViewerState.ts
 * - 스타일 → index.css
 */

import { useEffect, useRef } from "react";
import { Header } from "./components";
import { SearchView, useSearch } from "./features/search";
import { useStickyState } from "./features/sticky-headers";
import { NormalView } from "./features/trace-tree";
import { sendFollowStateChanged, useVSCodeSync } from "./features/vscode-sync";
import { useHighlight, useKeyboardShortcuts, useTraceViewerState } from "./hooks";
import { escapeId } from "./utils";

export default function App() {
  const { state, dispatch } = useTraceViewerState();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // VSCode 상태 동기화
  useVSCodeSync(state, dispatch);

  // 검색 기능
  const {
    debouncedQuery,
    searchResultGroups,
    matchCount,
    openSearch,
    closeSearch,
    handleSearchChange,
  } = useSearch(state.searchQuery, state.searchMode, state.testResults, dispatch, searchInputRef);

  // 하이라이트 기능
  const {
    highlightedTraces,
    highlightedTest,
    scrollTarget,
    highlightTraces,
    highlightTest,
    clearScrollTarget,
  } = useHighlight();

  // 키보드 단축키
  useKeyboardShortcuts(state.searchMode, openSearch, closeSearch, searchInputRef);

  // 스티키 상태 감지
  useStickyState([state.testResults, state.expandedTests, state.searchMode, debouncedQuery]);

  // pendingHighlight 감지 → 하이라이트 적용
  useEffect(() => {
    if (!state.pendingHighlight) return;

    const { type, targets } = state.pendingHighlight;
    if (type === "traces" && targets.length > 0) {
      highlightTraces(targets);
    } else if (type === "test" && targets.length > 0) {
      highlightTest(targets[0]);
    }

    dispatch({ type: "CLEAR_PENDING_HIGHLIGHT" });
  }, [state.pendingHighlight, highlightTraces, highlightTest, dispatch]);

  // 스크롤 타겟 처리
  useEffect(() => {
    if (!scrollTarget) return;

    const escapedId = escapeId(scrollTarget);
    const element =
      document.getElementById(`item-${escapedId}`) || document.getElementById(`test-${escapedId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    clearScrollTarget();
  }, [scrollTarget, clearScrollTarget]);

  // 통계 계산
  const stats = calculateStats(state.testResults);

  // 토글 핸들러
  const handleToggleSuite = (suiteName: string) => {
    dispatch({ type: "TOGGLE_SUITE", suiteName });
  };

  const handleToggleTest = (suiteName: string, testName: string) => {
    dispatch({ type: "TOGGLE_TEST", suiteName, testName });
  };

  const handleToggleTrace = (
    suiteName: string,
    testName: string,
    traceKey: string,
    traceAt: string,
    traceIdx: number,
  ) => {
    dispatch({ type: "TOGGLE_TRACE", suiteName, testName, traceKey, traceAt, traceIdx });
  };

  const handleToggleFollow = () => {
    const newEnabled = !state.followEnabled;
    dispatch({ type: "SET_FOLLOW", enabled: newEnabled });
    sendFollowStateChanged(newEnabled);
  };

  const handleCollapseAll = () => {
    dispatch({ type: "COLLAPSE_ALL" });
  };

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
        stats={stats}
        searchInputRef={searchInputRef}
        onSearchChange={handleSearchChange}
        onSearchKeyDown={handleSearchKeyDown}
        onOpenSearch={openSearch}
        onCloseSearch={closeSearch}
        onToggleFollow={handleToggleFollow}
        onCollapseAll={handleCollapseAll}
      />

      <div id="traces-container">
        {state.testResults.length === 0 ? (
          <div className="empty">테스트를 실행하면 trace가 여기에 표시됩니다.</div>
        ) : state.searchMode && state.searchQuery ? (
          <SearchView
            searchResultGroups={searchResultGroups}
            searchQuery={state.searchQuery}
            expandedTraces={state.expandedTraces}
            onToggleTrace={handleToggleTrace}
          />
        ) : (
          <NormalView
            testResults={state.testResults}
            collapsedSuites={state.collapsedSuites}
            expandedTests={state.expandedTests}
            expandedTraces={state.expandedTraces}
            highlightedTraces={highlightedTraces}
            highlightedTest={highlightedTest}
            searchQuery="" // 검색 모드가 아닐 때는 필터 비활성화 (검색어는 다음 검색을 위해 state에 보존)
            onToggleSuite={handleToggleSuite}
            onToggleTest={handleToggleTest}
            onToggleTrace={handleToggleTrace}
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
