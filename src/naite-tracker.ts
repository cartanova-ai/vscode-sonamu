import * as vscode from 'vscode';
import * as ts from 'typescript';

/**
 * Naite.t() 호출에서 키와 위치 정보를 추출합니다
 */
export interface NaiteKey {
  key: string;
  location: vscode.Location;
  type: 'set' | 'get'; // Naite.t는 'set', Naite.get은 'get'
}

/**
 * 문자열 리터럴 노드인지 확인 (작은따옴표, 큰따옴표, 백틱)
 */
function isStringLiteralLike(node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

/**
 * TypeScript 파일을 파싱하여 Naite.t와 Naite.get 호출을 찾습니다
 */
export class NaiteTracker {
  private keys: Map<string, NaiteKey[]> = new Map();

  /**
   * 워크스페이스의 모든 TypeScript 파일에서 Naite 호출을 스캔합니다
   */
  async scanWorkspace(): Promise<void> {
    this.keys.clear();

    // 모든 .ts 파일 찾기 (node_modules 제외)
    const files = await vscode.workspace.findFiles('**/*.ts', '**/node_modules/**');

    for (const file of files) {
      await this.scanFile(file);
    }
  }

  /**
   * 특정 파일을 스캔합니다
   */
  async scanFile(uri: vscode.Uri): Promise<void> {
    // 먼저 해당 파일의 기존 엔트리 제거
    const uriString = uri.toString();
    for (const [key, entries] of this.keys) {
      const filtered = entries.filter(e => e.location.uri.toString() !== uriString);
      if (filtered.length === 0) {
        this.keys.delete(key);
      } else {
        this.keys.set(key, filtered);
      }
    }

    const document = await vscode.workspace.openTextDocument(uri);
    const sourceCode = document.getText();

    // TypeScript AST로 파싱
    const sourceFile = ts.createSourceFile(
      uri.fsPath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    // AST를 순회하며 Naite.t와 Naite.get 호출 찾기
    this.visitNode(sourceFile, sourceFile, document);
  }

  private visitNode(node: ts.Node, sourceFile: ts.SourceFile, document: vscode.TextDocument): void {
    // Naite.t("key", value) 또는 Naite.get("key") 패턴 찾기
    if (ts.isCallExpression(node)) {
      const callExpr = node as ts.CallExpression;

      // Naite.t 또는 Naite.get 체크
      if (ts.isPropertyAccessExpression(callExpr.expression)) {
        const propAccess = callExpr.expression;

        // 객체가 'Naite'이고 메서드가 't' 또는 'get'인지 확인
        if (
          ts.isIdentifier(propAccess.expression) &&
          propAccess.expression.text === 'Naite' &&
          ts.isIdentifier(propAccess.name) &&
          (propAccess.name.text === 't' || propAccess.name.text === 'get')
        ) {
          const methodName = propAccess.name.text;

          // 첫 번째 인자가 문자열 리터럴인지 확인
          if (callExpr.arguments.length > 0) {
            const firstArg = callExpr.arguments[0];

            if (isStringLiteralLike(firstArg)) {
              const keyValue = firstArg.text;
              const type = methodName === 't' ? 'set' : 'get';

              // 위치 정보 생성 (전체 호출문 위치)
              const start = document.positionAt(node.getStart(sourceFile));
              const end = document.positionAt(node.getEnd());
              const range = new vscode.Range(start, end);
              const location = new vscode.Location(document.uri, range);

              // 키 정보 저장
              const naiteKey: NaiteKey = { key: keyValue, location, type };

              if (!this.keys.has(keyValue)) {
                this.keys.set(keyValue, []);
              }
              this.keys.get(keyValue)!.push(naiteKey);
            }
          }
        }
      }
    }

    // 자식 노드 방문
    ts.forEachChild(node, child => this.visitNode(child, sourceFile, document));
  }

  /**
   * 모든 Naite.t 키 목록을 반환합니다
   */
  getAllKeys(): string[] {
    return Array.from(this.keys.keys()).sort();
  }

  /**
   * 특정 키의 모든 사용 위치를 반환합니다
   */
  getKeyLocations(key: string, type?: 'set' | 'get'): vscode.Location[] {
    const naiteKeys = this.keys.get(key) || [];
    if (type) {
      return naiteKeys.filter(k => k.type === type).map(k => k.location);
    }
    return naiteKeys.map(k => k.location);
  }

  /**
   * 특정 위치의 Naite 호출에서 키를 추출합니다
   */
  getKeyAtPosition(document: vscode.TextDocument, position: vscode.Position): string | null {
    const sourceCode = document.getText();
    const offset = document.offsetAt(position);

    const sourceFile = ts.createSourceFile(
      document.uri.fsPath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    let foundKey: string | null = null;

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callExpr = node as ts.CallExpression;

        if (ts.isPropertyAccessExpression(callExpr.expression)) {
          const propAccess = callExpr.expression;

          if (
            ts.isIdentifier(propAccess.expression) &&
            propAccess.expression.text === 'Naite' &&
            ts.isIdentifier(propAccess.name) &&
            (propAccess.name.text === 't' || propAccess.name.text === 'get')
          ) {
            if (callExpr.arguments.length > 0) {
              const firstArg = callExpr.arguments[0];

              if (isStringLiteralLike(firstArg)) {
                // 커서가 따옴표 안에 있는지 확인 (따옴표/백틱 포함 범위)
                const start = firstArg.getStart(sourceFile);
                const end = firstArg.getEnd();

                if (offset >= start && offset <= end) {
                  foundKey = firstArg.text;
                }
              }
            }
          }
        }
      }

      if (!foundKey) {
        ts.forEachChild(node, visit);
      }
    };

    visit(sourceFile);
    return foundKey;
  }
}
