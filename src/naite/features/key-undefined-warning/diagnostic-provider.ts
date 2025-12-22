import vscode from "vscode";
import { NaiteCallPatterns } from "../../lib/tracking/patterns";
import { NaiteTracker } from "../../lib/tracking/tracker";

/**
 * 사용 패턴(get)에서 정의되지 않은 키 사용 시 경고를 표시합니다
 */
export class NaiteDiagnosticProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection("naite");
  }

  dispose() {
    this.diagnosticCollection.dispose();
  }

  /**
   * 문서를 분석하여 진단 정보를 업데이트합니다
   */
  updateDiagnostics(document: vscode.TextDocument): void {
    if (document.languageId !== "typescript") {
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];

    const expressions = NaiteTracker.getEntriesForFile(document.uri).filter(
      (expr) => NaiteCallPatterns.isGet(expr.pattern),
    );

    for (const expr of expressions) {
      const definedKeys = NaiteTracker.getKeyLocations(expr.key, "set");
      if (definedKeys.length === 0) {
        const diagnostic = new vscode.Diagnostic(
          expr.location.range,
          `정의되지 않은 Naite 키: "${expr.key}"`,
          vscode.DiagnosticSeverity.Warning,
        );
        diagnostics.push(diagnostic);
      }
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  /**
   * 모든 열린 문서에 대해 진단 정보를 업데이트합니다
   */
  updateAllDiagnostics(): void {
    for (const document of vscode.workspace.textDocuments) {
      this.updateDiagnostics(document);
    }
  }

  /**
   * 특정 문서의 진단 정보를 삭제합니다
   */
  clearDiagnostics(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
  }
}
