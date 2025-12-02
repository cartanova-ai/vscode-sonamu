import assert from "assert";
import vscode from "vscode";
import NaiteExpressionExtractor from "../code-parsing/expression-extractor";
import NaiteExpressionSearcher from "../code-parsing/expression-searcher";
import type { NaiteKey, NaiteKeysMap, NaitePatternConfig } from "./types";

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
export default class NaiteTracker {
  private keys: NaiteKeysMap = new Map();
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
   * 워크스페이스의 모든 TypeScript 파일에서 Naite 호출을 스캔합니다.
   */
  async scanWorkspace(): Promise<void> {
    this.keys.clear();

    // 모든 .ts 파일 찾기 (node_modules 제외)
    const files = await vscode.workspace.findFiles("**/*.ts", "**/node_modules/**");

    for (const file of files) {
      await this.scanFile(file);
    }
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
    this.forgetKeysInFile(uri);

    const document = await vscode.workspace.openTextDocument(uri);
    const searcher = new NaiteExpressionSearcher(document);
    const patterns = [...this.config.setPatterns, ...this.config.getPatterns];

    const naiteCalls = searcher.searchNaiteCalls(patterns);

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
