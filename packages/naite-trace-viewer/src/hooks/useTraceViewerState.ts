import type { NaiteMessagingTypes } from "naite-types";
import { useReducer } from "react";
import { vscode } from "../lib/vscode-api";
import type { PersistedState, TraceViewerState } from "../types";
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
  | { type: "FOCUS_KEY"; key: string }
  | { type: "FOCUS_TEST"; suiteName: string; testName: string }
  | { type: "CLEAR_PENDING_HIGHLIGHT" };

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

    case "FOCUS_KEY": {
      // 해당 key를 가진 모든 trace 찾아서 부모 열기
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
        pendingHighlight:
          matchingTraceKeys.length > 0 ? { type: "traces", targets: matchingTraceKeys } : null,
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
        pendingHighlight: { type: "test", targets: [testKey] },
      };
    }

    case "CLEAR_PENDING_HIGHLIGHT":
      return { ...state, pendingHighlight: null };

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
    searchMode: false,
    pendingHighlight: null,
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
 */
export function useTraceViewerState() {
  const [state, dispatch] = useReducer(reducer, null, createInitialState);

  return { state, dispatch };
}
