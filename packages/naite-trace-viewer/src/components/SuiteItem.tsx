import type { NaiteMessagingTypes } from "naite-types";
import { useLayoutEffect, useRef } from "react";

import { goToLocation, handleStickyToggle } from "../hooks";
import { createTestKey, escapeId, traceMatchesQuery } from "../utils";
import { ExpandArrow } from "./ExpandArrow";
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
  searchQuery: string;
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
  searchQuery,
  onToggle,
  onToggleTest,
  onToggleTrace,
}: SuiteItemProps) {
  const suiteId = escapeId(suiteName);
  const testFileName = suiteFilePath ? suiteFilePath.split("/").pop() : null;
  const suiteHeaderRef = useRef<HTMLDivElement>(null);
  const suiteContentRef = useRef<HTMLDivElement>(null);

  // 스위트 헤더 높이 변화 감지 및 CSS 변수 업데이트
  useLayoutEffect(() => {
    const headerEl = suiteHeaderRef.current;
    const contentEl = suiteContentRef.current;
    if (!headerEl || !contentEl) return;

    const updateHeight = () => {
      const height = headerEl.offsetHeight;
      contentEl.style.setProperty("--suite-header-height", `${height}px`);
    };

    // 초기 설정
    updateHeight();

    // ResizeObserver로 높이 변화 감지
    const observer = new ResizeObserver(updateHeight);
    observer.observe(headerEl);

    return () => observer.disconnect();
  }, []);

  // 통계 계산
  const suiteTestCount = testMap.size;
  let suiteTraceCount = 0;
  for (const result of testMap.values()) {
    suiteTraceCount += result.traces.length;
  }

  // 검색 모드에서 매칭되는 trace가 있는지 확인
  const hasSuiteMatchingTrace = searchQuery
    ? Array.from(testMap.values()).some((result) =>
        result.traces.some((t) => traceMatchesQuery(t.key, searchQuery)),
      )
    : true;

  const handleHeaderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    handleStickyToggle(e.currentTarget, "suite", expanded, onToggle);
  };

  const handleFileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (suiteFilePath) {
      goToLocation(suiteFilePath, 1);
    }
  };

  return (
    <div
      className={`suite-group ${searchQuery && !hasSuiteMatchingTrace ? "search-hidden" : ""}`}
      data-suite={suiteName}
    >
      <div ref={suiteHeaderRef} className="suite-header" onClick={handleHeaderClick}>
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
        ref={suiteContentRef}
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
              searchQuery={searchQuery}
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
