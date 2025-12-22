import vscode from "vscode";
import NaiteExpressionExtractor from "../code-parsing/expression-extractor";
import NaiteExpressionScanner, { type NaiteExpression } from "../code-parsing/expression-scanner";
import { StatusBar } from "../utils/status-bar";
import { findConfigFiles } from "../utils/workspace";
import { NaiteCallPatterns } from "./patterns";

/**
 * 와일드카드 패턴(*)이 주어진 키와 매칭되는지 확인합니다
 * 예: "puri:*"는 "puri:abc", "puri:def" 등과 매칭됨
 */
function matchesKey(pattern: string, key: string): boolean {
  if (!pattern.includes("*")) return pattern === key;
  const regex = new RegExp(
    `^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
  );
  return regex.test(key);
}

/**
 * TypeScript 파일을 파싱하여 Naite 호출을 찾습니다
 */
class NaiteTrackerClass {
  private naiteCalls: Map<string, NaiteExpression[]> = new Map();

  /**
   * 워크스페이스의 모든 TypeScript 파일에서 Naite 호출을 스캔합니다.
   * - sonamu.config.ts가 있는 프로젝트 루트의 .ts 파일들
   * - 해당 프로젝트의 node_modules/sonamu/src 내의 .ts 파일들
   */
  async scanWorkspace(): Promise<void> {
    this.naiteCalls.clear();

    // sonamu.config.ts 위치 찾기 (프로젝트 루트 결정)
    const configFiles = await findConfigFiles();

    for (const configFile of configFiles) {
      // sonamu.config.ts가 있는 디렉토리 = 프로젝트 루트
      const projectRoot = vscode.Uri.joinPath(configFile, "..", "..");

      // RelativePattern을 사용하여 프로젝트 루트 기준으로 검색
      const projectPattern = new vscode.RelativePattern(projectRoot, "**/*.ts");
      const projectExclude = "{**/node_modules/**,**/build/**,**/out/**,**/dist/**,**/*.d.ts}";

      // 1. 프로젝트 루트의 .ts 파일들 스캔
      const projectFiles = await vscode.workspace.findFiles(projectPattern, projectExclude);

      // 2. 해당 프로젝트의 node_modules/sonamu/src 내의 .ts 파일들 스캔
      const sonamuPattern = new vscode.RelativePattern(
        projectRoot,
        "node_modules/sonamu/src/**/*.ts",
      );
      const sonamuFiles = await vscode.workspace.findFiles(sonamuPattern, "**/*.d.ts");

      const allFiles = [...projectFiles, ...sonamuFiles];

      const scanningMessage = StatusBar.show(`스캔 중: ${allFiles.length}개 파일...`);
      for (const file of allFiles) {
        await this.scanFile(file);
      }
      scanningMessage.dispose();
    }

    const keyCount = this.getAllKeys().length;
    StatusBar.show(`스캔 완료: ${keyCount}개 키 발견`, { timeout: 1000, done: true });
  }

  private forgetCallsInFile(uri: vscode.Uri): void {
    const uriString = uri.toString();
    for (const [key, entries] of this.naiteCalls) {
      const filtered = entries.filter((e) => e.location.uri.toString() !== uriString);
      if (filtered.length === 0) {
        this.naiteCalls.delete(key);
      } else {
        this.naiteCalls.set(key, filtered);
      }
    }
  }

  /**
   * 특정 파일을 스캔합니다.
   */
  async scanFile(uri: vscode.Uri): Promise<void> {
    const fileName = uri.fsPath.split("/").pop() || uri.fsPath;
    const statusMessage = StatusBar.show(`스캔 중: ${fileName}...`);

    this.forgetCallsInFile(uri);

    const document = await vscode.workspace.openTextDocument(uri);
    const scanner = new NaiteExpressionScanner(document);
    const patterns = NaiteCallPatterns.all();

    const naiteCalls = Array.from(scanner.scanNaiteCalls(patterns));

    for (const expr of naiteCalls) {
      if (!this.naiteCalls.has(expr.key)) {
        this.naiteCalls.set(expr.key, []);
      }
      this.naiteCalls.get(expr.key)?.push(expr);
    }

    statusMessage.dispose();

    const foundCount = naiteCalls.length;
    if (foundCount > 0) {
      StatusBar.show(`${fileName}: ${foundCount}개 키 발견`, {
        timeout: 500,
        done: true,
      });
    }
  }

  /**
   * 모든 Naite 호출 키 목록을 반환합니다.
   */
  getAllKeys(type?: "set" | "get"): string[] {
    const keys = Array.from(this.naiteCalls.keys()).sort();
    if (type) {
      return keys.filter((k) =>
        this.naiteCalls.get(k)?.some((expr) => NaiteCallPatterns.getType(expr.pattern) === type),
      );
    }
    return keys;
  }

  /**
   * 특정 키의 모든 사용 위치를 반환합니다.
   * 와일드카드(*)를 지원합니다. 예: "puri:*"는 "puri:abc", "puri:def" 등과 매칭됨
   */
  getKeyLocations(key: string, type?: "set" | "get"): vscode.Location[] {
    const results: vscode.Location[] = [];

    for (const [storedKey, expressions] of this.naiteCalls) {
      if (matchesKey(key, storedKey)) {
        for (const expr of expressions) {
          if (!type || NaiteCallPatterns.getType(expr.pattern) === type) {
            results.push(expr.location);
          }
        }
      }
    }

    return results;
  }

  /**
   * 특정 파일의 모든 Naite 호출을 반환합니다 (CodeLens/Decorator용)
   */
  getEntriesForFile(uri: vscode.Uri): NaiteExpression[] {
    const uriString = uri.toString();
    const entries: NaiteExpression[] = [];

    for (const expressions of this.naiteCalls.values()) {
      for (const expr of expressions) {
        if (expr.location.uri.toString() === uriString) {
          entries.push(expr);
        }
      }
    }

    return entries;
  }

  /**
   * 특정 위치의 코드가 Naite 호출이라면, 그곳에서 키를 추출합니다
   */
  getKeyAtPosition(document: vscode.TextDocument, position: vscode.Position): string | null {
    const extractor = new NaiteExpressionExtractor(document);
    const patterns = NaiteCallPatterns.all();
    return extractor.extractKeyAtPosition(position, patterns);
  }
}

export const NaiteTracker = new NaiteTrackerClass();
