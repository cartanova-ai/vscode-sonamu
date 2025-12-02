import type vscode from "vscode";

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
