import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { mockTestResults } from "./lib/mock-data";

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
}
