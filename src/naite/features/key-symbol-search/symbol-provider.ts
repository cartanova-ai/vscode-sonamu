import vscode from "vscode";
import { NaiteCallPatterns } from "../../lib/tracking/patterns";
import { NaiteTracker } from "../../lib/tracking/tracker";

/**
 * 문서 내 Naite 키를 심볼로 제공합니다 (Cmd+Shift+O)
 */
export class NaiteDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.DocumentSymbol[] {
    const entries = NaiteTracker.getEntriesForFile(document.uri);

    return entries
      .filter((entry) => NaiteCallPatterns.isSet(entry.pattern))
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
  provideWorkspaceSymbols(
    query: string,
    _token: vscode.CancellationToken,
  ): vscode.SymbolInformation[] {
    // set 타입만 가져옴
    const allKeys = NaiteTracker.getAllKeys("set");
    const lowerQuery = query.toLowerCase();

    // 쿼리로 필터링 (빈 쿼리면 전체 반환)
    const matchedKeys = query
      ? allKeys.filter((key) => key.toLowerCase().includes(lowerQuery))
      : allKeys;

    const symbols: vscode.SymbolInformation[] = [];

    for (const key of matchedKeys) {
      // set 위치만 가져옴
      const locations = NaiteTracker.getKeyLocations(key, "set");

      for (const location of locations) {
        const fileName = location.uri.fsPath.split("/").pop() || location.uri.fsPath;
        symbols.push(new vscode.SymbolInformation(key, vscode.SymbolKind.Key, fileName, location));
      }
    }

    return symbols;
  }
}
