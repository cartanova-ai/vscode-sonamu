import type vscode from "vscode";
import { NaiteTracker } from "../../lib/tracking/tracker";

export class NaiteDefinitionProvider implements vscode.DefinitionProvider {
  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Location[] | undefined> {
    const key = NaiteTracker.getKeyAtPosition(document, position);
    if (!key) {
      return undefined;
    }

    // Definition = 정의된 곳 (set, 즉 Naite.t)
    const locations = await NaiteTracker.getKeyLocationsWithFallback(document, key, "set");

    if (locations.length === 0) {
      return undefined;
    }

    return locations;
  }
}
