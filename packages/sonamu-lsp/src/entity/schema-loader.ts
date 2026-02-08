import { pathToFileURL } from "node:url";
import fs from "fs";
import path from "path";

interface ZodSafeParseable {
  safeParse(
    data: unknown,
  ): { success: true; data: unknown } | { success: false; error: { issues: ZodIssue[] } };
}

export interface ZodIssue {
  path: (string | number)[];
  message: string;
  code: string;
}

export interface SonamuSchemas {
  EntityJsonSchema: ZodSafeParseable;
}

let cachedSchemas: SonamuSchemas | null = null;

/**
 * sonamu.config.ts 위치에서 상위로 올라가며 node_modules/sonamu를 탐색합니다.
 * Node의 모듈 해석과 동일한 패턴으로, pnpm workspace 구조에서도 동작합니다.
 *
 * 예: sonamu.config.ts가 project/packages/api/src/ 에 있으면
 *   project/packages/api/src/node_modules/sonamu/
 *   project/packages/api/node_modules/sonamu/     ← 보통 여기서 발견
 *   project/packages/node_modules/sonamu/
 *   project/node_modules/sonamu/
 *   ... workspaceRoot까지
 */
export function findSonamuPath(workspaceRoot: string, configPaths: string[] = []): string | null {
  const startDirs = configPaths.map((p) => path.dirname(p));
  if (startDirs.length === 0) {
    startDirs.push(workspaceRoot);
  }

  for (const startDir of startDirs) {
    let dir = startDir;
    while (true) {
      const candidate = path.join(dir, "node_modules/sonamu/dist/index.js");
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      // 워크스페이스 루트에 도달하면 중단
      if (dir === workspaceRoot || dir === path.dirname(dir)) {
        break;
      }
      dir = path.dirname(dir);
    }
  }

  return null;
}

/**
 * sonamu 패키지에서 EntityJsonSchema를 동적으로 로드합니다.
 */
export async function loadSonamuSchemas(
  workspaceRoot: string,
  configPaths: string[] = [],
): Promise<SonamuSchemas | null> {
  if (cachedSchemas) {
    return cachedSchemas;
  }

  const sonamuPath = findSonamuPath(workspaceRoot, configPaths);
  if (!sonamuPath) {
    console.log("[entity] sonamu package not found, schema validation disabled");
    return null;
  }

  try {
    const entryUrl = pathToFileURL(sonamuPath).href;
    const mod = await import(entryUrl);

    if (!mod.EntityJsonSchema) {
      console.log("[entity] EntityJsonSchema not found in sonamu exports");
      return null;
    }

    cachedSchemas = { EntityJsonSchema: mod.EntityJsonSchema };
    console.log(`[entity] sonamu schemas loaded from ${sonamuPath}`);
    return cachedSchemas;
  } catch (err) {
    console.error("[entity] Failed to load sonamu schemas:", err);
    return null;
  }
}

/**
 * 캐시된 스키마를 반환합니다.
 */
export function getCachedSchemas(): SonamuSchemas | null {
  return cachedSchemas;
}

/**
 * 캐시를 초기화합니다 (테스트용).
 */
export function resetSchemaCache(): void {
  cachedSchemas = null;
}
