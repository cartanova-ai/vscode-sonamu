import ts from "typescript";
import { Location, Position, Range } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";

export type NaiteExpression = {
  key: string;
  pattern: string;
  location: Location;
};

/**
 * 코드 속에서 Naite 관련 호출문들을 찾아내주는 스캐너.
 * TypeScript AST를 사용합니다.
 */
export default class NaiteExpressionScanner {
  constructor(private readonly document: TextDocument) {}

  *scanNaiteCalls(patterns: string[]): Generator<NaiteExpression, void, undefined> {
    const doc = this.document;
    const uri = doc.uri;
    const text = doc.getText();
    const sourceFile = ts.createSourceFile(uri, text, ts.ScriptTarget.Latest, true);

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
                  const start = doc.positionAt(callExpr.getStart(sourceFile));
                  const end = doc.positionAt(callExpr.getEnd());
                  const location = Location.create(
                    uri,
                    Range.create(
                      Position.create(start.line, start.character),
                      Position.create(end.line, end.character),
                    ),
                  );

                  yield { key: firstArg.text, pattern: fullPattern, location };
                }
              }
            }
          }
        }
      }

      for (const child of node.getChildren(sourceFile)) {
        yield* visit(child);
      }
    }

    yield* visit(sourceFile);
  }
}
