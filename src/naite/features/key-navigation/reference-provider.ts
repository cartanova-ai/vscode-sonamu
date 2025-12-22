import type vscode from "vscode";
import { NaiteTracker } from "../../lib/tracking/tracker";

/**
 * Naite 키의 사용처를 찾습니다 (Find All References)
 */
export class NaiteReferenceProvider implements vscode.ReferenceProvider {
  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Location[] | undefined> {
    const key = NaiteTracker.getKeyAtPosition(document, position);
    if (!key) {
      return undefined;
    }

    // References = 사용된 곳 (get, 즉 Naite.get/expect 등)
    let locations = NaiteTracker.getKeyLocations(key, "get");

    // 없으면 현재 문서 스캔 후 재시도
    if (locations.length === 0) {
      await NaiteTracker.scanFile(document.uri);
      locations = NaiteTracker.getKeyLocations(key, "get");
    }

    if (locations.length === 0) {
      return undefined;
    }

    return locations;
  }
}
