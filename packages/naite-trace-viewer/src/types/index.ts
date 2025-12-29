import type { NaiteMessagingTypes } from "naite-types";

/**
 * 런타임 상태 (Set 사용)
 * React 컴포넌트에서 사용하는 상태 타입
 */
export type TraceViewerState = {
  testResults: NaiteMessagingTypes.TestResult[];
  collapsedSuites: Set<string>; // 닫힌 suite (기본 펼침)
  expandedTests: Set<string>; // 열린 test (기본 접힘)
  expandedTraces: Set<string>; // 열린 trace (기본 접힘)
  followEnabled: boolean;
  searchQuery: string; // 입력창에 표시되는 검색어
  debouncedSearchQuery: string; // 디바운스된 검색어 (실제 검색에 사용)
  searchMode: boolean;
  highlightedTest: string | null; // 하이라이트된 테스트 키
  highlightedTraces: Set<string>; // 하이라이트된 트레이스 키들
};

/**
 * useTraceViewerState 훅이 반환하는 state 타입
 * TraceViewerState + derived state (searchResult)
 */
export type TraceViewerStateWithDerived = TraceViewerState & {
  searchResult: { groups: SearchResultGroup[]; matchCount: number };
};

/**
 * VSCode 저장용 상태 (Array로 직렬화)
 * vscode.setState()에 저장되는 형태
 */
export type PersistedState = {
  testResults: NaiteMessagingTypes.TestResult[];
  collapsedSuites: string[];
  expandedTests: string[];
  expandedTraces: string[];
  followEnabled: boolean;
  // searchQuery, searchMode는 저장하지 않음 (임시 상태)
};

/**
 * 퍼지 매칭 결과
 */
export type FuzzyMatchResult = {
  matched: boolean;
  indices: number[];
  score: number;
};

/**
 * 검색 결과에서 매칭된 trace
 */
export type MatchedTrace = {
  trace: NaiteMessagingTypes.NaiteTrace;
  traceIdx: number;
};

/**
 * 검색 결과 그룹 (테스트 케이스별)
 */
export type SearchResultGroup = {
  suiteName: string;
  testName: string;
  result: NaiteMessagingTypes.TestResult;
  matchedTraces: MatchedTrace[];
};

/**
 * VSCode API 메시지 타입들
 */
export type VSCodeMessage =
  | { type: "updateTestResults"; testResults: NaiteMessagingTypes.TestResult[] }
  | { type: "focusKey"; key: string }
  | { type: "focusTest"; suiteName: string; testName: string };

export type VSCodeOutgoingMessage =
  | { type: "goToLocation"; filePath: string; lineNumber: number }
  | { type: "followStateChanged"; enabled: boolean };
