import { Header } from "naite-trace-viewer/components";
import { SearchView } from "naite-trace-viewer/features/search";
import { useStickyState } from "naite-trace-viewer/features/sticky-headers";
import { NormalView } from "naite-trace-viewer/features/trace-tree";
import { useKeyCombination, useScrollToHighlight } from "naite-trace-viewer/hooks";
import { useRef } from "react";
import { useTraceViewerState } from "./hooks/useTraceViewerState";

export default function App() {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { state, actions } = useTraceViewerState();

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

  useKeyCombination(null, (e) => (e.metaKey || e.ctrlKey) && e.key === "f", openSearch);
  useKeyCombination(searchInputRef, (e) => e.key === "Escape", closeSearch);

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
