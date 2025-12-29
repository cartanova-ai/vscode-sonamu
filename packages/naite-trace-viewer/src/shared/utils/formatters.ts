/**
 * ISO 타임스탬프를 "HH:mm:ss" 형식으로 변환
 *
 * @example
 * formatTime("2024-01-01T14:30:45.123Z") → "14:30:45"
 */
export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * 파일 경로에서 파일명만 추출
 *
 * @example
 * getFileName("/src/utils/math.ts") → "math.ts"
 * getFileName("math.ts") → "math.ts"
 * getFileName("") → ""
 */
export function getFileName(filePath: string): string {
  return filePath.split("/").pop() || filePath;
}
