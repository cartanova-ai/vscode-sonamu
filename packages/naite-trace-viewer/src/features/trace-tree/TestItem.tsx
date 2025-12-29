import type { NaiteMessagingTypes } from "naite-types";

import { ExpandArrow } from "../../shared/ui";
import { createTestKey, createTraceKey, escapeId } from "../../shared/utils";
import { traceMatchesQuery } from "../search/fuzzyMatch";
import { handleStickyToggle } from "../sticky-headers";
import { goToLocation } from "../vscode-sync";
import { TraceItem } from "./TraceItem";

type TestItemProps = {
  result: NaiteMessagingTypes.TestResult;
  suiteName: string;
  testName: string;
  expanded: boolean;
  highlighted: boolean;
  expandedTraces: Set<string>;
  highlightedTraces: Set<string>;
  searchQuery: string;
  onToggle: () => void;
  onToggleTrace: (traceKey: string, traceAt: string, traceIdx: number) => void;
};

export function TestItem({
  result,
  suiteName,
  testName,
  expanded,
  highlighted,
  expandedTraces,
  highlightedTraces,
  searchQuery,
  onToggle,
  onToggleTrace,
}: TestItemProps) {
  const testKey = createTestKey(suiteName, testName);
  const testId = escapeId(testKey);
  const testTraces = result.traces;

  // 검색 모드에서 매칭되는 trace가 있는지 확인
  const hasMatchingTrace = searchQuery
    ? testTraces.some((t) => traceMatchesQuery(t.key, searchQuery))
    : true;

  const handleHeaderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    handleStickyToggle(e.currentTarget, "test", expanded, onToggle);
  };

  const handleLineClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (result.testFilePath && result.testLine) {
      goToLocation(result.testFilePath, result.testLine);
    }
  };

  return (
    <div
      id={`test-${testId}`}
      className={`test-group ${highlighted ? "highlight" : ""} ${searchQuery && !hasMatchingTrace ? "search-hidden" : ""}`}
      data-suite={suiteName}
      data-test-name={testName}
    >
      <div className="test-header" onClick={handleHeaderClick}>
        <ExpandArrow expanded={expanded} className="test-arrow" id={`test-arrow-${testId}`} />
        <span className="test-name">{testName}</span>
        {result.testFilePath && result.testLine && (
          <span className="test-line" onClick={handleLineClick}>
            :{result.testLine}
          </span>
        )}
        <span className="test-count">{testTraces.length}</span>
      </div>

      <div className={`test-content ${expanded ? "" : "collapsed"}`} id={`test-content-${testId}`}>
        {testTraces.map((trace, traceIdx) => {
          const traceStateKey = createTraceKey(suiteName, testName, trace.key, trace.at, traceIdx);
          const isTraceExpanded = expandedTraces.has(traceStateKey);
          const isTraceHighlighted = highlightedTraces.has(traceStateKey);
          const isSearchMatch = searchQuery ? traceMatchesQuery(trace.key, searchQuery) : true;

          // 검색 모드에서 매칭 안되면 숨김
          if (searchQuery && !isSearchMatch) {
            return null;
          }

          return (
            <TraceItem
              key={traceStateKey}
              trace={trace}
              traceIdx={traceIdx}
              suiteName={suiteName}
              testName={testName}
              expanded={isTraceExpanded}
              highlighted={isTraceHighlighted}
              searchQuery={searchQuery}
              onToggle={() => onToggleTrace(trace.key, trace.at, traceIdx)}
            />
          );
        })}
      </div>
    </div>
  );
}
