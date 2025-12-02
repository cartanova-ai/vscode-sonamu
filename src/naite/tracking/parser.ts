import ts from "typescript";
import vscode from "vscode";
import type { NaiteKey, NaitePatternConfig } from "./types";

export default class NaiteParser {
  private keys: Map<string, NaiteKey[]> = new Map();
  constructor(
    private readonly document: vscode.TextDocument,
    private readonly config: NaitePatternConfig,
  ) {}

  parse(): Map<string, NaiteKey[]> {
    const sourceFile = ts.createSourceFile(
      this.document.uri.fsPath,
      this.document.getText(),
      ts.ScriptTarget.Latest,
      true,
    );

    // AST를 순회하며 Naite.t와 Naite.get 호출 찾기
    this.visitNode(sourceFile, sourceFile, this.document);

    return this.keys;
  }

  private visitNode(node: ts.Node, sourceFile: ts.SourceFile, document: vscode.TextDocument): void {
    // 설정된 패턴들 찾기
    if (ts.isCallExpression(node)) {
      const callExpr = node as ts.CallExpression;

      if (ts.isPropertyAccessExpression(callExpr.expression)) {
        const propAccess = callExpr.expression;

        if (ts.isIdentifier(propAccess.expression) && ts.isIdentifier(propAccess.name)) {
          const objectName = propAccess.expression.text;
          const methodName = propAccess.name.text;
          const fullPattern = `${objectName}.${methodName}`;

          // 패턴 매칭 확인
          const isSetPattern = this.config.setPatterns.includes(fullPattern);
          const isGetPattern = this.config.getPatterns.includes(fullPattern);

          if (isSetPattern || isGetPattern) {
            // 첫 번째 인자가 문자열 리터럴인지 확인
            if (callExpr.arguments.length > 0) {
              const firstArg = callExpr.arguments[0];

              if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
                const keyValue = firstArg.text;
                const type = isSetPattern ? "set" : "get";

                // 위치 정보 생성 (전체 호출문 위치)
                const start = document.positionAt(node.getStart(sourceFile));
                const end = document.positionAt(node.getEnd());
                const range = new vscode.Range(start, end);
                const location = new vscode.Location(document.uri, range);

                // 키 정보 저장
                const naiteKey: NaiteKey = { key: keyValue, location, type, pattern: fullPattern };

                if (!this.keys.has(keyValue)) {
                  this.keys.set(keyValue, []);
                }
                this.keys.get(keyValue)?.push(naiteKey);
              }
            }
          }
        }
      }
    }

    // 자식 노드 방문
    ts.forEachChild(node, (child) => this.visitNode(child, sourceFile, document));
  }
}
