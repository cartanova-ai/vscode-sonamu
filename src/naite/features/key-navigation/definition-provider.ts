import type vscode from "vscode";
import type NaiteTracker from "../../lib/tracking/tracker";

export class NaiteDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private tracker: NaiteTracker) {}

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Location[] | undefined> {
    const key = this.tracker.getKeyAtPosition(document, position);
    if (!key) return undefined;

    // Definition = 정의된 곳 (set, 즉 Naite.t)
    let locations = this.tracker.getKeyLocations(key, "set");

    // 없으면 현재 문서 스캔 후 재시도
    if (locations.length === 0) {
      await this.tracker.scanFile(document.uri);
      locations = this.tracker.getKeyLocations(key, "set");
    }

    if (locations.length === 0) return undefined;

    return locations;
  }
}
