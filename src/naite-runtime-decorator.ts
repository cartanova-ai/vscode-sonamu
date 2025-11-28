import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// trace 파일 경로
const TRACE_FILE_PATH = path.join(os.homedir(), '.sonamu', 'naite-traces.json');

// trace 파일 타입 (sonamu naite-trace.ts와 동기화)
export interface NaiteTraceFileEntry {
  key: string;
  value: any;
  filePath: string;
  lineNumber: number;
  at: string;
  runId: string;
  testSuite?: string;
  testName?: string;
}

interface NaiteTraceFile {
  version: number;
  currentRunId: string | null;
  runStartedAt: string | null;
  runEndedAt: string | null;
  traces: NaiteTraceFileEntry[];
}

// decoration type (line 끝에 값 표시)
let runtimeDecorationType: vscode.TextEditorDecorationType | null = null;

// file watcher
let fileWatcher: fs.FSWatcher | null = null;

// 현재 trace 데이터
let currentTraces: NaiteTraceFileEntry[] = [];

// 라인 번호 보정값 (파일별로 관리)
// key: filePath, value: Map<originalLineNumber, adjustedLineNumber>
const lineAdjustments = new Map<string, Map<number, number>>();

/**
 * 보정된 라인 번호 반환
 */
function getAdjustedLineNumber(filePath: string, originalLine: number): number {
  const adjustments = lineAdjustments.get(filePath);
  if (!adjustments) return originalLine;
  return adjustments.get(originalLine) ?? originalLine;
}

/**
 * 문서 변경 시 라인 번호 보정
 */
export function handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
  const filePath = event.document.uri.fsPath;

  // 해당 파일의 trace가 없으면 무시
  const fileTraces = currentTraces.filter(t => t.filePath === filePath);
  if (fileTraces.length === 0) return;

  // 기존 adjustment가 없으면 초기화
  if (!lineAdjustments.has(filePath)) {
    const initialMap = new Map<number, number>();
    for (const trace of fileTraces) {
      initialMap.set(trace.lineNumber, trace.lineNumber);
    }
    lineAdjustments.set(filePath, initialMap);
  }

  const adjustments = lineAdjustments.get(filePath)!;

  // 각 변경에 대해 라인 보정
  for (const change of event.contentChanges) {
    const startLine = change.range.start.line + 1; // 1-based
    const endLine = change.range.end.line + 1;
    const oldLineCount = endLine - startLine + 1;
    const newLineCount = change.text.split('\n').length;
    const lineDelta = newLineCount - oldLineCount;

    if (lineDelta === 0) continue;

    // 변경된 위치 이후의 라인들 보정
    const newAdjustments = new Map<number, number>();
    for (const [originalLine, currentLine] of adjustments) {
      if (currentLine >= startLine) {
        // 변경 위치 이후면 delta만큼 조정
        newAdjustments.set(originalLine, currentLine + lineDelta);
      } else {
        newAdjustments.set(originalLine, currentLine);
      }
    }
    lineAdjustments.set(filePath, newAdjustments);
  }
}

/**
 * trace 파일 다시 읽을 때 adjustment 초기화
 */
function resetLineAdjustments(): void {
  lineAdjustments.clear();
}

// 현재 trace 데이터 접근용 (외부에서 사용)
export function getTracesForLine(filePath: string, lineNumber: number): NaiteTraceFileEntry[] {
  // 보정된 라인 번호로 매칭
  return currentTraces.filter(t => {
    if (t.filePath !== filePath) return false;
    const adjustedLine = getAdjustedLineNumber(filePath, t.lineNumber);
    return adjustedLine === lineNumber;
  });
}

// 전체 trace 데이터 접근용
export function getAllTraces(): NaiteTraceFileEntry[] {
  return currentTraces;
}

// run 정보 타입
export interface RunInfo {
  runId: string | null;
  runStartedAt: string | null;
  runEndedAt: string | null;
}

// 현재 run 정보 조회
export function getCurrentRunInfo(): RunInfo {
  try {
    if (!fs.existsSync(TRACE_FILE_PATH)) {
      return { runId: null, runStartedAt: null, runEndedAt: null };
    }
    const raw = fs.readFileSync(TRACE_FILE_PATH, 'utf-8');
    const data: NaiteTraceFile = JSON.parse(raw);
    return {
      runId: data.currentRunId,
      runStartedAt: data.runStartedAt,
      runEndedAt: data.runEndedAt,
    };
  } catch {
    return { runId: null, runStartedAt: null, runEndedAt: null };
  }
}

