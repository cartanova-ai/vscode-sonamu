import vscode from "vscode";
import NaiteExpressionScanner from "../../lib/code-parsing/expression-scanner";
import type { NaiteMessagingTypes } from "../../lib/messaging/messaging-types";
import { TraceStore } from "../../lib/messaging/trace-store";

// decoration type (line 끝에 값 표시)
let runtimeDecorationType: vscode.TextEditorDecorationType | null = null;

// 파일 변경/저장 시 Naite.t 호출 위치를 스캔해서 trace 라인 번호 업데이트
export async function syncTraceLineNumbersWithDocument(doc: vscode.TextDocument): Promise<void> {
  if (doc.languageId !== "typescript") return;

  const filePath = doc.uri.fsPath;
  const currentTraces = TraceStore.getAllTraces();
  const fileTraces = currentTraces.filter((t) => t.filePath === filePath);

  if (fileTraces.length === 0) return;

  // 현재 문서에서 Naite.t 호출 위치 스캔
  const scanner = new NaiteExpressionScanner(doc);
  const naiteCalls = Array.from(scanner.scanNaiteCalls(["Naite.t"]));

  // key -> 라인 번호 매핑 생성
  const keyToLineMap = new Map<string, number>();
  for (const call of naiteCalls) {
    const lineNumber = call.location.range.start.line + 1; // 1-based
    keyToLineMap.set(call.key, lineNumber);
  }

  // trace 라인 번호 업데이트
  TraceStore.updateTraceLineNumbers(filePath, keyToLineMap);
}

function formatValue(value: unknown, maxLength: number = 50): string {
  try {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return `"${truncate(value, maxLength - 2)}"`;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) {
      const preview = JSON.stringify(value);
      if (preview.length <= maxLength) return preview;
      const truncated = value
        .slice(0, 3)
        .map((v) => formatValue(v, 10))
        .join(", ");
      return `[${truncated}, ... +${value.length - 3}]`;
    }
    if (typeof value === "object") {
      const preview = JSON.stringify(value);
      if (preview.length <= maxLength) return preview;
      return truncate(preview, maxLength);
    }
    return String(value);
  } catch {
    return "[Error]";
  }
}

function formatValueFull(value: unknown): string {
  try {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value, null, 2);
  } catch {
    return "[Error]";
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

function ensureDecorationType(): vscode.TextEditorDecorationType {
  if (runtimeDecorationType) {
    return runtimeDecorationType;
  }

  runtimeDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
      margin: "0 0 0 1em",
      color: new vscode.ThemeColor("editorCodeLens.foreground"),
      fontStyle: "italic",
    },
  });

  return runtimeDecorationType;
}

export function updateRuntimeDecorations(editor: vscode.TextEditor) {
  if (editor.document.languageId !== "typescript") return;

  const config = vscode.workspace.getConfiguration("sonamu.naite");
  if (!config.get<boolean>("runtimeValue.enabled", true)) {
    if (runtimeDecorationType) {
      editor.setDecorations(runtimeDecorationType, []);
    }
    return;
  }

  const maxLength = config.get<number>("runtimeValue.maxLength", 50);
  const decType = ensureDecorationType();

  const filePath = editor.document.uri.fsPath;
  const currentTraces = TraceStore.getAllTraces();

  const fileTraces = currentTraces.filter((t) => t.filePath === filePath);

  const tracesByLine = new Map<number, NaiteMessagingTypes.NaiteTrace[]>();
  for (const trace of fileTraces) {
    // trace의 라인 번호를 직접 사용 (파일 변경/저장 시마다 업데이트됨)
    const line = trace.lineNumber - 1; // 0-based
    if (!tracesByLine.has(line)) {
      tracesByLine.set(line, []);
    }
    tracesByLine.get(line)?.push(trace);
  }

  const decorations: vscode.DecorationOptions[] = [];

  for (const [line, traces] of tracesByLine) {
    if (line < 0 || line >= editor.document.lineCount) continue;

    const lineText = editor.document.lineAt(line).text;
    if (!lineText.includes("Naite.t(")) continue;

    const lastTrace = traces[traces.length - 1];
    const contentText = ` // → ${formatValue(lastTrace.value, maxLength)}`;

    const hoverContent = new vscode.MarkdownString();
    hoverContent.isTrusted = true;

    const commandArgs = encodeURIComponent(JSON.stringify({ filePath, lineNumber: line + 1 }));
    const reversedTraces = [...traces].reverse();

    hoverContent.appendMarkdown(`**\`${lastTrace.key}\`** · ${traces.length}회 호출\n\n`);
    hoverContent.appendMarkdown(
      `[📊 Naite Traces에서 열기](command:sonamu.openTraceInEditor?${commandArgs})\n\n---\n\n`,
    );

    reversedTraces.forEach((t, i) => {
      const time = new Date(t.at).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const isLatest = i === 0;
      const latestBadge = isLatest ? " ★" : "";

      hoverContent.appendMarkdown(`\`${time}\`${latestBadge}\n`);
      hoverContent.appendCodeblock(formatValueFull(t.value), "json");

      if (i < reversedTraces.length - 1) {
        hoverContent.appendMarkdown(`---\n`);
      }
    });

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

export function setupRuntimeDecorationListeners(context: vscode.ExtensionContext): void {
  const disposable = TraceStore.onTestResultChange(() => {
    // 새로운 test result가 들어올 때 모든 에디터의 데코레이터 업데이트
    for (const editor of vscode.window.visibleTextEditors) {
      updateRuntimeDecorations(editor);
    }
  });

  context.subscriptions.push(disposable);
}

export function disposeRuntimeDecorations() {
  if (runtimeDecorationType) {
    runtimeDecorationType.dispose();
    runtimeDecorationType = null;
  }
}
