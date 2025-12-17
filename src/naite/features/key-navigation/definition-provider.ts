import type vscode from "vscode";
import { NaiteTracker } from "../../lib/tracking/tracker";

export class NaiteDefinitionProvider implements vscode.DefinitionProvider {
  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Location[] | undefined> {
    const key = NaiteTracker.getKeyAtPosition(document, position);
    if (!key) return undefined;

    // Definition = 정의된 곳 (set, 즉 Naite.t)
    let locations = NaiteTracker.getKeyLocations(key, "set");

    // 없으면 현재 문서 스캔 후 재시도
    if (locations.length === 0) {
      await NaiteTracker.scanFile(document.uri);
      locations = NaiteTracker.getKeyLocations(key, "set");
    }

    if (locations.length === 0) return undefined;

    return locations;
  }
}
