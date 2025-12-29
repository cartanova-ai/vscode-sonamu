import type { NaiteMessagingTypes } from "naite-types";

import { SuiteItem } from "./SuiteItem";

type NormalViewProps = {
  testResults: NaiteMessagingTypes.TestResult[];
  collapsedSuites: Set<string>;
  expandedTests: Set<string>;
  expandedTraces: Set<string>;
  highlightedTraces: Set<string>;
  highlightedTest: string | null;
  searchQuery: string;
  onToggleSuite: (suiteName: string) => void;
  onToggleTest: (suiteName: string, testName: string) => void;
  onToggleTrace: (
    suiteName: string,
    testName: string,
    traceKey: string,
    traceAt: string,
    traceIdx: number,
  ) => void;
};

export function NormalView({
  testResults,
  collapsedSuites,
  expandedTests,
  expandedTraces,
  highlightedTraces,
  highlightedTest,
  searchQuery,
  onToggleSuite,
  onToggleTest,
  onToggleTrace,
}: NormalViewProps) {
  // Suite > Test 구조로 그룹화
  const suiteMap = new Map<
    string,
    { testMap: Map<string, NaiteMessagingTypes.TestResult>; suiteFilePath?: string }
  >();

  for (const result of testResults) {
    const suiteName = result.suiteName || "(no suite)";
    const testName = result.testName || "(no test)";

    if (!suiteMap.has(suiteName)) {
      suiteMap.set(suiteName, { testMap: new Map(), suiteFilePath: result.suiteFilePath });
    }
    const suiteData = suiteMap.get(suiteName) as {
      testMap: Map<string, NaiteMessagingTypes.TestResult>;
      suiteFilePath?: string;
    };
    suiteData.testMap.set(testName, result);
  }

  return (
    <div className="traces">
      {Array.from(suiteMap.entries()).map(([suiteName, suiteData]) => {
        const { testMap, suiteFilePath } = suiteData;
        const isSuiteExpanded = !collapsedSuites.has(suiteName);

        return (
          <SuiteItem
            key={suiteName}
            suiteName={suiteName}
            testMap={testMap}
            suiteFilePath={suiteFilePath}
            expanded={isSuiteExpanded}
            expandedTests={expandedTests}
            expandedTraces={expandedTraces}
            highlightedTraces={highlightedTraces}
            highlightedTest={highlightedTest}
            searchQuery={searchQuery}
            onToggle={() => onToggleSuite(suiteName)}
            onToggleTest={(testName) => onToggleTest(suiteName, testName)}
            onToggleTrace={(testName, traceKey, traceAt, traceIdx) =>
              onToggleTrace(suiteName, testName, traceKey, traceAt, traceIdx)
            }
          />
        );
      })}
    </div>
  );
}
