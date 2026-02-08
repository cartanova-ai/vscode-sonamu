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
 * 워크스페이스에서 sonamu 패키지 경로를 탐색합니다.
 */
export function findSonamuPath(workspaceRoot: string): string | null {
  const candidates = [
    path.join(workspaceRoot, "node_modules/sonamu/dist/index.js"),
    path.join(workspaceRoot, "api/node_modules/sonamu/dist/index.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * sonamu 패키지에서 EntityJsonSchema를 동적으로 로드합니다.
 */
export async function loadSonamuSchemas(workspaceRoot: string): Promise<SonamuSchemas | null> {
  if (cachedSchemas) {
    return cachedSchemas;
  }

  const sonamuPath = findSonamuPath(workspaceRoot);
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
    console.log("[entity] sonamu schemas loaded successfully");
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
