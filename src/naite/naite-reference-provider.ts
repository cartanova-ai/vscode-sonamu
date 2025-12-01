import type vscode from "vscode";
import type { NaiteTracker } from "./naite-tracker";

/**
 * Naite 키의 사용처를 찾습니다 (Find All References)
 */
export class NaiteReferenceProvider implements vscode.ReferenceProvider {
  constructor(private tracker: NaiteTracker) {}

  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Location[] | undefined> {
    const key = this.getKeyAtPosition(document, position);
    if (!key) return undefined;

    // References = 사용된 곳 (get, 즉 Naite.get/expect 등)
    let locations = this.tracker.getKeyLocations(key, "get");

    // 없으면 현재 문서 스캔 후 재시도
    if (locations.length === 0) {
      await this.tracker.scanFile(document.uri);
      locations = this.tracker.getKeyLocations(key, "get");
    }

    if (locations.length === 0) return undefined;

    return locations;
  }

  private getKeyAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): string | null {
    const line = document.lineAt(position.line).text;
    const config = this.tracker.getConfig();

    for (const patternStr of [...config.setPatterns, ...config.getPatterns]) {
      const [obj, method] = patternStr.split(".");
      if (!obj || !method) continue;

      const regex = new RegExp(`${obj}\\.${method}\\s*\\(\\s*["'\`]([^"'\`]+)["'\`]`, "g");

      let match;
      while ((match = regex.exec(line)) !== null) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;

        if (position.character >= matchStart && position.character <= matchEnd) {
          return match[1];
        }
      }
    }

    return null;
  }
}
