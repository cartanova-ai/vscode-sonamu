import type { NaiteMessagingTypes } from "naite-types";
import { useEffect, useMemo, useReducer, useRef } from "react";
import { filterBySearchQuery } from "../features/search";
import { vscode } from "../lib/vscode-api";
import type { PersistedState, TraceViewerState, VSCodeOutgoingMessage } from "../types";
import { createTestKey, createTraceKey } from "../utils";

type Action =
  | { type: "SET_TEST_RESULTS"; testResults: NaiteMessagingTypes.TestResult[] }
  | { type: "TOGGLE_SUITE"; suiteName: string }
  | { type: "TOGGLE_TEST"; suiteName: string; testName: string }
  | {
      type: "TOGGLE_TRACE";
      suiteName: string;
      testName: string;
      traceKey: string;
      traceAt: string;
      traceIdx: number;
    }
  | { type: "COLLAPSE_ALL" }
  | { type: "SET_FOLLOW"; enabled: boolean }
  | { type: "SET_SEARCH_MODE"; mode: boolean }
  | { type: "SET_SEARCH_QUERY"; query: string }
  | { type: "SET_DEBOUNCED_SEARCH_QUERY"; query: string }
  | { type: "FOCUS_KEY"; key: string }
  | { type: "FOCUS_TEST"; suiteName: string; testName: string }
  | { type: "CLEAR_HIGHLIGHT" };

function reducer(state: TraceViewerState, action: Action): TraceViewerState {
  switch (action.type) {
    case "SET_TEST_RESULTS":
      return { ...state, testResults: action.testResults };

    case "TOGGLE_SUITE": {
      const newSet = new Set(state.collapsedSuites);
      if (newSet.has(action.suiteName)) {
        newSet.delete(action.suiteName);
      } else {
        newSet.add(action.suiteName);
      }
      return { ...state, collapsedSuites: newSet };
    }

    case "TOGGLE_TEST": {
      const testKey = createTestKey(action.suiteName, action.testName);
      const newSet = new Set(state.expandedTests);
      if (newSet.has(testKey)) {
        newSet.delete(testKey);
      } else {
        newSet.add(testKey);
      }
      return { ...state, expandedTests: newSet };
    }

    case "TOGGLE_TRACE": {
      const traceStateKey = createTraceKey(
        action.suiteName,
        action.testName,
        action.traceKey,
        action.traceAt,
        action.traceIdx,
      );
      const newSet = new Set(state.expandedTraces);
      if (newSet.has(traceStateKey)) {
        newSet.delete(traceStateKey);
      } else {
        newSet.add(traceStateKey);
      }
      return { ...state, expandedTraces: newSet };
    }

    case "COLLAPSE_ALL": {
      // 모든 suite 이름 수집
      const allSuites = new Set<string>();
      for (const result of state.testResults) {
        allSuites.add(result.suiteName);
      }
      return {
        ...state,
        collapsedSuites: allSuites,
        expandedTests: new Set(),
        expandedTraces: new Set(),
      };
    }

    case "SET_FOLLOW":
      return { ...state, followEnabled: action.enabled };

    case "SET_SEARCH_MODE":
      return { ...state, searchMode: action.mode };

    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.query };

    case "SET_DEBOUNCED_SEARCH_QUERY":
      return { ...state, debouncedSearchQuery: action.query };

    case "FOCUS_KEY": {
      // VSCode에서 "이 trace로 포커스해줘" 요청이 왔을 때:
      // Suite/Test/Trace를 열고 하이라이트 상태 설정
      const newCollapsedSuites = new Set(state.collapsedSuites);
      const newExpandedTests = new Set(state.expandedTests);
      const newExpandedTraces = new Set(state.expandedTraces);
      const matchingTraceKeys: string[] = [];

      for (const result of state.testResults) {
        for (let i = 0; i < result.traces.length; i++) {
          const trace = result.traces[i];
          if (trace.key === action.key) {
            const traceStateKey = createTraceKey(
              result.suiteName,
              result.testName,
              trace.key,
              trace.at,
              i,
            );
            const testKey = createTestKey(result.suiteName, result.testName);

            // Suite 열기
            newCollapsedSuites.delete(result.suiteName);
            // Test 열기
            newExpandedTests.add(testKey);
            // Trace 열기
            newExpandedTraces.add(traceStateKey);
            // 하이라이트 대상 수집
            matchingTraceKeys.push(traceStateKey);
          }
        }
      }

      return {
        ...state,
        collapsedSuites: newCollapsedSuites,
        expandedTests: newExpandedTests,
        expandedTraces: newExpandedTraces,
        searchMode: false,
        highlightedTest: null,
        highlightedTraces: new Set(matchingTraceKeys),
      };
    }

    case "FOCUS_TEST": {
      const newCollapsedSuites = new Set(state.collapsedSuites);
      const newExpandedTests = new Set(state.expandedTests);
      const testKey = createTestKey(action.suiteName, action.testName);

      // Suite 열기
      newCollapsedSuites.delete(action.suiteName);
      // Test 열기
      newExpandedTests.add(testKey);

      return {
        ...state,
        collapsedSuites: newCollapsedSuites,
        expandedTests: newExpandedTests,
        searchMode: false,
        highlightedTest: testKey,
        highlightedTraces: new Set(),
      };
    }

    case "CLEAR_HIGHLIGHT":
      return { ...state, highlightedTest: null, highlightedTraces: new Set() };

    default:
      return state;
  }
}

