import type { NaiteMessagingTypes } from "naite-types";

import { ExpandArrow } from "../../components";
import { goToLocation } from "../../hooks";
import { createTestKey, createTraceKey, escapeId } from "../../utils";
import { handleStickyToggle } from "../sticky-headers";
import { TraceItem } from "./TraceItem";

type TestItemProps = {
  result: NaiteMessagingTypes.TestResult;
  suiteName: string;
  testName: string;
  expanded: boolean;
  highlighted: boolean;
  expandedTraces: Set<string>;
  highlightedTraces: Set<string>;
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
  onToggle,
  onToggleTrace,
}: TestItemProps) {
  const testKey = createTestKey(suiteName, testName);
  const testId = escapeId(testKey);
  const testTraces = result.traces;

  const handleHeaderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    handleStickyToggle(e.currentTarget, expanded, onToggle);
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
      className={`test-group ${highlighted ? "highlight" : ""}`}
      data-suite={suiteName}
      data-test-name={testName}
    >
      <div className="test-header" onClick={handleHeaderClick}>
        <ExpandArrow expanded={expanded} className="test-arrow" />
        <span className="test-name">{testName}</span>
        {result.testFilePath && result.testLine && (
          <span className="test-line" onClick={handleLineClick}>
            :{result.testLine}
          </span>
        )}
        <span className="test-count">{testTraces.length}</span>
      </div>

      <div className={`test-content ${expanded ? "" : "collapsed"}`}>
        {testTraces.map((trace, traceIdx) => {
          const traceStateKey = createTraceKey(suiteName, testName, trace.key, trace.at, traceIdx);
          const isTraceExpanded = expandedTraces.has(traceStateKey);
          const isTraceHighlighted = highlightedTraces.has(traceStateKey);

          return (
            <TraceItem
              key={traceStateKey}
              trace={trace}
              traceIdx={traceIdx}
              suiteName={suiteName}
              testName={testName}
              expanded={isTraceExpanded}
              highlighted={isTraceHighlighted}
              searchQuery={""}
              onToggle={() => onToggleTrace(trace.key, trace.at, traceIdx)}
            />
          );
        })}
      </div>
    </div>
  );
}
