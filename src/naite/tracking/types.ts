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

/**
 * Naite key -> NaiteKey[] 매핑입니다.
 * 예시: { "add:params": [NaiteKey, NaiteKey, ...], "add:result": [NaiteKey, NaiteKey, ...], ... }
 *
 * 여기서 NaiteKey는 그냥 string이 아니고, 위치와 패턴을 포함하는 객체임에 유의해주세요!
 * 이 map은 key 스트링으로 해당 key에 대한 모든 NaiteKey 객체들을 쉽게 찾기 위한 자료구조입니다.
 */
export type NaiteKeysMap = Map<string, NaiteKey[]>;
