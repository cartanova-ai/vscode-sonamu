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
      "sonamu.config.ts를 찾을 수 없습니다. Naite 소켓 서버를 시작할 수 없습니다. 그치만 sonamu.config.ts가 없으면 extension 자체가 activate되지 않아야 함이 타당합니다. 어딘가에서 변경이 일어난 것으로 추정됩니다.",
    );
  }

  return configFiles;
}

export async function findConfigPaths(): Promise<string[]> {
  const configFiles = await findConfigFiles();
  return configFiles.map((f) => f.fsPath);
}