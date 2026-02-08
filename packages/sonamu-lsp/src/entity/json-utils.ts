import { findNodeAtLocation, getLocation, type Node, parseTree } from "jsonc-parser";
import type { Range } from "vscode-languageserver";

export interface JsonContext {
  path: (string | number)[];
  isAtPropertyKey: boolean;
}

/**
 * 텍스트 내 offset에서의 JSON 경로와 위치 컨텍스트를 반환합니다.
 */
export function getJsonContext(text: string, offset: number): JsonContext {
  const location = getLocation(text, offset);
  return {
    path: location.path,
    isAtPropertyKey: location.isAtPropertyKey,
  };
}

/**
 * 텍스트의 offset을 LSP Range의 line/character로 변환합니다.
 */
function offsetToPosition(text: string, offset: number): { line: number; character: number } {
  let line = 0;
  let character = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      character = 0;
    } else {
      character++;
    }
  }
  return { line, character };
}

/**
 * Zod 에러 경로를 따라 해당 JSON 노드의 LSP Range를 찾습니다.
 */
export function findRangeForPath(text: string, zodErrorPath: (string | number)[]): Range {
  const tree = parseTree(text);
  if (!tree) {
    return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
  }

  const node = findNodeAtLocation(tree, zodErrorPath);
  if (node) {
    const start = offsetToPosition(text, node.offset);
    const end = offsetToPosition(text, node.offset + node.length);
    return { start, end };
  }

  // 경로의 부모 노드를 찾아 fallback
  for (let i = zodErrorPath.length - 1; i >= 0; i--) {
    const parentNode = findNodeAtLocation(tree, zodErrorPath.slice(0, i));
    if (parentNode) {
      const start = offsetToPosition(text, parentNode.offset);
      const end = offsetToPosition(text, parentNode.offset + parentNode.length);
      return { start, end };
    }
  }

  return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
}

/**
 * 지정 경로의 object에서 이미 존재하는 key 목록을 반환합니다.
 */
export function getExistingKeys(text: string, parentPath: (string | number)[]): string[] {
  const tree = parseTree(text);
  if (!tree) {
    return [];
  }

  const node = parentPath.length === 0 ? tree : findNodeAtLocation(tree, parentPath);
  if (!node || node.type !== "object" || !node.children) {
    return [];
  }

  return node.children
    .filter((child): child is Node => child.type === "property" && !!child.children?.[0])
    .map((prop) => prop.children?.[0].value as string);
}

/**
 * 지정 경로의 배열에서 이미 존재하는 string 값 목록을 반환합니다.
 */
export function getExistingArrayValues(text: string, arrayPath: (string | number)[]): string[] {
  const tree = parseTree(text);
  if (!tree) {
    return [];
  }

  const node = findNodeAtLocation(tree, arrayPath);
  if (!node || node.type !== "array" || !node.children) {
    return [];
  }

  return node.children
    .filter((child) => child.type === "string")
    .map((child) => child.value as string);
}
