import * as net from 'net';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// 소켓 경로
const SOCKET_DIR = path.join(os.homedir(), '.sonamu');
const SOCKET_PATH = process.platform === 'win32'
  ? '\\\\.\\pipe\\naite'
  : path.join(SOCKET_DIR, 'naite.sock');

// NaiteReporter에서 보내는 데이터 타입
export interface NaiteTraceEntry {
  key: string;
  value: any;
  filePath: string;
  lineNumber: number;
  at: string;
  runId: string;
  testSuite?: string;
  testName?: string;
}

export interface RunInfo {
  runId: string | null;
  runStartedAt: string | null;
  runEndedAt: string | null;
  currentTestSuite?: string;
  currentTestName?: string;
}

// 서버 상태
let server: net.Server | null = null;

// 현재 데이터
let currentTraces: NaiteTraceEntry[] = [];
let currentRunInfo: RunInfo = {
  runId: null,
  runStartedAt: null,
  runEndedAt: null,
};

// 변경 리스너
type TraceChangeListener = (traces: NaiteTraceEntry[]) => void;
const traceChangeListeners: TraceChangeListener[] = [];

export function onTraceChange(listener: TraceChangeListener): { dispose: () => void } {
  traceChangeListeners.push(listener);
  return {
    dispose: () => {
      const index = traceChangeListeners.indexOf(listener);
      if (index >= 0) traceChangeListeners.splice(index, 1);
    }
  };
}

function notifyTraceChange() {
  for (const listener of traceChangeListeners) {
    listener(currentTraces);
  }
}

// 데이터 접근 함수
export function getAllTraces(): NaiteTraceEntry[] {
  return currentTraces;
}

export function getTracesForLine(filePath: string, lineNumber: number): NaiteTraceEntry[] {
  return currentTraces.filter(t => t.filePath === filePath && t.lineNumber === lineNumber);
}

export function getCurrentRunInfo(): RunInfo {
  return { ...currentRunInfo };
}

export function getSocketPath(): string {
  return SOCKET_PATH;
}

// 메시지 핸들러
function handleMessage(data: any) {
  const type = data.type;

  switch (type) {
    case 'run/start':
      currentTraces = [];
      currentRunInfo = {
        runId: data.runId,
        runStartedAt: data.startedAt,
        runEndedAt: null,
      };
      notifyTraceChange();
      break;

    case 'run/end':
      currentRunInfo = {
        ...currentRunInfo,
        runEndedAt: data.endedAt,
      };
      notifyTraceChange();
      break;

    case 'test/start':
      currentRunInfo = {
        ...currentRunInfo,
        currentTestSuite: data.suite,
        currentTestName: data.name,
      };
      break;

    case 'test/end':
      currentRunInfo = {
        ...currentRunInfo,
        currentTestSuite: undefined,
        currentTestName: undefined,
      };
      break;

    case 'trace':
      const trace: NaiteTraceEntry = {
        key: data.key,
        value: data.value,
        filePath: data.filePath,
        lineNumber: data.lineNumber,
        at: data.at,
        runId: data.runId,
        testSuite: data.testSuite,
        testName: data.testName,
      };
      currentTraces.push(trace);
      notifyTraceChange();
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
    if (process.platform !== 'win32') {
      if (!fs.existsSync(SOCKET_DIR)) {
        fs.mkdirSync(SOCKET_DIR, { recursive: true });
      }
      // 기존 소켓 파일 삭제
      if (fs.existsSync(SOCKET_PATH)) {
        fs.unlinkSync(SOCKET_PATH);
      }
    }

    server = net.createServer((socket) => {
      let buffer = '';

      socket.on('data', (chunk) => {
        buffer += chunk.toString();

        // 줄바꿈으로 메시지 구분
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              handleMessage(data);
            } catch (err) {
              console.error('[Naite Socket] Parse error:', err);
            }
          }
        }
      });

      socket.on('error', (err) => {
        // 클라이언트 연결 에러 무시
      });
    });

    server.listen(SOCKET_PATH, () => {
      console.log(`[Naite Socket Server] Listening on ${SOCKET_PATH}`);
      resolve(SOCKET_PATH);
    });

    server.on('error', (err) => {
      console.error('[Naite Socket Server] Error:', err);
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
    if (process.platform !== 'win32' && fs.existsSync(SOCKET_PATH)) {
      try {
        fs.unlinkSync(SOCKET_PATH);
      } catch {}
    }

    console.log('[Naite Socket Server] Stopped');
  }
}

// 데이터 초기화
export function clearTraces(): void {
  currentTraces = [];
  currentRunInfo = {
    runId: null,
    runStartedAt: null,
    runEndedAt: null,
  };
  notifyTraceChange();
}
