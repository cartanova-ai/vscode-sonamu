import type { NaiteMessagingTypes } from "naite-types";
import { type Dispatch, useEffect, useRef } from "react";
import { vscode } from "../lib/vscode-api";
import type { TraceViewerState, VSCodeOutgoingMessage } from "../types";
import { serializeState } from "./useTraceViewerState";

type Action =
  | { type: "SET_TEST_RESULTS"; testResults: NaiteMessagingTypes.TestResult[] }
  | { type: "FOCUS_KEY"; key: string }
  | { type: "FOCUS_TEST"; suiteName: string; testName: string };

/**
 * VSCode 상태 저장/복원 및 메시지 동기화 훅
 *
 * - 상태 변경 시 자동 저장 (vscode.setState)
 * - VSCode 메시지 수신 → dispatch 연결
 * - goToLocation 발신
 */
export function useVSCodeSync(state: TraceViewerState, dispatch: Dispatch<Action>) {
  const isFirstRender = useRef(true);

  // 상태 변경 시 VSCode에 저장 (첫 렌더 제외)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    vscode.setState(serializeState(state));
  }, [state]);

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
  }, [dispatch]);
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
