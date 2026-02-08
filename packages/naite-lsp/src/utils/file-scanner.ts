import { glob } from "glob";

/**
 * glob 기반 파일 탐색 유틸리티.
 * vscode.workspace.findFiles 대체.
 */
export async function findFiles(
  baseDir: string,
  pattern: string,
  excludePattern?: string,
): Promise<string[]> {
  const ignore = excludePattern
    ? excludePattern
        .replace(/^\{/, "")
        .replace(/\}$/, "")
        .split(",")
        .map((p) => p.trim())
    : [];

  const files = await glob(pattern, {
    cwd: baseDir,
    absolute: true,
    ignore,
    nodir: true,
  });

  return files;
}

/**
 * sonamu.config.ts 파일을 찾아 프로젝트 루트들을 반환합니다.
 */
export async function findConfigFiles(workspaceRoot: string): Promise<string[]> {
  const configFiles = await findFiles(workspaceRoot, "**/sonamu.config.ts", "**/node_modules/**");
  return configFiles;
}

/**
 * sonamu.config.ts 경로들을 반환합니다.
 */
export async function findConfigPaths(workspaceRoot: string): Promise<string[]> {
  return findConfigFiles(workspaceRoot);
}

/**
 * 프로젝트 루트에서 TypeScript 파일들을 스캔합니다.
 */
export async function findProjectTsFiles(projectRoot: string): Promise<string[]> {
  const projectFiles = await findFiles(
    projectRoot,
    "**/*.ts",
    "{**/node_modules/**,**/build/**,**/out/**,**/dist/**,**/*.d.ts}",
  );

  const sonamuFiles = await findFiles(projectRoot, "node_modules/sonamu/src/**/*.ts", "**/*.d.ts");

  return [...projectFiles, ...sonamuFiles];
}
