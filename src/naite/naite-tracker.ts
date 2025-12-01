import * as ts from "typescript";
import * as vscode from "vscode";

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

