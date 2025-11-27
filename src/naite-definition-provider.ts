import * as vscode from 'vscode';
import { NaiteTracker } from './naite-tracker';

export class NaiteDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private tracker: NaiteTracker) {}

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Location[] | undefined> {
    const key = this.getKeyAtPosition(document, position);
    if (!key) return undefined;

    // Definition = 정의된 곳 (set, 즉 Naite.t)
    let locations = this.tracker.getKeyLocations(key, 'set');

    // 없으면 현재 문서 스캔 후 재시도
    if (locations.length === 0) {
      await this.tracker.scanFile(document.uri);
      locations = this.tracker.getKeyLocations(key, 'set');
    }

    if (locations.length === 0) return undefined;

    return locations;
  }

  /**
   * 현재 위치에서 Naite 키를 추출 (regex 기반)
   */
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
