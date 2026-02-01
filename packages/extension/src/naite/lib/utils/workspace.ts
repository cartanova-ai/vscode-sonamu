import vscode from "vscode";

/**
 * 워크스페이스에서 Sonamu 설정 파일들의 경로를 찾습니다.
 * 설정 파일이 없으면 빈 배열을 반환합니다.
 *
 * @returns sonamu.config.ts 파일들의 Uri 배열 (없으면 빈 배열)
 */
export async function findConfigFiles(): Promise<vscode.Uri[]> {
  const configFiles = await vscode.workspace.findFiles("**/sonamu.config.ts", "**/node_modules/**");
  return configFiles;
}

/**
 * 워크스페이스에서 Sonamu 설정 파일들의 파일시스템 경로를 찾습니다.
 * {@link findConfigFiles}의 결과를 fsPath 문자열 배열로 변환합니다.
 *
 * @returns 설정 파일들의 파일시스템 경로 배열 (없으면 빈 배열)
 */
export async function findConfigPaths(): Promise<string[]> {
  const configFiles = await findConfigFiles();
  return configFiles.map((f) => f.fsPath);
}
