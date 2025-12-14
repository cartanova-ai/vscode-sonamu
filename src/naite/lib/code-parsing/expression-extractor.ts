import type vscode from "vscode";

/**
 * Document와 위치가 주어졌을 때, 해당 위치에서 Naite 호출문의 key를 추출(extract)해주는 친구입니다.
 */
export default class NaiteExpressionExtractor {
  constructor(private readonly document: vscode.TextDocument) {}

  extractKeyAtPosition(position: vscode.Position, patterns: string[]): string | null {
    const line = this.document.lineAt(position.line).text;

    for (const patternStr of patterns) {
      const [obj, method] = patternStr.split(".");
      if (!obj || !method) continue;

      const regex = new RegExp(`${obj}\\.${method}\\s*\\(\\s*["'\`]([^"'\`]+)["'\`]`, "g");

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
