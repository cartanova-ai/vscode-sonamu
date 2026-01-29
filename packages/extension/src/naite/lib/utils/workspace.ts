import vscode from "vscode";

/**
 * 워크스페이스에서 Sonamu 설정 파일들의 경로를 찾습니다.
 * 하나도 없으면 에러를 던집니다.
 *
 * @returns sonamu.config.ts 파일들의 Uri 배열
 * @throws sonamu.config.ts를 찾을 수 없으면 Error를 던집니다
 */
export async function findConfigFiles(): Promise<vscode.Uri[]> {
  const configFiles = await vscode.workspace.findFiles("**/sonamu.config.ts", "**/node_modules/**");
  if (configFiles.length === 0) {
    throw new Error(
      "sonamu.config.ts를 찾을 수 없습니다. Sonamu 프로젝트가 워크스페이스에 열려있는지 확인하세요.",
    );
  }

  return configFiles;
}

/**
 * 워크스페이스에서 Sonamu 설정 파일들의 파일시스템 경로를 찾습니다.
 * {@link findConfigFiles}의 결과를 fsPath 문자열 배열로 변환합니다.
 *
 * @returns 설정 파일들의 파일시스템 경로 배열
 * @throws sonamu.config.ts를 찾을 수 없으면 에러를 던집니다 (findConfigFiles에서 발생)
 */
export async function findConfigPaths(): Promise<string[]> {
  const configFiles = await findConfigFiles();
  return configFiles.map((f) => f.fsPath);
}
