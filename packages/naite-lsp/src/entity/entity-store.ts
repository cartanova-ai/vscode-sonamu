import fs from "fs/promises";
import { findFiles } from "../utils/file-scanner.js";

export interface EntityInfo {
  id: string;
  table: string;
  title?: string;
  filePath: string;
  propNames: string[];
  enumIds: string[];
}

class EntityStoreClass {
  private entities: Map<string, EntityInfo> = new Map();
  private workspaceRoot = "";

  setWorkspaceRoot(root: string): void {
    this.workspaceRoot = root;
  }

  async scanWorkspace(): Promise<void> {
    if (!this.workspaceRoot) {
      return;
    }

    this.entities.clear();

    const files = await findFiles(
      this.workspaceRoot,
      "**/*.entity.json",
      "{**/node_modules/**,**/build/**,**/out/**,**/dist/**}",
    );

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        this.parseAndStore(filePath, content);
      } catch {
        // 파일 읽기 실패 시 무시
      }
    }
  }

  updateFromDocument(uri: string, text: string): void {
    const filePath = uri.startsWith("file://") ? uri.slice(7) : uri;
    this.parseAndStore(filePath, text);
  }

  private parseAndStore(filePath: string, text: string): void {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || !parsed.id) {
        return;
      }

      const propNames: string[] = [];
      if (Array.isArray(parsed.props)) {
        for (const prop of parsed.props) {
          if (prop && typeof prop.name === "string") {
            propNames.push(prop.name);
          }
        }
      }

      const enumIds: string[] = [];
      if (parsed.enums && typeof parsed.enums === "object") {
        enumIds.push(...Object.keys(parsed.enums));
      }

      this.entities.set(parsed.id, {
        id: parsed.id,
        table: parsed.table ?? "",
        title: parsed.title,
        filePath,
        propNames,
        enumIds,
      });
    } catch {
      // JSON 파싱 실패 시 무시
    }
  }

  getAllEntityIds(): string[] {
    return Array.from(this.entities.keys()).sort();
  }

  getEntityById(id: string): EntityInfo | undefined {
    return this.entities.get(id);
  }

  getEntityByFilePath(filePath: string): EntityInfo | undefined {
    const normalizedPath = filePath.startsWith("file://") ? filePath.slice(7) : filePath;
    for (const entity of this.entities.values()) {
      if (entity.filePath === normalizedPath) {
        return entity;
      }
    }
    return undefined;
  }
}

export const EntityStore = new EntityStoreClass();
