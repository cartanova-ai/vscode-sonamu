import * as vscode from 'vscode';
import * as ts from 'typescript';
import { NaiteTracker } from './naite-tracker';

/**
 * 사용 패턴(get)에서 정의되지 않은 키 사용 시 경고를 표시합니다
 */
export class NaiteDiagnosticProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor(private tracker: NaiteTracker) {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('naite');
  }

  dispose() {
    this.diagnosticCollection.dispose();
  }

  /**
   * 문서를 분석하여 진단 정보를 업데이트합니다
   */
  updateDiagnostics(document: vscode.TextDocument): void {
    if (document.languageId !== 'typescript') {
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const sourceCode = document.getText();
    const config = this.tracker.getConfig();

    const sourceFile = ts.createSourceFile(
      document.uri.fsPath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callExpr = node;

        if (ts.isPropertyAccessExpression(callExpr.expression)) {
          const propAccess = callExpr.expression;

          if (ts.isIdentifier(propAccess.expression) && ts.isIdentifier(propAccess.name)) {
            const fullPattern = `${propAccess.expression.text}.${propAccess.name.text}`;

            // 사용 패턴(get)인지 확인
            if (config.getPatterns.includes(fullPattern)) {
              if (callExpr.arguments.length > 0) {
                const firstArg = callExpr.arguments[0];

                if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
                  const keyValue = firstArg.text;

                  // 해당 키가 정의 패턴(set)으로 정의되어 있는지 확인
                  const setLocs = this.tracker.getKeyLocations(keyValue, 'set');

                  if (setLocs.length === 0) {
                    // 키 부분의 범위 계산
                    const start = document.positionAt(firstArg.getStart(sourceFile));
                    const end = document.positionAt(firstArg.getEnd());
                    const range = new vscode.Range(start, end);

                    const diagnostic = new vscode.Diagnostic(
                      range,
                      `정의되지 않은 Naite 키: "${keyValue}"`,
                      vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = 'sonamu';
                    diagnostic.code = 'undefined-naite-key';

                    diagnostics.push(diagnostic);
                  }
                }
              }
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
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
