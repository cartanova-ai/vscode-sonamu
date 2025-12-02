import vscode from "vscode";
import {
  NaiteTraceEntry,
  RunInfo,
  getAllTraces as socketGetAllTraces,
  getCurrentRunInfo as socketGetCurrentRunInfo,
  getTracesForLine as socketGetTracesForLine,
  onTraceChange as socketOnTraceChange,
  startServer,
  stopServer,
} from "./naite-socket-server";

// Re-export for extension.ts
export { NaiteTraceEntry, RunInfo };
export const getAllTraces = socketGetAllTraces;
export const getTracesForLine = socketGetTracesForLine;
export const getCurrentRunInfo = socketGetCurrentRunInfo;
export const onTraceChange = socketOnTraceChange;

// decoration type (line 끝에 값 표시)
let runtimeDecorationType: vscode.TextEditorDecorationType | null = null;

// 라인 번호 보정값 (파일별로 관리)
const lineAdjustments = new Map<string, Map<number, number>>();

function getAdjustedLineNumber(filePath: string, originalLine: number): number {
  const adjustments = lineAdjustments.get(filePath);
  if (!adjustments) return originalLine;
  return adjustments.get(originalLine) ?? originalLine;
}

export function handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
  const filePath = event.document.uri.fsPath;
  const currentTraces = socketGetAllTraces();

  const fileTraces = currentTraces.filter((t) => t.filePath === filePath);
  if (fileTraces.length === 0) return;

  if (!lineAdjustments.has(filePath)) {
    const initialMap = new Map<number, number>();
    for (const trace of fileTraces) {
      initialMap.set(trace.lineNumber, trace.lineNumber);
    }
    lineAdjustments.set(filePath, initialMap);
  }

  const adjustments = lineAdjustments.get(filePath)!;

  for (const change of event.contentChanges) {
    const startLine = change.range.start.line + 1;
    const endLine = change.range.end.line + 1;
    const oldLineCount = endLine - startLine + 1;
    const newLineCount = change.text.split("\n").length;
    const lineDelta = newLineCount - oldLineCount;

    if (lineDelta === 0) continue;

    const newAdjustments = new Map<number, number>();
    for (const [originalLine, currentLine] of adjustments) {
      if (currentLine >= startLine) {
        newAdjustments.set(originalLine, currentLine + lineDelta);
      } else {
        newAdjustments.set(originalLine, currentLine);
      }
    }
    lineAdjustments.set(filePath, newAdjustments);
  }
}

function resetLineAdjustments(): void {
  lineAdjustments.clear();
}

function formatValue(value: any, maxLength: number = 50): string {
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

function formatValueFull(value: any): string {
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
  return str.slice(0, maxLength - 3) + "...";
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

  const config = vscode.workspace.getConfiguration("sonamu");
  if (!config.get<boolean>("runtimeValue.enabled", true)) {
    if (runtimeDecorationType) {
      editor.setDecorations(runtimeDecorationType, []);
    }
    return;
  }

  const maxLength = config.get<number>("runtimeValue.maxLength", 50);
  const decType = ensureDecorationType();

  const filePath = editor.document.uri.fsPath;
  const currentTraces = socketGetAllTraces();

  const fileTraces = currentTraces.filter((t) => t.filePath === filePath);

  const tracesByLine = new Map<number, NaiteTraceEntry[]>();
  for (const trace of fileTraces) {
    const adjustedLine = getAdjustedLineNumber(filePath, trace.lineNumber);
    const line = adjustedLine - 1;
    if (!tracesByLine.has(line)) {
      tracesByLine.set(line, []);
    }
    tracesByLine.get(line)!.push(trace);
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
      const testLabel = t.testName || "(unknown test)";
      const latestBadge = isLatest ? " ★" : "";

      hoverContent.appendMarkdown(`\`${time}\` *${testLabel}*${latestBadge}\n`);
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

export async function startRuntimeWatcher(context: vscode.ExtensionContext): Promise<string> {
  const socketPath = await startServer();

  const disposable = socketOnTraceChange(() => {
    resetLineAdjustments();
    for (const editor of vscode.window.visibleTextEditors) {
      updateRuntimeDecorations(editor);
    }
  });

  context.subscriptions.push(disposable);
  context.subscriptions.push({
    dispose: () => {
      stopServer();
    },
  });

  return socketPath;
}

export function disposeRuntimeDecorations() {
  if (runtimeDecorationType) {
    runtimeDecorationType.dispose();
    runtimeDecorationType = null;
  }
  stopServer();
}
