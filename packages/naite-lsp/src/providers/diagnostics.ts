import { type Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { NaiteCallPatterns } from "../core/patterns.js";
import { NaiteTracker } from "../core/tracker.js";

export function computeDiagnostics(document: TextDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const expressions = NaiteTracker.getEntriesForFile(document.uri).filter((expr) =>
    NaiteCallPatterns.isGet(expr.pattern),
  );

  for (const expr of expressions) {
    const definedKeys = NaiteTracker.getKeyLocations(expr.key, "set");
    if (definedKeys.length === 0) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: expr.location.range,
        message: `정의되지 않은 Naite 키: "${expr.key}"`,
        source: "naite",
      });
    }
  }

  return diagnostics;
}
