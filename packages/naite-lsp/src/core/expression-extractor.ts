import type { Position } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Document와 위치가 주어졌을 때, 해당 위치에서 Naite 호출문의 key를 추출합니다.
 * 정규식 기반으로 추출합니다.
 */
export default class NaiteExpressionExtractor {
  constructor(private readonly document: TextDocument) {}

  extractKeyAtPosition(position: Position, patterns: string[]): string | null {
    const text = this.document.getText();
    const lines = text.split("\n");
    const line = lines[position.line] ?? "";

    for (const patternStr of patterns) {
      const [obj, method] = patternStr.split(".");
      if (!obj || !method) {
        continue;
      }

      const regex = new RegExp(
        `${escapeRegex(obj)}\\.${escapeRegex(method)}\\s*\\(\\s*["'\`]([^"'\`]+)["'\`]`,
        "g",
      );

      let match = regex.exec(line);
      while (match) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;

        if (position.character >= matchStart && position.character <= matchEnd) {
          return match[1];
        }

        match = regex.exec(line);
      }
    }

    return null;
  }
}