/**
 * 초기 상태 생성 (VSCode 저장 상태 복원)
 */
function createInitialState(): TraceViewerState {
  const saved = vscode.getState() as Partial<PersistedState> | null;

  return {
    testResults: saved?.testResults ?? [],
    collapsedSuites: new Set(saved?.collapsedSuites ?? []),
    expandedTests: new Set(saved?.expandedTests ?? []),
    expandedTraces: new Set(saved?.expandedTraces ?? []),
    followEnabled: saved?.followEnabled ?? true,
    searchQuery: "",
    debouncedSearchQuery: "",
    searchMode: false,
    highlightedTest: null,
    highlightedTraces: new Set(),
  };
}

/**
 * 상태를 VSCode 저장용 형태로 변환
 */
export function serializeState(state: TraceViewerState): PersistedState {
  return {
    testResults: state.testResults,
    collapsedSuites: [...state.collapsedSuites],
    expandedTests: [...state.expandedTests],
    expandedTraces: [...state.expandedTraces],
    followEnabled: state.followEnabled,
  };
}

/**
 * Trace Viewer 핵심 상태 관리 훅
 *
 * - reducer 기반 상태 관리
 * - VSCode 상태 저장/복원 (vscode.getState/setState)
 * - VSCode 메시지 수신 → dispatch 연결
 * - 편의용 actions 제공 (dispatch 래핑)
 */
const HIGHLIGHT_DURATION_MS = 2000;
const SEARCH_DEBOUNCE_MS = 100;

export function useTraceViewerState() {
  const [state, dispatch] = useReducer(reducer, null, createInitialState);
  const isFirstRender = useRef(true);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 상태 변경 시 VSCode에 저장 (첫 렌더 제외)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    vscode.setState(serializeState(state));
  }, [state]);

  // 하이라이트 자동 해제 (2초 후)
  useEffect(() => {
    const hasHighlight = state.highlightedTest || state.highlightedTraces.size > 0;
    if (!hasHighlight) {
      return;
    }

    // 기존 타이머 정리
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = setTimeout(() => {
      dispatch({ type: "CLEAR_HIGHLIGHT" });
    }, HIGHLIGHT_DURATION_MS);

    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [state.highlightedTest, state.highlightedTraces]);

  // 검색어 디바운싱 (100ms 후 debouncedSearchQuery 업데이트)
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      dispatch({ type: "SET_DEBOUNCED_SEARCH_QUERY", query: state.searchQuery });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [state.searchQuery]);

  // VSCode 메시지 수신 처리
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === "updateTestResults") {
        dispatch({
          type: "SET_TEST_RESULTS",
          testResults: message.testResults || [],
        });
      }

      if (message.type === "focusKey") {
        dispatch({ type: "FOCUS_KEY", key: message.key });
      }

      if (message.type === "focusTest") {
        dispatch({
          type: "FOCUS_TEST",
          suiteName: message.suiteName,
          testName: message.testName,
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // 검색 결과 (derived state)
  const searchResult = useMemo(
    () => filterBySearchQuery(state.testResults, state.debouncedSearchQuery),
    [state.testResults, state.debouncedSearchQuery],
  );

  // 편의용 actions (dispatch 래핑)
  const actions = {
    toggleSuite: (suiteName: string) => {
      dispatch({ type: "TOGGLE_SUITE", suiteName });
    },
    toggleTest: (suiteName: string, testName: string) => {
      dispatch({ type: "TOGGLE_TEST", suiteName, testName });
    },
    toggleTrace: (
      suiteName: string,
      testName: string,
      traceKey: string,
      traceAt: string,
      traceIdx: number,
    ) => {
      dispatch({ type: "TOGGLE_TRACE", suiteName, testName, traceKey, traceAt, traceIdx });
    },
    toggleFollow: () => {
      const newEnabled = !state.followEnabled;
      dispatch({ type: "SET_FOLLOW", enabled: newEnabled });
      sendFollowStateChanged(newEnabled);
    },
    collapseAll: () => {
      dispatch({ type: "COLLAPSE_ALL" });
    },
    setSearchMode: (mode: boolean) => {
      dispatch({ type: "SET_SEARCH_MODE", mode });
    },
    setSearchQuery: (query: string) => {
      dispatch({ type: "SET_SEARCH_QUERY", query });
    },
  };

  return { state, actions, searchResult };
}

/**
 * 파일 위치로 이동 메시지 발신
 */
export function goToLocation(filePath: string, lineNumber: number) {
  const message: VSCodeOutgoingMessage = { type: "goToLocation", filePath, lineNumber };
  vscode.postMessage(message);
}

/**
 * Follow 상태 변경 메시지 발신
 */
export function sendFollowStateChanged(enabled: boolean) {
  const message: VSCodeOutgoingMessage = { type: "followStateChanged", enabled };
  vscode.postMessage(message);
}
