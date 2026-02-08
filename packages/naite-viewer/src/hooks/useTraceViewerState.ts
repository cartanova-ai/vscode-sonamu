import { filterBySearchQuery } from "naite-trace-viewer/features/search";
import type {
  PersistedState,
  TraceViewerState,
  VSCodeOutgoingMessage,
} from "naite-trace-viewer/types";
import { createTestKey, createTraceKey } from "naite-trace-viewer/utils";
import type { NaiteMessagingTypes } from "naite-types";
import { useEffect, useMemo, useReducer, useRef } from "react";
import { getPersistedState, onMessage, sendMessage, setPersistedState } from "../lib/connection";

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

const HIGHLIGHT_DURATION_MS = 2000;
const SEARCH_DEBOUNCE_MS = 100;

export function useTraceViewerState() {
  const [state, dispatch] = useReducer(reducer, null, createInitialState);
  const isFirstRender = useRef(true);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 상태 변경 시 localStorage에 저장 (첫 렌더 제외)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPersistedState(serializeState(state));
  }, [state]);

  // 하이라이트 자동 해제 (2초 후)
  useEffect(() => {
    const hasHighlight = state.highlightedTest || state.highlightedTraces.size > 0;
    if (!hasHighlight) {
      return;
    }

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

  // 검색어 디바운싱
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

  // WebSocket 메시지 수신 처리
  useEffect(() => {
    const cleanup = onMessage((data: unknown) => {
      const message = data as { type: string; [key: string]: unknown };

      if (message.type === "updateTestResults") {
        dispatch({
          type: "SET_TEST_RESULTS",
          testResults: (message.testResults as NaiteMessagingTypes.TestResult[]) || [],
        });
      }

      if (message.type === "focusKey") {
        dispatch({ type: "FOCUS_KEY", key: message.key as string });
      }

      if (message.type === "focusTest") {
        dispatch({
          type: "FOCUS_TEST",
          suiteName: message.suiteName as string,
          testName: message.testName as string,
        });
      }
    });

    return cleanup;
  }, []);

  const stateWithDerived = useMemo(
    () => ({
      ...state,
      searchResult: filterBySearchQuery(state.testResults, state.debouncedSearchQuery),
    }),
    [state],
  );

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

  return { state: stateWithDerived, actions };
}

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

            newCollapsedSuites.delete(result.suiteName);
            newExpandedTests.add(testKey);
            newExpandedTraces.add(traceStateKey);
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

      newCollapsedSuites.delete(action.suiteName);
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

function createInitialState(): TraceViewerState {
  const saved = getPersistedState() as Partial<PersistedState> | null;

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

export function serializeState(state: TraceViewerState): PersistedState {
  return {
    testResults: state.testResults,
    collapsedSuites: [...state.collapsedSuites],
    expandedTests: [...state.expandedTests],
    expandedTraces: [...state.expandedTraces],
    followEnabled: state.followEnabled,
  };
}

export function goToLocation(filePath: string, lineNumber: number) {
  const message: VSCodeOutgoingMessage = { type: "goToLocation", filePath, lineNumber };
  sendMessage(message);
}

export function sendFollowStateChanged(enabled: boolean) {
  const message: VSCodeOutgoingMessage = { type: "followStateChanged", enabled };
  sendMessage(message);
}
