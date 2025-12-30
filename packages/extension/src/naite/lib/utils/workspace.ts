import vscode from "vscode";

/**
 * 워크스페이스에서 Sonamu 설정 파일들의 경로를 찾습니다.
 * 하나도 없으면 터뜨립니다.
 *
 * @returns
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

export async function findConfigPaths(): Promise<string[]> {
  const configFiles = await findConfigFiles();
  return configFiles.map((f) => f.fsPath);
}
