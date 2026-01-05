import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { mockTestResults } from "./lib/mock-data";
import { vscode } from "./lib/vscode-api";

// 개발 모드에서 mock 데이터로 초기화
if (import.meta.env.DEV) {
  setTimeout(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "updateTestResults", testResults: mockTestResults },
      }),
    );
  }, 100);
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  // webview 준비 완료를 extension에 알림
  // 이를 통해 extension은 메시지 큐에 저장해둔 focusKey/focusTest 메시지를 전송할 수 있습니다.
  vscode.postMessage({ type: "ready" });
}