// trace 변경 리스너
type TraceChangeListener = (traces: NaiteTraceFileEntry[]) => void;
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

/**
 * 값을 표시용 문자열로 변환 (truncate)
 */
function formatValue(value: any, maxLength: number = 50): string {
  try {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${truncate(value, maxLength - 2)}"`;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      const preview = JSON.stringify(value);
      if (preview.length <= maxLength) return preview;
      const truncated = value.slice(0, 3).map(v => formatValue(v, 10)).join(', ');
      return `[${truncated}, ... +${value.length - 3}]`;
    }
    if (typeof value === 'object') {
      const preview = JSON.stringify(value);
      if (preview.length <= maxLength) return preview;
      return truncate(preview, maxLength);
    }
    return String(value);
  } catch {
    return '[Error]';
  }
}

/**
 * 값을 전체 표시용 문자열로 변환 (pretty print)
 */
function formatValueFull(value: any): string {
  try {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value, null, 2);
  } catch {
    return '[Error]';
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * JSON 값을 syntax highlighting된 HTML로 변환
 */
function formatValueHtml(value: any, depth: number = 0): string {
  const indent = '  '.repeat(depth);
  const nextIndent = '  '.repeat(depth + 1);

  if (value === null) return '<span style="color: #569cd6;">null</span>';
  if (value === undefined) return '<span style="color: #569cd6;">undefined</span>';

  if (typeof value === 'string') {
    return `<span style="color: #ce9178;">"${escapeHtml(value)}"</span>`;
  }
  if (typeof value === 'number') {
    return `<span style="color: #b5cea8;">${value}</span>`;
  }
  if (typeof value === 'boolean') {
    return `<span style="color: #569cd6;">${value}</span>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (depth > 2) return `[...${value.length} items]`;
    const items = value.map(v => `${nextIndent}${formatValueHtml(v, depth + 1)}`).join(',\n');
    return `[\n${items}\n${indent}]`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    if (depth > 2) return `{...${keys.length} keys}`;
    const items = keys.map(k =>
      `${nextIndent}<span style="color: #9cdcfe;">"${escapeHtml(k)}"</span>: ${formatValueHtml(value[k], depth + 1)}`
    ).join(',\n');
    return `{\n${items}\n${indent}}`;
  }

  return escapeHtml(String(value));
}

/**
 * decoration type 생성
 */
function ensureDecorationType(): vscode.TextEditorDecorationType {
  if (runtimeDecorationType) {
    return runtimeDecorationType;
  }

  runtimeDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
      margin: '0 0 0 1em',
      color: new vscode.ThemeColor('editorCodeLens.foreground'),
      fontStyle: 'italic',
    },
  });

  return runtimeDecorationType;
}

/**
 * trace 파일 읽기 (현재 test run의 trace만 반환)
 */
function readTraceFile(): NaiteTraceFileEntry[] {
  try {
    if (!fs.existsSync(TRACE_FILE_PATH)) {
      return [];
    }
    const raw = fs.readFileSync(TRACE_FILE_PATH, 'utf-8');
    const data: NaiteTraceFile = JSON.parse(raw);

    // 현재 run의 trace만 필터링
    if (!data.currentRunId) {
      return [];
    }

    return (data.traces || []).filter(t => t.runId === data.currentRunId);
  } catch {
    return [];
  }
}

/**
 * 에디터에 decoration 적용
 */
export function updateRuntimeDecorations(editor: vscode.TextEditor) {
  if (editor.document.languageId !== 'typescript') return;

  // 설정 확인
  const config = vscode.workspace.getConfiguration('sonamu');
  if (!config.get<boolean>('runtimeValue.enabled', true)) {
    if (runtimeDecorationType) {
      editor.setDecorations(runtimeDecorationType, []);
    }
    return;
  }

  const maxLength = config.get<number>('runtimeValue.maxLength', 50);
  const decType = ensureDecorationType();

  // 현재 파일 경로
  const filePath = editor.document.uri.fsPath;

  // 해당 파일의 trace만 필터
  const fileTraces = currentTraces.filter(t => t.filePath === filePath);

  // 보정된 lineNumber별로 그룹화 (같은 라인에 여러 trace가 있을 수 있음)
  const tracesByLine = new Map<number, NaiteTraceFileEntry[]>();
  for (const trace of fileTraces) {
    const adjustedLine = getAdjustedLineNumber(filePath, trace.lineNumber);
    const line = adjustedLine - 1; // 0-based
    if (!tracesByLine.has(line)) {
      tracesByLine.set(line, []);
    }
    tracesByLine.get(line)!.push(trace);
  }

  const decorations: vscode.DecorationOptions[] = [];

  for (const [line, traces] of tracesByLine) {
    if (line < 0 || line >= editor.document.lineCount) continue;

    // 안전장치: 해당 라인에 실제로 Naite.t가 있는지 확인
    const lineText = editor.document.lineAt(line).text;
    if (!lineText.includes('Naite.t(')) continue;

    // 마지막 trace만 표시
    const lastTrace = traces[traces.length - 1];
    const contentText = ` // → ${formatValue(lastTrace.value, maxLength)}`;

    // 호버 시 전체 값 표시 (모든 trace 포함)
    const hoverContent = new vscode.MarkdownString();
    hoverContent.isTrusted = true;

    // command link용 인코딩
    const commandArgs = encodeURIComponent(JSON.stringify({ filePath, lineNumber: line + 1 }));

    // 역순으로 표시 (최신이 위로)
    const reversedTraces = [...traces].reverse();

    // 헤더
    hoverContent.appendMarkdown(`**\`${lastTrace.key}\`** · ${traces.length}회 호출\n\n`);
    hoverContent.appendMarkdown(`[📊 Naite Traces에서 열기](command:sonamu.openTraceInEditor?${commandArgs})\n\n---\n\n`);

    // Trace 목록
    reversedTraces.forEach((t, i) => {
      const time = new Date(t.at).toLocaleTimeString('ko-KR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
      const isLatest = i === 0;
      const testLabel = t.testName || '(unknown test)';
      const latestBadge = isLatest ? ' ★' : '';

      hoverContent.appendMarkdown(`\`${time}\` *${testLabel}*${latestBadge}\n`);
      hoverContent.appendCodeblock(formatValueFull(t.value), 'json');

      if (i < reversedTraces.length - 1) {
        hoverContent.appendMarkdown(`---\n`);
      }
    });


    // 라인 끝 위치에만 decoration 적용 (호버 영역 제한)
    const lineEnd = editor.document.lineAt(line).range.end;
    decorations.push({
      range: new vscode.Range(lineEnd, lineEnd),
      hoverMessage: hoverContent,
      renderOptions: {
        after: {
          contentText,
        },
      },
    });
  }

  editor.setDecorations(decType, decorations);
}

/**
 * 파일 watcher 시작
 */
export function startRuntimeWatcher(context: vscode.ExtensionContext) {
  // 초기 로드
  currentTraces = readTraceFile();
  resetLineAdjustments();  // 새로 읽으면 보정값 초기화
  notifyTraceChange();

  // 파일 변경 감지 (debounce)
  let debounceTimer: NodeJS.Timeout | null = null;

  const watchDir = path.dirname(TRACE_FILE_PATH);

  // 디렉토리가 없으면 생성 시도
  try {
    if (!fs.existsSync(watchDir)) {
      fs.mkdirSync(watchDir, { recursive: true });
    }
  } catch {
    // 디렉토리 생성 실패 무시
  }

  // 파일 watcher
  try {
    fileWatcher = fs.watch(watchDir, (eventType, filename) => {
      if (filename !== 'naite-traces.json') return;

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        currentTraces = readTraceFile();
        resetLineAdjustments();  // 새로 읽으면 보정값 초기화
        notifyTraceChange();

        // 모든 visible editor 업데이트
        for (const editor of vscode.window.visibleTextEditors) {
          updateRuntimeDecorations(editor);
        }
      }, 100);
    });

    context.subscriptions.push({
      dispose: () => {
        if (fileWatcher) {
          fileWatcher.close();
          fileWatcher = null;
        }
      },
    });
  } catch {
    // watcher 생성 실패 무시
  }
}

/**
 * 정리
 */
export function disposeRuntimeDecorations() {
  if (runtimeDecorationType) {
    runtimeDecorationType.dispose();
    runtimeDecorationType = null;
  }
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
}
