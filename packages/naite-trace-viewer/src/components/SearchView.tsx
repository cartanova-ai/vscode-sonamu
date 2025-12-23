import type { SearchResultGroup } from "../types";
import { TraceItem } from "./TraceItem";
import { createTraceKey, getFileName } from "../utils";
import { goToLocation } from "../hooks";

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
      {searchResultGroups.map(({ suiteName, testName, result, matchedTraces }) => {
        const groupKey = `${suiteName}::${testName}`;

        const handleLocationClick = () => {
          goToLocation(result.testFilePath, result.testLine);
        };

        return (
          <div key={groupKey} className="search-result-item">
            <div className="search-result-breadcrumb">
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
            <div className="search-result-traces">
              {matchedTraces.map(({ trace, traceIdx }) => {
                const traceStateKey = createTraceKey(
                  suiteName,
                  testName,
                  trace.key,
                  trace.at,
                  traceIdx,
                );
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
      })}
    </div>
  );
}
