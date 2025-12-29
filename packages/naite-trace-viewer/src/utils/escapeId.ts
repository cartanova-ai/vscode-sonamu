/**
 * 문자열을 DOM에서 안전하게 사용할 수 있는 ID로 변환합니다.
 *
 * - 영문, 숫자, 하이픈, 언더스코어만 유지
 * - 특수문자와 한글은 언더스코어로 대체
 * - 해시를 추가하여 충돌 방지
 *
 * @example
 * escapeId("MathService") → "MathService_abc123"
 * escapeId("한글 테스트") → "____abc456"
 * escapeId("a::b::c") → "a__b__c_def789"
 */
export function escapeId(str: string): string {
  const hash = djb2Hash(str);
  const safe = str.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${safe}_${Math.abs(hash).toString(36)}`;
}

/**
 * DJB2 해시 알고리즘 (간단하고 빠름)
 * 동일 입력 → 동일 출력 보장
 */
function djb2Hash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}
