import {
  type InlayHint,
  InlayHintKind,
  type InlayHintParams,
  Position,
} from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { TraceStore } from "../core/trace-store.js";

function formatValue(value: unknown, maxLength: number = 50): string {
  try {
    if (value === null) {
      return "null";
    }
    if (value === undefined) {
      return "undefined";
    }
    if (typeof value === "string") {
      const str = `"${value}"`;
      if (str.length > maxLength) {
        return `${str.slice(0, maxLength - 3)}...`;
      }
      return str;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    const preview = JSON.stringify(value);
    if (preview.length > maxLength) {
      return `${preview.slice(0, maxLength - 3)}...`;
    }
    return preview;
  } catch {
    return "[Error]";
  }
}

export function handleInlayHints(
  params: InlayHintParams,
  document: TextDocument | undefined,
): InlayHint[] | null {
  if (!document) {
    return null;
  }

  const filePath = document.uri.startsWith("file://") ? document.uri.slice(7) : document.uri;
  const currentTraces = TraceStore.getAllTraces();
  const fileTraces = currentTraces.filter((t) => t.filePath === filePath);

  if (fileTraces.length === 0) {
    return null;
  }

  const text = document.getText();
  const lines = text.split("\n");

  const tracesByLine = new Map<number, typeof fileTraces>();
  for (const trace of fileTraces) {
    const line = trace.lineNumber - 1; // 0-based
    if (!tracesByLine.has(line)) {
      tracesByLine.set(line, []);
    }
    tracesByLine.get(line)?.push(trace);
  }

  const hints: InlayHint[] = [];

  for (const [line, traces] of tracesByLine) {
    if (line < 0 || line >= lines.length) {
      continue;
    }

    // 범위 체크
    if (line < params.range.start.line || line > params.range.end.line) {
      continue;
    }

    const lineText = lines[line];
    if (!lineText.includes("Naite.t(")) {
      continue;
    }

    const lastTrace = traces[traces.length - 1];
    const label = ` → ${formatValue(lastTrace.value)}`;

    hints.push({
      position: Position.create(line, lineText.length),
      label,
      kind: InlayHintKind.Parameter,
      paddingLeft: true,
    });
  }

  return hints;
}
