import type { NaiteMessagingTypes } from "naite-types";
import { useLayoutEffect, useRef } from "react";
import type { MatchedTrace, SearchResultGroup } from "../../types";
import { createTraceKey, getFileName } from "../../utils";
import { TraceItem } from "../trace-tree/TraceItem";
import { goToLocation } from "../vscode-sync";

type SearchViewProps = {
  searchResultGroups: SearchResultGroup[];
  searchQuery: string;
  expandedTraces: Set<string>;
  onToggleTrace: (
    suiteName: string,
    testName: string,
    traceKey: string,
    traceAt: string,
    traceIdx: number,
  ) => void;
};

export function SearchView({
  searchResultGroups,
  searchQuery,
  expandedTraces,
  onToggleTrace,
}: SearchViewProps) {
  if (searchResultGroups.length === 0) {
    return (
      <div className="search-results">
        <div className="empty">검색 결과가 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="search-results">
      {searchResultGroups.map(({ suiteName, testName, result, matchedTraces }) => (
        <SearchResultItem
          key={`${suiteName}::${testName}`}
          suiteName={suiteName}
          testName={testName}
          result={result}
          matchedTraces={matchedTraces}
          searchQuery={searchQuery}
          expandedTraces={expandedTraces}
          onToggleTrace={onToggleTrace}
        />
      ))}
    </div>
  );
}

type SearchResultItemProps = {
  suiteName: string;
  testName: string;
  result: NaiteMessagingTypes.TestResult;
  matchedTraces: MatchedTrace[];
  searchQuery: string;
  expandedTraces: Set<string>;
  onToggleTrace: (
    suiteName: string,
    testName: string,
    traceKey: string,
    traceAt: string,
    traceIdx: number,
  ) => void;
};

function SearchResultItem({
  suiteName,
  testName,
  result,
  matchedTraces,
  searchQuery,
  expandedTraces,
  onToggleTrace,
}: SearchResultItemProps) {
  const breadcrumbRef = useRef<HTMLDivElement>(null);
  const tracesContainerRef = useRef<HTMLDivElement>(null);

  // breadcrumb 높이 변화 감지 및 CSS 변수 업데이트
  useLayoutEffect(() => {
    const breadcrumbEl = breadcrumbRef.current;
    const tracesEl = tracesContainerRef.current;
    if (!breadcrumbEl || !tracesEl) return;

    const updateHeight = () => {
      const height = breadcrumbEl.offsetHeight;
      tracesEl.style.setProperty("--breadcrumb-height", `${height}px`);
    };

    // 초기 설정
    updateHeight();

    // ResizeObserver로 높이 변화 감지
    const observer = new ResizeObserver(updateHeight);
    observer.observe(breadcrumbEl);

    return () => observer.disconnect();
  }, []);

  const handleLocationClick = () => {
    goToLocation(result.testFilePath, result.testLine);
  };

  return (
    <div className="search-result-item">
      <div ref={breadcrumbRef} className="search-result-breadcrumb">
        <span className="breadcrumb-title">
          <span className="breadcrumb-suite">{suiteName}</span>
          <span className="breadcrumb-separator">›</span>
          <span className="breadcrumb-test">{testName}</span>
        </span>
        <span className="breadcrumb-location" onClick={handleLocationClick}>
          {getFileName(result.testFilePath)}:{result.testLine}
        </span>
        <span className="breadcrumb-count">{matchedTraces.length}</span>
      </div>
      <div ref={tracesContainerRef} className="search-result-traces">
        {matchedTraces.map(({ trace, traceIdx }) => {
          const traceStateKey = createTraceKey(suiteName, testName, trace.key, trace.at, traceIdx);
          const isTraceExpanded = expandedTraces.has(traceStateKey);

          return (
            <TraceItem
              key={traceStateKey}
              trace={trace}
              traceIdx={traceIdx}
              suiteName={suiteName}
              testName={testName}
              expanded={isTraceExpanded}
              highlighted={false}
              searchQuery={searchQuery}
              isSearchResult
              onToggle={() => onToggleTrace(suiteName, testName, trace.key, trace.at, traceIdx)}
            />
          );
        })}
      </div>
    </div>
  );
}
