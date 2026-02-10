import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "naite-trace-viewer/index.css";
import { disconnectConnection, initConnection } from "./lib/connection";

// WebSocket 연결 초기화
initConnection();

// 페이지 언로드 시 WebSocket 연결 정리
window.addEventListener("beforeunload", () => {
  disconnectConnection();
});

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
