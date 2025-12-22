import assert from "assert";
import vscode from "vscode";
import NaiteExpressionExtractor from "../code-parsing/expression-extractor";
import NaiteExpressionScanner from "../code-parsing/expression-scanner";
import type { NaiteKey, NaiteKeysMap, NaitePatternConfig } from "./types";
import { findConfigFiles, findConfigPaths } from "../utils/workspace";

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
 * TypeScript 파일을 파싱하여 Naite 호출을 찾습니다
 */
class NaiteTrackerClass {
  private keys: NaiteKeysMap = new Map();
  private config: NaitePatternConfig = {
    setPatterns: ["Naite.t"],
    getPatterns: ["Naite.get", "Naite.del"],
  };
  private statusBarMessagesEnabled: boolean = true;

  /**
   * 상태창 메시지 표시 여부를 설정합니다
   */
  setStatusBarMessagesEnabled(enabled: boolean): void {
    this.statusBarMessagesEnabled = enabled;
  }

  /**
   * 상태창에 메시지를 표시합니다 (설정이 활성화된 경우에만)
   */
  private showStatusBarMessage(
    message: string,
    options?: { timeout?: number; done?: boolean },
  ): vscode.Disposable {
    if (this.statusBarMessagesEnabled) {
      const icon = options?.done ? "$(check)" : "$(sync~spin)";
      const fullMessage = `${icon} ${message}`;
      if (options?.timeout !== undefined) {
        return vscode.window.setStatusBarMessage(fullMessage, options.timeout);
      } else {
        return vscode.window.setStatusBarMessage(fullMessage);
      }
    }
    return vscode.Disposable.from();
  }

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
   * 워크스페이스의 모든 TypeScript 파일에서 Naite 호출을 스캔합니다.
   * - sonamu.config.ts가 있는 프로젝트 루트의 .ts 파일들
   * - 해당 프로젝트의 node_modules/sonamu/src 내의 .ts 파일들
   */
  async scanWorkspace(): Promise<void> {
    this.keys.clear();

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

      const scanningMessage = this.showStatusBarMessage(`스캔 중: ${allFiles.length}개 파일...`);
      for (const file of allFiles) {
        await this.scanFile(file);
      }
      scanningMessage.dispose();
    }

    const keyCount = this.getAllKeys().length;
    this.showStatusBarMessage(`스캔 완료: ${keyCount}개 키 발견`, { timeout: 1000, done: true });
  }

  private forgetKeysInFile(uri: vscode.Uri): void {
    const uriString = uri.toString();
    for (const [key, entries] of this.keys) {
      const filtered = entries.filter((e) => e.location.uri.toString() !== uriString);
      if (filtered.length === 0) {
        this.keys.delete(key);
      } else {
        this.keys.set(key, filtered);
      }
    }
  }

  /**
   * 특정 파일을 스캔합니다.
   */
  async scanFile(uri: vscode.Uri): Promise<void> {
    const fileName = uri.fsPath.split("/").pop() || uri.fsPath;
    const statusMessage = this.showStatusBarMessage(`스캔 중: ${fileName}...`);

    this.forgetKeysInFile(uri);

    const document = await vscode.workspace.openTextDocument(uri);
    const scanner = new NaiteExpressionScanner(document);
    const patterns = [...this.config.setPatterns, ...this.config.getPatterns];

    const naiteCalls = Array.from(scanner.scanNaiteCalls(patterns));

    for (const { key, location, pattern } of naiteCalls) {
      const type = this.config.setPatterns.includes(pattern)
        ? "set"
        : this.config.getPatterns.includes(pattern)
          ? "get"
          : undefined;
      assert(type, `있을 수 없는 일입니다.`);

      const naiteKey: NaiteKey = { key, location, type, pattern };
      if (!this.keys.has(key)) {
        this.keys.set(key, []);
      }
      this.keys.get(key)?.push(naiteKey);
    }

    statusMessage.dispose();

    const foundCount = naiteCalls.length;
    if (foundCount > 0) {
      this.showStatusBarMessage(`${fileName}: ${foundCount}개 키 발견`, {
        timeout: 500,
        done: true,
      });
    }
  }

  /**
   * 모든 Naite 호출 키 목록을 반환합니다.
   */
  getAllKeys(type?: "set" | "get"): string[] {
    const keys = Array.from(this.keys.keys()).sort();
    if (type) {
      return keys.filter((k) => this.keys.get(k)?.some((k) => k.type === type));
    }
    return keys;
  }

  /**
   * 특정 키의 모든 사용 위치를 반환합니다.
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
   * 특정 위치의 코드가 Naite 호출이라면, 그곳에서 키를 추출합니다
   */
  getKeyAtPosition(document: vscode.TextDocument, position: vscode.Position): string | null {
    const extractor = new NaiteExpressionExtractor(document);
    const patterns = [...this.config.setPatterns, ...this.config.getPatterns];
    return extractor.extractKeyAtPosition(position, patterns);
  }
}

export const NaiteTracker = new NaiteTrackerClass();
