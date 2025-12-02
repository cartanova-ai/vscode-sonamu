import assert from "assert";
import type vscode from "vscode";
import NaiteExpressionSearcher from "../ast-parsing/expression-searcher";
import type { NaiteKey, NaiteKeysMap, NaitePatternConfig } from "./types";

/**
 * 주어진 파일(vscode.TextDocument)에서 관심 있는 호출 구문을 찾아서 키 정보를 반환합니다.
 */
export default class NaiteParser {
  private keys: NaiteKeysMap = new Map();
  constructor(
    private readonly document: vscode.TextDocument,
    private readonly config: NaitePatternConfig,
  ) {}

  parse(): NaiteKeysMap {
    const searcher = new NaiteExpressionSearcher(this.document);
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

    return this.keys;
  }
}
