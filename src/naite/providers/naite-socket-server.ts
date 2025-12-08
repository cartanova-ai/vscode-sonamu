import fs from "fs";
import net from "net";
import os from "os";
import path from "path";

// 소켓 경로
const SOCKET_DIR = path.join(os.homedir(), ".sonamu");
const SOCKET_PATH =
  process.platform === "win32" ? "\\\\.\\pipe\\naite" : path.join(SOCKET_DIR, "naite.sock");

export interface NaiteTrace {
  key: string;
  value: any;
  filePath: string;
  lineNumber: number;
  at: string;
}

// 테스트 결과 엔트리
export interface TestResultEntry {
  suiteName: string;
  suiteFilePath?: string;
  testName: string;
  testFilePath: string;
  testLine: number;
  status: string;
  duration: number;
  error?: { message: string; stack?: string };
  traces: NaiteTrace[];
  receivedAt: string;
}

// 서버 상태
let server: net.Server | null = null;

// 현재 데이터
let currentTestResults: TestResultEntry[] = [];

// 변경 리스너
type TestResultChangeListener = (testResults: TestResultEntry[]) => void;
const testResultChangeListeners: TestResultChangeListener[] = [];

export function onTestResultChange(listener: TestResultChangeListener): { dispose: () => void } {
  testResultChangeListeners.push(listener);
  return {
    dispose: () => {
      const index = testResultChangeListeners.indexOf(listener);
      if (index >= 0) testResultChangeListeners.splice(index, 1);
    },
  };
}

// 메시지 버퍼 및 debounce
let pendingMessages: any[] = [];
let processDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_DELAY = 100;

function queueMessage(data: any) {
  // run/start는 즉시 처리 (데이터 클리어 + 리스너 알림)
  if (data.type === "run/start") {
    // 대기 중인 메시지 즉시 처리
    if (processDebounceTimer) {
      clearTimeout(processDebounceTimer);
      processDebounceTimer = null;
    }
    if (pendingMessages.length > 0) {
      for (const msg of pendingMessages) {
        processMessage(msg);
      }
      pendingMessages = [];
    }

    // run/start 즉시 처리
    processMessage(data);
    for (const listener of testResultChangeListeners) {
      listener(currentTestResults);
    }
    return;
  }

  pendingMessages.push(data);

  // 이전 타이머 취소
  if (processDebounceTimer) {
    clearTimeout(processDebounceTimer);
  }

  // 새 타이머 설정
  processDebounceTimer = setTimeout(() => {
    processDebounceTimer = null;

    for (const msg of pendingMessages) {
      processMessage(msg);
    }
    pendingMessages = [];

    // 리스너 알림
    for (const listener of testResultChangeListeners) {
      listener(currentTestResults);
    }
  }, DEBOUNCE_DELAY);
}

// 데이터 접근 함수
export function getAllTestResults(): TestResultEntry[] {
  return currentTestResults;
}

// 모든 traces를 flat하게 추출 (기존 코드 호환용)
export function getAllTraces(): NaiteTrace[] {
  return currentTestResults.flatMap((r) => r.traces);
}

export function getTracesForLine(filePath: string, lineNumber: number): NaiteTrace[] {
  return getAllTraces().filter((t) => t.filePath === filePath && t.lineNumber === lineNumber);
}

// 특정 파일의 trace 라인 번호를 업데이트 (key와 새 라인 번호 매핑)
export function updateTraceLineNumbers(filePath: string, keyToLineMap: Map<string, number>): void {
  let updated = false;
  for (const testResult of currentTestResults) {
    for (const trace of testResult.traces) {
      const newLineNumber = keyToLineMap.get(trace.key);
      if (trace.filePath === filePath && newLineNumber !== undefined) {
        if (trace.lineNumber !== newLineNumber) {
          trace.lineNumber = newLineNumber;
          updated = true;
        }
      }
    }
  }

  // 변경사항이 있으면 리스너 알림
  if (updated) {
    for (const listener of testResultChangeListeners) {
      listener(currentTestResults);
    }
  }
}

// 메시지 처리
function processMessage(data: any) {
  const type = data.type;

  switch (type) {
    case "run/start":
      // 새 테스트 run 시작 - 데이터 클리어
      currentTestResults = [];
      break;

    case "test/result": {
      // 테스트 케이스 결과 추가
      const entry: TestResultEntry = {
        suiteName: data.suiteName,
        suiteFilePath: data.suiteFilePath,
        testName: data.testName,
        testFilePath: data.testFilePath,
        testLine: data.testLine,
        status: data.status,
        duration: data.duration,
        error: data.error,
        traces: data.traces ?? [],
        receivedAt: data.receivedAt,
      };
      currentTestResults.push(entry);
      break;
    }

    case "run/end":
      // run 종료 - 현재는 특별히 처리할 것 없음
      break;
  }
}

// 서버 시작
export function startServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (server) {
      resolve(SOCKET_PATH);
      return;
    }

    // 디렉토리 생성
    if (process.platform !== "win32") {
      if (!fs.existsSync(SOCKET_DIR)) {
        fs.mkdirSync(SOCKET_DIR, { recursive: true });
      }
      // 기존 소켓 파일 삭제
      if (fs.existsSync(SOCKET_PATH)) {
        fs.unlinkSync(SOCKET_PATH);
      }
    }

    server = net.createServer((socket) => {
      let buffer = "";

      socket.on("data", (chunk) => {
        buffer += chunk.toString();
        console.log("[Naite Socket] Received chunk, buffer length:", buffer.length);

        // 줄바꿈으로 메시지 구분
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        console.log("[Naite Socket] Lines to process:", lines.length);

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              console.log("[Naite Socket] Parsed message type:", data.type);
              queueMessage(data);
            } catch (err) {
              console.error("[Naite Socket] Parse error:", err);
            }
          }
        }
      });

      socket.on("error", (err) => {
        // 클라이언트 연결 에러 무시
      });
    });

    server.listen(SOCKET_PATH, () => {
      console.log(`[Naite Socket Server] Listening on ${SOCKET_PATH}`);
      resolve(SOCKET_PATH);
    });

    server.on("error", (err) => {
      console.error("[Naite Socket Server] Error:", err);
      reject(err);
    });
  });
}

// 서버 정지
export function stopServer(): void {
  if (server) {
    server.close();
    server = null;

    // 소켓 파일 삭제
    if (process.platform !== "win32" && fs.existsSync(SOCKET_PATH)) {
      try {
        fs.unlinkSync(SOCKET_PATH);
      } catch {}
    }

    console.log("[Naite Socket Server] Stopped");
  }
}
