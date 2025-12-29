import type { NaiteMessagingTypes } from "naite-types";
import { useRef } from "react";
import { useResizeObserverCSSVar } from "../../hooks";
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

  useResizeObserverCSSVar(breadcrumbRef, tracesContainerRef, "breadcrumb-height");

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
