import fs from "fs/promises";
import path from "path";
import type { Location } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { findConfigFiles, findProjectTsFiles } from "../utils/file-scanner.js";
import NaiteExpressionExtractor from "./expression-extractor.js";
import NaiteExpressionScanner, { type NaiteExpression } from "./expression-scanner.js";
import { NaiteCallPatterns } from "./patterns.js";

/**
 * 와일드카드 패턴(*)이 주어진 키와 매칭되는지 확인합니다
 */
function matchesKey(pattern: string, key: string): boolean {
  if (!pattern.includes("*")) {
    return pattern === key;
  }
  const regex = new RegExp(
    `^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
  );
  return regex.test(key);
}

function filePathToUri(filePath: string): string {
  return `file://${filePath}`;
}

class NaiteTrackerClass {
  private naiteCalls: Map<string, NaiteExpression[]> = new Map();
  private workspaceRoot: string = "";

  setWorkspaceRoot(root: string): void {
    this.workspaceRoot = root;
  }

  async scanWorkspace(): Promise<void> {
    if (!this.workspaceRoot) {
      return;
    }

    this.naiteCalls.clear();

    const configFiles = await findConfigFiles(this.workspaceRoot);

    for (const configFile of configFiles) {
      // sonamu.config.ts가 있는 디렉토리의 부모 = 프로젝트 루트
      const projectRoot = path.resolve(path.dirname(configFile), "..", "..");

      const allFiles = await findProjectTsFiles(projectRoot);

      for (const file of allFiles) {
        await this.scanFile(filePathToUri(file));
      }
    }
  }

  private forgetCallsInFile(uri: string): void {
    for (const [key, entries] of this.naiteCalls) {
      const filtered = entries.filter((e) => e.location.uri !== uri);
      if (filtered.length === 0) {
        this.naiteCalls.delete(key);
      } else {
        this.naiteCalls.set(key, filtered);
      }
    }
  }

  async scanFile(uri: string): Promise<void> {
    this.forgetCallsInFile(uri);

    let filePath: string;
    try {
      filePath = uri.startsWith("file://") ? uri.slice(7) : uri;
    } catch {
      return;
    }

    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch {
      return;
    }

    const document = TextDocument.create(uri, "typescript", 0, content);
    const scanner = new NaiteExpressionScanner(document);
    const patterns = NaiteCallPatterns.all();

    const naiteCalls = Array.from(scanner.scanNaiteCalls(patterns));

    for (const expr of naiteCalls) {
      if (!this.naiteCalls.has(expr.key)) {
        this.naiteCalls.set(expr.key, []);
      }
      this.naiteCalls.get(expr.key)?.push(expr);
    }
  }

  /**
   * TextDocument로부터 직접 스캔 (이미 열린 문서용)
   */
  scanDocument(document: TextDocument): void {
    const uri = document.uri;
    this.forgetCallsInFile(uri);

    const scanner = new NaiteExpressionScanner(document);
    const patterns = NaiteCallPatterns.all();

    const naiteCalls = Array.from(scanner.scanNaiteCalls(patterns));

    for (const expr of naiteCalls) {
      if (!this.naiteCalls.has(expr.key)) {
        this.naiteCalls.set(expr.key, []);
      }
      this.naiteCalls.get(expr.key)?.push(expr);
    }
  }

  getAllKeys(type?: "set" | "get"): string[] {
    const keys = Array.from(this.naiteCalls.keys()).sort();
    if (type) {
      return keys.filter((k) =>
        this.naiteCalls.get(k)?.some((expr) => NaiteCallPatterns.getType(expr.pattern) === type),
      );
    }
    return keys;
  }

  getKeyLocations(key: string, type?: "set" | "get"): Location[] {
    const results: Location[] = [];

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

  getEntriesForFile(uri: string): NaiteExpression[] {
    const entries: NaiteExpression[] = [];

    for (const expressions of this.naiteCalls.values()) {
      for (const expr of expressions) {
        if (expr.location.uri === uri) {
          entries.push(expr);
        }
      }
    }

    return entries;
  }

  getKeyAtPosition(
    document: TextDocument,
    position: { line: number; character: number },
  ): string | null {
    const extractor = new NaiteExpressionExtractor(document);
    const patterns = NaiteCallPatterns.all();
    return extractor.extractKeyAtPosition(position, patterns);
  }
}

export const NaiteTracker = new NaiteTrackerClass();
