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
 * Unix와 Windows 경로 모두 지원합니다.
 *
 * @example
 * getFileName("/src/utils/math.ts") → "math.ts"
 * getFileName("C:\\src\\utils\\math.ts") → "math.ts"
 * getFileName("math.ts") → "math.ts"
 * getFileName("") → "(unknown)"
 */
export function getFileName(filePath: string): string {
  if (!filePath) {
    return "(unknown)";
  }
  // 백슬래시를 슬래시로 정규화하여 Windows 경로도 지원
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.split("/").pop() || "(unknown)";
}
