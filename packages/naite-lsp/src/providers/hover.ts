import { type Hover, type HoverParams, MarkupKind } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { NaiteTracker } from "../core/tracker.js";

export function handleHover(params: HoverParams, document: TextDocument | undefined): Hover | null {
  if (!document) {
    return null;
  }

  const key = NaiteTracker.getKeyAtPosition(document, params.position);
  if (!key) {
    return null;
  }

  const setLocs = NaiteTracker.getKeyLocations(key, "set");
  const getLocs = NaiteTracker.getKeyLocations(key, "get");

  let md = `\`\`\`typescript\n(Naite key) "${key}"\n\`\`\`\n\n`;
  md += `**정의**: ${setLocs.length}개\n\n`;

  for (const loc of setLocs.slice(0, 3)) {
    const fileName = loc.uri.split("/").pop() || loc.uri;
    md += `- ${fileName}:${loc.range.start.line + 1}\n`;
  }
  if (setLocs.length > 3) {
    md += `- ... 외 ${setLocs.length - 3}개\n`;
  }

  md += `\n**사용**: ${getLocs.length}개\n\n`;
  for (const loc of getLocs.slice(0, 3)) {
    const fileName = loc.uri.split("/").pop() || loc.uri;
    md += `- ${fileName}:${loc.range.start.line + 1}\n`;
  }
  if (getLocs.length > 3) {
    md += `- ... 외 ${getLocs.length - 3}개\n`;
  }

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: md,
    },
  };
}
