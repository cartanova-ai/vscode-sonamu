import * as ts from "typescript";
import * as vscode from "vscode";

/**
 * Naite 호출에서 키와 위치 정보를 추출합니다
 */
export interface NaiteKey {
  key: string;
  location: vscode.Location;
  type: "set" | "get";
  pattern: string; // 매칭된 패턴 (예: "Naite.t", "Naite.get")
}

/**
 * 패턴 설정
 */
export interface NaitePatternConfig {
  // 정의 패턴 (예: ["Naite.t"])
  setPatterns: string[];
  // 사용 패턴 (예: ["Naite.get", "Naite.safeGet", "Naite.expect", "Naite.expectWithSnapshot"])
  getPatterns: string[];
}

/**
 * 문자열 리터럴 노드인지 확인 (작은따옴표, 큰따옴표, 백틱)
 */
function isStringLiteralLike(
  node: ts.Node,
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

/**
 * 와일드카드 패턴(*)이 주어진 키들 중 하나라도 매칭되는지 확인합니다
 * 예: "puri:*"는 "puri:abc", "puri:def" 등과 매칭됨
 */
export function matchesWildcard(pattern: string, keys: string[]): boolean {
  if (!pattern.includes("*")) return keys.includes(pattern);
  const regex = new RegExp(
    `^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
  );
  return keys.some((key) => regex.test(key));
}

/**
 * 패턴 문자열을 파싱합니다 (예: "Naite.t" → { object: "Naite", method: "t" })
 */
function parsePattern(pattern: string): { object: string; method: string } | null {
  const parts = pattern.split(".");
  if (parts.length !== 2) return null;
  return { object: parts[0], method: parts[1] };
}

/**
 * TypeScript 파일을 파싱하여 Naite 호출을 찾습니다
 */
export class NaiteTracker {
  private keys: Map<string, NaiteKey[]> = new Map();
  private config: NaitePatternConfig = {
    setPatterns: ["Naite.t"],
    getPatterns: ["Naite.get", "Naite.del"],
  };

  /**
   * 패턴 설정을 변경합니다
   */
  setConfig(config: Partial<NaitePatternConfig>): void {
    if (config.setPatterns) this.config.setPatterns = config.setPatterns;
    if (config.getPatterns) this.config.getPatterns = config.getPatterns;
  }

  /**
   * 현재 패턴 설정을 반환합니다
   */
  getConfig(): NaitePatternConfig {
    return { ...this.config };
  }

  /**
   * 모든 패턴을 반환합니다 (set + get)
   */
  getAllPatterns(): string[] {
    return [...this.config.setPatterns, ...this.config.getPatterns];
  }

  /**
   * 패턴의 메서드 이름만 추출합니다 (예: ["t", "get", "safeGet", ...])
   */
  getAllMethods(): { setMethods: string[]; getMethods: string[] } {
    const setMethods = this.config.setPatterns
      .map((p) => parsePattern(p)?.method)
      .filter(Boolean) as string[];
    const getMethods = this.config.getPatterns
      .map((p) => parsePattern(p)?.method)
      .filter(Boolean) as string[];
    return { setMethods, getMethods };
  }

  /**
   * 워크스페이스의 모든 TypeScript 파일에서 Naite 호출을 스캔합니다
   */
  async scanWorkspace(): Promise<void> {
    this.keys.clear();

    // 모든 .ts 파일 찾기 (node_modules 제외)
    const files = await vscode.workspace.findFiles("**/*.ts", "**/node_modules/**");

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
      const filtered = entries.filter((e) => e.location.uri.toString() !== uriString);
      if (filtered.length === 0) {
        this.keys.delete(key);
      } else {
        this.keys.set(key, filtered);
      }
    }

    const document = await vscode.workspace.openTextDocument(uri);
    const sourceCode = document.getText();

    // TypeScript AST로 파싱
    const sourceFile = ts.createSourceFile(uri.fsPath, sourceCode, ts.ScriptTarget.Latest, true);

    // AST를 순회하며 Naite.t와 Naite.get 호출 찾기
    this.visitNode(sourceFile, sourceFile, document);
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
          const { setMethods, getMethods } = this.getAllMethods();
          const isSetPattern = this.config.setPatterns.includes(fullPattern);
          const isGetPattern = this.config.getPatterns.includes(fullPattern);

          if (isSetPattern || isGetPattern) {
            // 첫 번째 인자가 문자열 리터럴인지 확인
            if (callExpr.arguments.length > 0) {
              const firstArg = callExpr.arguments[0];

              if (isStringLiteralLike(firstArg)) {
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
                this.keys.get(keyValue)!.push(naiteKey);
              }
            }
          }
        }
      }
    }

    // 자식 노드 방문
    ts.forEachChild(node, (child) => this.visitNode(child, sourceFile, document));
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
  getKeyLocations(key: string, type?: "set" | "get"): vscode.Location[] {
    const naiteKeys = this.keys.get(key) || [];
    if (type) {
      return naiteKeys.filter((k) => k.type === type).map((k) => k.location);
    }
    return naiteKeys.map((k) => k.location);
  }

  /**
   * 특정 파일의 모든 Naite 호출을 반환합니다 (CodeLens/Decorator용)
   */
  getEntriesForFile(uri: vscode.Uri): NaiteKey[] {
    const uriString = uri.toString();
    const entries: NaiteKey[] = [];

    for (const naiteKeys of this.keys.values()) {
      for (const entry of naiteKeys) {
        if (entry.location.uri.toString() === uriString) {
          entries.push(entry);
        }
      }
    }

    return entries;
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
      true,
    );

    let foundKey: string | null = null;
    const allPatterns = this.getAllPatterns();

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callExpr = node as ts.CallExpression;

        if (ts.isPropertyAccessExpression(callExpr.expression)) {
          const propAccess = callExpr.expression;

          if (ts.isIdentifier(propAccess.expression) && ts.isIdentifier(propAccess.name)) {
            const fullPattern = `${propAccess.expression.text}.${propAccess.name.text}`;

            if (allPatterns.includes(fullPattern)) {
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
      }

      if (!foundKey) {
        ts.forEachChild(node, visit);
      }
    };

    visit(sourceFile);
    return foundKey;
  }

  /**
   * regex 패턴 생성 (다른 provider들에서 사용)
   */
  buildRegexPattern(): RegExp {
    const allPatterns = this.getAllPatterns();
    // "Naite.t", "Naite.get" 등을 "Naite\.(t|get|...)" 형태로 변환
    const methodsByObject = new Map<string, string[]>();

    for (const pattern of allPatterns) {
      const parsed = parsePattern(pattern);
      if (!parsed) continue;
      if (!methodsByObject.has(parsed.object)) {
        methodsByObject.set(parsed.object, []);
      }
      methodsByObject.get(parsed.object)!.push(parsed.method);
    }

    // 여러 객체가 있을 수 있으므로 OR로 연결
    const parts: string[] = [];
    for (const [obj, methods] of methodsByObject) {
      parts.push(`${obj}\\.(${methods.join("|")})`);
    }

    const patternStr = `(${parts.join("|")})\\s*\\(\\s*["'\`]([^"'\`]+)["'\`]`;
    return new RegExp(patternStr, "g");
  }
}
