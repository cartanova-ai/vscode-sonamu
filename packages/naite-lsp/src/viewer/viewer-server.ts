import fs from "fs";
import http from "http";
import path from "path";
import { type WebSocket, WebSocketServer } from "ws";
import { TraceStore } from "../core/trace-store.js";

const VIEWER_PORT = 3400;

let httpServer: http.Server | null = null;
let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

/**
 * naite-viewer 빌드 결과물을 서빙하는 HTTP 서버와
 * 실시간 데이터를 전달하는 WebSocket 서버를 시작합니다.
 */
export function startViewerServer(): void {
  if (httpServer) {
    return;
  }

  // naite-viewer 빌드 결과물 디렉토리
  const viewerDistDir = path.resolve(import.meta.dirname, "../../naite-viewer/dist");

  httpServer = http.createServer((req, res) => {
    // WebSocket 업그레이드 경로 제외
    if (req.url === "/ws") {
      return;
    }

    // 정적 파일 서빙
    let filePath = path.join(viewerDistDir, req.url === "/" ? "index.html" : req.url || "");

    // 파일이 없으면 index.html (SPA fallback)
    if (!fs.existsSync(filePath)) {
      filePath = path.join(viewerDistDir, "index.html");
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath);
    const mimeTypes: Record<string, string> = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".svg": "image/svg+xml",
    };

    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });

  // WebSocket 서버
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log(`[Viewer Server] Client connected (total: ${clients.size})`);

    // 초기 데이터 전송
    const testResults = TraceStore.getAllTestResults();
    ws.send(JSON.stringify({ type: "updateTestResults", testResults }));

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log("[Viewer Server] Received:", message.type);
        // 클라이언트 메시지 처리 (goToLocation 등)
      } catch (err) {
        console.error("[Viewer Server] Parse error:", err);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`[Viewer Server] Client disconnected (total: ${clients.size})`);
    });
  });

  httpServer.listen(VIEWER_PORT, () => {
    console.log(`[Viewer Server] Listening on http://localhost:${VIEWER_PORT}`);
  });

  // TraceStore 변경 시 모든 클라이언트에 브로드캐스트
  TraceStore.onTestResultAdded(() => {
    broadcastTestResults();
  });

  TraceStore.onTestResultChange(() => {
    broadcastTestResults();
  });
}

function broadcastTestResults(): void {
  const testResults = TraceStore.getAllTestResults();
  const message = JSON.stringify({ type: "updateTestResults", testResults });

  for (const client of clients) {
    if (client.readyState === 1) {
      // WebSocket.OPEN
      client.send(message);
    }
  }
}

export function broadcastToViewerClients(message: unknown): void {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}

export function stopViewerServer(): void {
  if (wss) {
    for (const client of clients) {
      client.close();
    }
    clients.clear();
    wss.close();
    wss = null;
  }
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
}
