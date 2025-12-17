import vscode from "vscode";
import type { NaiteMessagingTypes } from "../../lib/messaging/messaging-types";
import { TraceStore } from "../../lib/messaging/trace-store";

// decoration type (line 끝에 값 표시)
let inlineValueDecorationType: vscode.TextEditorDecorationType | null = null;

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
  if (inlineValueDecorationType) {
    return inlineValueDecorationType;
  }

  inlineValueDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
      margin: "0 0 0 1em",
      color: new vscode.ThemeColor("editorCodeLens.foreground"),
      fontStyle: "italic",
    },
  });

  return inlineValueDecorationType;
}

export function updateInlineValueDecorations(editor: vscode.TextEditor) {
  if (editor.document.languageId !== "typescript") {
    return;
  }

  const config = vscode.workspace.getConfiguration("sonamu.naite");
  if (!config.get<boolean>("runtimeValue.enabled", true)) {
    if (inlineValueDecorationType) {
      editor.setDecorations(inlineValueDecorationType, []);
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
    if (line < 0 || line >= editor.document.lineCount) {
      continue;
    }

    const lineText = editor.document.lineAt(line).text;
    if (!lineText.includes("Naite.t(")) {
      continue;
    }

    const lastTrace = traces[traces.length - 1];
    const contentText = ` // → ${formatValue(lastTrace.value, maxLength)}`;

    const hoverContent = new vscode.MarkdownString();
    hoverContent.isTrusted = true;

    const reversedTraces = [...traces].reverse();

    hoverContent.appendMarkdown(`**\`${lastTrace.key}\`** · ${traces.length}회 호출\n\n---\n\n`);

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

export function disposeInlineValueDecorations() {
  if (inlineValueDecorationType) {
    inlineValueDecorationType.dispose();
    inlineValueDecorationType = null;
  }
}
