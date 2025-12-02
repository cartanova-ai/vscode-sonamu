import ts from "typescript";
import vscode from "vscode";

type NaiteExpression = {
  pattern: string; // 매칭된 패턴 (예: "Naite.t", "Naite.get")
  key: string; // 키 값 (예: "add:params", "add:result")
  location: vscode.Location; // 호출문 위치

  callExpression: ts.CallExpression;
  firstArgument: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral;
};

/**
 * 코드 속에서 Naite 관련 호출문들을 찾아내주는 친구입니다.
 * TypeScript가 제공하는 AST를 사용합니다.
 */
export default class NaiteExpressionSearcher {
  constructor(private readonly document: vscode.TextDocument) {}

  /**
   * this.document에서 CallExpression 중 다음 조건을 만족하는 것들을 찾습니다:
   * - 모양이 주어진 패턴('Naite.t', 'Naite.get', 'Naite.del' 등)에 맞음.
   * - 첫 번째 인자가 스트링 리터럴(isStringLiteral)이거나 템플릿 리터럴(isNoSubstitutionTemplateLiteral)임.
   *
   * Generator를 반환하므로 lazy하게 움직입니다. for...of 문으로 순회하면 됩니다.
   * 생긴건 변태같지만(?) 써보시면 좋아요.
   *
   * @param patterns - 패턴 목록. 예시: ['Naite.t', 'Naite.get', 'Naite.del']
   */
  *searchNaiteCalls(patterns: string[]): Generator<NaiteExpression, void, undefined> {
    const doc = this.document;
    const sourceFile = ts.createSourceFile(
      doc.uri.fsPath,
      doc.getText(),
      ts.ScriptTarget.Latest,
      true,
    );

    function* visit(node: ts.Node): Generator<NaiteExpression, void, undefined> {
      if (ts.isCallExpression(node)) {
        const callExpr = node as ts.CallExpression;

        if (ts.isPropertyAccessExpression(callExpr.expression)) {
          const propAccess = callExpr.expression;

          if (ts.isIdentifier(propAccess.expression) && ts.isIdentifier(propAccess.name)) {
            const objectName = propAccess.expression.text;
            const methodName = propAccess.name.text;
            const fullPattern = `${objectName}.${methodName}`;

            if (patterns.includes(fullPattern)) {
              if (callExpr.arguments.length > 0) {
                const firstArg = callExpr.arguments[0];

                if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
                  // 전체 호출문 위치를 꺼내옵니다.
                  // 전체라 함은 "Naite.t("add:params", { a, b })" 전체를 의미합니다.
                  const start = doc.positionAt(callExpr.getStart(sourceFile));
                  const end = doc.positionAt(callExpr.getEnd());
                  const range = new vscode.Range(start, end);
                  const location = new vscode.Location(doc.uri, range);

                  const expression: NaiteExpression = {
                    pattern: fullPattern,
                    key: firstArg.text,
                    location,
                    callExpression: callExpr,
                    firstArgument: firstArg,
                  };

                  yield expression;
                }
              }
            }
          }
        }
      }

      for (const child of node.getChildren()) {
        yield* visit(child);
      }
    }

    yield* visit(sourceFile);
  }
}
