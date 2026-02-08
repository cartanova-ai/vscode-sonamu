import {
  DocumentSymbol,
  type DocumentSymbolParams,
  SymbolInformation,
  SymbolKind,
  type WorkspaceSymbolParams,
} from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { NaiteCallPatterns } from "../core/patterns.js";
import { NaiteTracker } from "../core/tracker.js";

export function handleDocumentSymbol(
  _params: DocumentSymbolParams,
  document: TextDocument | undefined,
): DocumentSymbol[] | null {
  if (!document) {
    return null;
  }

  const entries = NaiteTracker.getEntriesForFile(document.uri);

  return entries
    .filter((entry) => NaiteCallPatterns.isSet(entry.pattern))
    .map((entry) =>
      DocumentSymbol.create(
        entry.key,
        "Naite",
        SymbolKind.Key,
        entry.location.range,
        entry.location.range,
      ),
    );
}

export function handleWorkspaceSymbol(params: WorkspaceSymbolParams): SymbolInformation[] {
  const allKeys = NaiteTracker.getAllKeys("set");
  const lowerQuery = params.query.toLowerCase();

  const matchedKeys = params.query
    ? allKeys.filter((key) => key.toLowerCase().includes(lowerQuery))
    : allKeys;

  const symbols: SymbolInformation[] = [];

  for (const key of matchedKeys) {
    const locations = NaiteTracker.getKeyLocations(key, "set");

    for (const location of locations) {
      const fileName = location.uri.split("/").pop() || location.uri;
      symbols.push(
        SymbolInformation.create(key, SymbolKind.Key, location.range, location.uri, fileName),
      );
    }
  }

  return symbols;
}
