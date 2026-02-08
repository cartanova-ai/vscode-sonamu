import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "naite-trace-viewer/index.css";
import { initConnection } from "./lib/connection";

// WebSocket 연결 초기화
initConnection();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
