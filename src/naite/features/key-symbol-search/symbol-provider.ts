import vscode from "vscode";
import type NaiteTracker from "../../lib/tracking/tracker";

/**
 * 문서 내 Naite 키를 심볼로 제공합니다 (Cmd+Shift+O)
 */
export class NaiteDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  constructor(private tracker: NaiteTracker) {}

  provideDocumentSymbols(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.DocumentSymbol[] {
    const entries = this.tracker.getEntriesForFile(document.uri);

    return entries
      .filter((entry) => entry.type === "set")
      .map((entry) => {
        return new vscode.DocumentSymbol(
          entry.key,
          "Naite",
          vscode.SymbolKind.Key,
          entry.location.range,
          entry.location.range,
        );
      });
  }
}

/**
 * 워크스페이스 전체에서 Naite 키를 검색합니다 (Cmd+T)
 */
export class NaiteWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
  constructor(private tracker: NaiteTracker) {}

  provideWorkspaceSymbols(
    query: string,
    _token: vscode.CancellationToken,
  ): vscode.SymbolInformation[] {
    // set 타입만 가져옴
    const allKeys = this.tracker.getAllKeys("set");
    const lowerQuery = query.toLowerCase();

    // 쿼리로 필터링 (빈 쿼리면 전체 반환)
    const matchedKeys = query
      ? allKeys.filter((key) => key.toLowerCase().includes(lowerQuery))
      : allKeys;

    const symbols: vscode.SymbolInformation[] = [];

    for (const key of matchedKeys) {
      // set 위치만 가져옴
      const locations = this.tracker.getKeyLocations(key, "set");

      for (const location of locations) {
        const fileName = location.uri.fsPath.split("/").pop() || location.uri.fsPath;
        symbols.push(new vscode.SymbolInformation(key, vscode.SymbolKind.Key, fileName, location));
      }
    }

    return symbols;
  }
}
