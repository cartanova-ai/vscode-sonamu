import * as vscode from 'vscode';
import { NaiteTracker } from './naite-tracker';

/**
 * Naite 키의 모든 참조를 찾습니다 (Find All References)
 */
export class NaiteReferenceProvider implements vscode.ReferenceProvider {
  constructor(private tracker: NaiteTracker) {}

  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext
  ): Promise<vscode.Location[] | undefined> {
    const key = this.getKeyAtPosition(document, position);
    if (!key) return undefined;

    // 현재 문서 스캔 (아직 안 됐을 수 있음)
    await this.tracker.scanFile(document.uri);

    // 모든 위치 반환 (set + get)
    return this.tracker.getKeyLocations(key);
  }

  private getKeyAtPosition(document: vscode.TextDocument, position: vscode.Position): string | null {
    const line = document.lineAt(position.line).text;
    const config = this.tracker.getConfig();

    for (const patternStr of [...config.setPatterns, ...config.getPatterns]) {
      const [obj, method] = patternStr.split('.');
      if (!obj || !method) continue;

      const regex = new RegExp(`${obj}\\.${method}\\s*\\(\\s*["'\`]([^"'\`]+)["'\`]`, 'g');

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
