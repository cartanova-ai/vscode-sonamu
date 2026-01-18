import type { NaiteMessagingTypes } from "naite-types";
import vscode from "vscode";
import { TraceStore } from "../../lib/messaging/trace-store";

// decoration type (line 끝에 값 표시)
let inlineValueDecorationType: vscode.TextEditorDecorationType | null = null;

interface FormatOptions {
  /** 최대 길이 제한. undefined이면 제한 없음 (full 모드) */
  maxLength?: number;
  /** full 모드에서 JSON에 들여쓰기 적용 */
  pretty?: boolean;
}

/**
 * 값을 문자열로 포맷팅합니다.
 * @param value 포맷팅할 값
 * @param options 포맷 옵션
 */
function formatValueCore(value: unknown, options: FormatOptions = {}): string {
  const { maxLength, pretty = false } = options;
  const isLimited = maxLength !== undefined;

  try {
    if (value === null) {
      return "null";
    }
    if (value === undefined) {
      return "undefined";
    }
    if (typeof value === "string") {
      if (isLimited) {
        return `"${truncate(value, maxLength - 2)}"`;
      }
      return JSON.stringify(value);
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value) && isLimited) {
      const preview = JSON.stringify(value);
      if (preview.length <= maxLength) {
        return preview;
      }
      const truncated = value
        .slice(0, 3)
        .map((v) => formatValueCore(v, { maxLength: 10 }))
        .join(", ");
      return `[${truncated}, ... +${value.length - 3}]`;
    }
    if (typeof value === "object") {
      const preview = JSON.stringify(value, null, pretty ? 2 : undefined);
      if (isLimited && preview.length > maxLength) {
        return truncate(preview, maxLength);
      }
      return preview;
    }
    return String(value);
  } catch {
    return "[Error]";
  }
}

/** 인라인 표시용 짧은 포맷 (기본 50자 제한) */
function formatValue(value: unknown, maxLength: number = 50): string {
  return formatValueCore(value, { maxLength });
}

/** 호버 표시용 전체 포맷 (제한 없음, 들여쓰기 적용) */
function formatValueFull(value: unknown): string {
  return formatValueCore(value, { pretty: true });
}

function truncate(str: string, maxLength: number): string {
  if (maxLength < 4) {
    // 최소한 "..." 표시를 위해 4자 이상 필요
    return str.slice(0, Math.max(0, maxLength));
  }
  if (str.length <= maxLength) {
    return str;
  }
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
