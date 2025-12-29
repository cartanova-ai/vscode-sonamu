import type { NaiteMessagingTypes } from "naite-types";

import { ExpandArrow } from "../../components";
import { goToLocation } from "../../hooks";
import { createTestKey, escapeId } from "../../utils";
import { handleStickyToggle } from "../sticky-headers";
import { TestItem } from "./TestItem";

type SuiteItemProps = {
  suiteName: string;
  testMap: Map<string, NaiteMessagingTypes.TestResult>;
  suiteFilePath?: string;
  expanded: boolean;
  expandedTests: Set<string>;
  expandedTraces: Set<string>;
  highlightedTraces: Set<string>;
  highlightedTest: string | null;
  onToggle: () => void;
  onToggleTest: (testName: string) => void;
  onToggleTrace: (testName: string, traceKey: string, traceAt: string, traceIdx: number) => void;
};

export function SuiteItem({
  suiteName,
  testMap,
  suiteFilePath,
  expanded,
  expandedTests,
  expandedTraces,
  highlightedTraces,
  highlightedTest,
  onToggle,
  onToggleTest,
  onToggleTrace,
}: SuiteItemProps) {
  const suiteId = escapeId(suiteName);
  const testFileName = suiteFilePath ? suiteFilePath.split("/").pop() : null;

  // 통계 계산
  const suiteTestCount = testMap.size;
  let suiteTraceCount = 0;
  for (const result of testMap.values()) {
    suiteTraceCount += result.traces.length;
  }

  const handleHeaderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    handleStickyToggle(e.currentTarget, expanded, onToggle);
  };

  const handleFileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (suiteFilePath) {
      goToLocation(suiteFilePath, 1);
    }
  };

  return (
    <div className={`suite-group`} data-suite={suiteName}>
      <div className="suite-header" onClick={handleHeaderClick}>
        <ExpandArrow expanded={expanded} className="suite-arrow" id={`suite-arrow-${suiteId}`} />
        <span className="suite-name">{suiteName}</span>
        {testFileName && suiteFilePath && (
          <span className="suite-file" onClick={handleFileClick}>
            {testFileName}
          </span>
        )}
        <span className="suite-count">
          {suiteTestCount} tests · {suiteTraceCount} traces
        </span>
      </div>

      <div
        className={`suite-content ${expanded ? "" : "collapsed"}`}
        id={`suite-content-${suiteId}`}
      >
        {Array.from(testMap.entries()).map(([testName, result]) => {
          const testKey = createTestKey(suiteName, testName);
          const isTestExpanded = expandedTests.has(testKey);
          const isTestHighlighted = highlightedTest === testKey;

          return (
            <TestItem
              key={testKey}
              result={result}
              suiteName={suiteName}
              testName={testName}
              expanded={isTestExpanded}
              highlighted={isTestHighlighted}
              expandedTraces={expandedTraces}
              highlightedTraces={highlightedTraces}
              onToggle={() => onToggleTest(testName)}
              onToggleTrace={(traceKey, traceAt, traceIdx) =>
                onToggleTrace(testName, traceKey, traceAt, traceIdx)
              }
            />
          );
        })}
      </div>
    </div>
  );
}
