import { describe, expect, it } from "vitest";
import { escapeId } from "./escapeId";

describe("escapeId", () => {
  it("영문/숫자만 있는 문자열은 그대로 유지 + 해시 추가", () => {
    const result = escapeId("MathService");
    expect(result).toMatch(/^MathService_[a-z0-9]+$/);
  });

  it("특수문자는 언더스코어로 대체", () => {
    const result = escapeId("a::b::c");
    expect(result).toMatch(/^a__b__c_[a-z0-9]+$/);
  });

  it("한글은 언더스코어로 대체", () => {
    const result = escapeId("테스트");
    // 한글 "테스트"는 언더스코어로 대체되고 해시가 추가됨
    expect(result).toMatch(/^_+[a-z0-9]+$/);
  });

  it("동일 입력은 항상 동일 출력 (결정적)", () => {
    const input = "same input 같은 입력";
    expect(escapeId(input)).toBe(escapeId(input));
  });

  it("빈 문자열도 처리", () => {
    const result = escapeId("");
    expect(result).toMatch(/^_[a-z0-9]+$/);
  });

  it("다른 입력은 다른 해시 생성", () => {
    const a = escapeId("input-a");
    const b = escapeId("input-b");
    expect(a).not.toBe(b);
  });

  it("하이픈과 언더스코어는 유지", () => {
    const result = escapeId("test-case_name");
    expect(result).toMatch(/^test-case_name_[a-z0-9]+$/);
  });

  it("실제 trace key 형식 처리", () => {
    const traceKey = "MathService::add::result::2024-01-01T00:00:00.000Z::0";
    const result = escapeId(traceKey);
    expect(result).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(result.length).toBeGreaterThan(0);
  });
});
