import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TextDocument } from "vscode-languageserver-textdocument";
import { NaiteTracker } from "../src/core/tracker.js";

// NaiteTracker는 싱글턴이므로 테스트 간 상태 초기화를 위해
// scanWorkspace()로 초기화하는 대신 scanDocument()를 사용합니다.

describe("NaiteTracker", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "naite-tracker-test-"));
    // 워크스페이스 초기화를 위해 빈 스캔 수행
    NaiteTracker.setWorkspaceRoot(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("getKeyLocations('puri:*', 'set')이 매칭되는 모든 위치를 반환한다", () => {
    const code = `Naite.t("puri:a", valueA);
Naite.t("puri:b", valueB);
Naite.t("other:c", valueC);
`;
    const uri = "file:///test-wildcard.ts";
    const doc = TextDocument.create(uri, "typescript", 0, code);
    NaiteTracker.scanDocument(doc);

    const locations = NaiteTracker.getKeyLocations("puri:*", "set");
    expect(locations).toHaveLength(2);

    const keys = locations.map((loc) => {
      // location의 시작 라인으로 검증
      return loc.range.start.line;
    });
    expect(keys).toContain(0); // puri:a
    expect(keys).toContain(1); // puri:b
  });

  it("scanDocument() 호출 시 이전에 같은 파일에서 스캔된 결과가 교체된다", () => {
    const uri = "file:///test-replace.ts";

    const codeV1 = `Naite.t("key:a", value);
Naite.t("key:b", value);
`;
    const docV1 = TextDocument.create(uri, "typescript", 0, codeV1);
    NaiteTracker.scanDocument(docV1);

    expect(NaiteTracker.getAllKeys()).toContain("key:a");
    expect(NaiteTracker.getAllKeys()).toContain("key:b");

    // 같은 URI로 다시 스캔 - key:b가 사라지고 key:c가 추가됨
    const codeV2 = `Naite.t("key:a", value);
Naite.t("key:c", value);
`;
    const docV2 = TextDocument.create(uri, "typescript", 1, codeV2);
    NaiteTracker.scanDocument(docV2);

    expect(NaiteTracker.getAllKeys()).toContain("key:a");
    expect(NaiteTracker.getAllKeys()).not.toContain("key:b");
    expect(NaiteTracker.getAllKeys()).toContain("key:c");
  });

  it("getEntriesForFile()이 해당 파일의 엔트리만 정확히 반환한다", () => {
    const uri1 = "file:///file1.ts";
    const uri2 = "file:///file2.ts";

    const code1 = `Naite.t("file1:key", value);`;
    const code2 = `Naite.t("file2:key", value);
Naite.get("file2:read", value);
`;

    NaiteTracker.scanDocument(TextDocument.create(uri1, "typescript", 0, code1));
    NaiteTracker.scanDocument(TextDocument.create(uri2, "typescript", 0, code2));

    const entries1 = NaiteTracker.getEntriesForFile(uri1);
    expect(entries1).toHaveLength(1);
    expect(entries1[0].key).toBe("file1:key");

    const entries2 = NaiteTracker.getEntriesForFile(uri2);
    expect(entries2).toHaveLength(2);
    expect(entries2.map((e) => e.key).sort()).toEqual(["file2:key", "file2:read"]);
  });
});
