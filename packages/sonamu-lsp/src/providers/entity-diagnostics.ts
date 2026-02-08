import type { Diagnostic } from "vscode-languageserver";
import { DiagnosticSeverity } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { findRangeForPath } from "../entity/json-utils.js";
import { getCachedSchemas } from "../entity/schema-loader.js";

export function computeEntityDiagnostics(document: TextDocument): Diagnostic[] {
  const text = document.getText();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const message = err instanceof SyntaxError ? err.message : "Invalid JSON";
    return [
      {
        severity: DiagnosticSeverity.Error,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        message,
        source: "sonamu",
      },
    ];
  }

  const schemas = getCachedSchemas();
  if (!schemas) {
    return [];
  }

  const result = schemas.EntityJsonSchema.safeParse(parsed);
  if (result.success) {
    return [];
  }

  const diagnostics: Diagnostic[] = [];

  for (const issue of result.error.issues) {
    const range = findRangeForPath(text, issue.path);
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range,
      message: issue.message,
      source: "sonamu",
    });
  }

  return diagnostics;
}
