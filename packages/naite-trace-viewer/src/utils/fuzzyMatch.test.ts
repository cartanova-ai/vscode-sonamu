import { describe, expect, it } from "vitest";
import { fuzzyMatch, traceMatchesQuery } from "./fuzzyMatch";

describe("fuzzyMatch", () => {
  it("완전 일치 → 높은 score", () => {
    const result = fuzzyMatch("test", "test");
    expect(result.matched).toBe(true);
    expect(result.indices).toEqual([0, 1, 2, 3]);
    // 100 base + 연속 보너스 (첫 문자 제외 3개 연속 = 30) = 130
    // 실제로는 첫 번째도 "연속"으로 카운트되어 +10 더해짐 = 140
    expect(result.score).toBe(140);
  });

  it("부분 일치 → indices 정확", () => {
    const result = fuzzyMatch("MathService", "ms");
    expect(result.matched).toBe(true);
    expect(result.indices).toEqual([0, 4]); // M...S
  });

  it("연속 문자 보너스", () => {
    const consecutive = fuzzyMatch("calculate", "cal");
    const sparse = fuzzyMatch("c_a_l", "cal");

    expect(consecutive.score).toBeGreaterThan(sparse.score);
  });

  it("불일치 → matched: false, score: 0", () => {
    const result = fuzzyMatch("test", "xyz");
    expect(result.matched).toBe(false);
    expect(result.indices).toEqual([]);
    expect(result.score).toBe(0);
  });

  it("대소문자 무시", () => {
    const result = fuzzyMatch("MathService", "MATH");
    expect(result.matched).toBe(true);
    expect(result.indices).toEqual([0, 1, 2, 3]);
  });

  it("빈 쿼리는 항상 매칭", () => {
    const result = fuzzyMatch("anything", "");
    expect(result.matched).toBe(true);
    expect(result.indices).toEqual([]);
    expect(result.score).toBe(0);
  });

  it("빈 텍스트에 쿼리가 있으면 불일치", () => {
    const result = fuzzyMatch("", "query");
    expect(result.matched).toBe(false);
  });

  it("쿼리가 텍스트보다 길면 불일치", () => {
    const result = fuzzyMatch("ab", "abc");
    expect(result.matched).toBe(false);
  });

  it("순서 중요 (역순은 불일치)", () => {
    const result = fuzzyMatch("abc", "cba");
    expect(result.matched).toBe(false);
  });
});

describe("traceMatchesQuery", () => {
  it("빈 쿼리는 항상 true", () => {
    expect(traceMatchesQuery("any key", "")).toBe(true);
  });

  it("매칭되면 true", () => {
    expect(traceMatchesQuery("user.profile.name", "upn")).toBe(true);
  });

  it("매칭 안되면 false", () => {
    expect(traceMatchesQuery("user.profile.name", "xyz")).toBe(false);
  });
});
