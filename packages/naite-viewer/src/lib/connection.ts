/**
 * WebSocket 연결 관리
 * VSCode의 postMessage/getState/setState를 대체합니다.
 */

type MessageHandler = (data: unknown) => void;

let ws: WebSocket | null = null;
let messageHandlers: MessageHandler[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isDisconnecting = false;

const WS_URL = `ws://${window.location.hostname}:${window.location.port || "3400"}/ws`;

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function connect() {
  if (isDisconnecting) {
    return;
  }

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log("[naite-viewer] WebSocket connected");
    clearReconnectTimer();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      for (const handler of messageHandlers) {
        handler(data);
      }
    } catch (err) {
      console.error("[naite-viewer] Failed to parse message:", err);
    }
  };

  ws.onclose = () => {
    if (isDisconnecting) {
      return;
    }
    console.log("[naite-viewer] WebSocket disconnected, reconnecting...");
    ws = null;
    clearReconnectTimer();
    reconnectTimer = setTimeout(connect, 2000);
  };

  ws.onerror = () => {
    ws?.close();
  };
}

export function initConnection() {
  isDisconnecting = false;
  connect();
}

/**
 * WebSocket 연결 해제 및 재연결 타이머 정리
 * 앱 언마운트 시 호출하여 리소스를 정리합니다.
 */
export function disconnectConnection(): void {
  isDisconnecting = true;
  clearReconnectTimer();
  if (ws) {
    ws.close();
    ws = null;
  }
}

export function sendMessage(message: unknown) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function onMessage(handler: MessageHandler): () => void {
  messageHandlers.push(handler);
  return () => {
    messageHandlers = messageHandlers.filter((h) => h !== handler);
  };
}

/**
 * vscode.getState/setState 대체 - localStorage 사용
 */
const STORAGE_KEY = "naite-viewer-state";

export function getPersistedState(): unknown {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setPersistedState(state: unknown): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage가 가득 찬 경우 무시
  }
}
