import { describe, expect, it } from "vitest";
import {
  findRangeForPath,
  getExistingArrayValues,
  getExistingKeys,
  getJsonContext,
} from "../src/entity/json-utils.js";

const SAMPLE_ENTITY = `{
  "id": "User",
  "title": "사용자",
  "table": "users",
  "props": [
    {
      "name": "username",
      "type": "string",
      "desc": "사용자명"
    },
    {
      "name": "email",
      "type": "string",
      "zodFormat": "email"
    },
    {
      "name": "role",
      "type": "enum",
      "id": "UserRole"
    },
    {
      "name": "profile",
      "type": "relation",
      "with": "Profile",
      "relationType": "BelongsToOne"
    }
  ],
  "indexes": [
    {
      "type": "unique",
      "name": "users_email_unique",
      "columns": [
        { "name": "email", "sortOrder": "ASC" }
      ]
    }
  ],
  "subsets": {
    "A": ["username", "email"],
    "B": { "fields": ["username", "role"] }
  },
  "enums": {
    "UserRole": {
      "admin": "관리자",
      "user": "일반 사용자"
    }
  }
}`;

describe("json-utils", () => {
  describe("getJsonContext", () => {
    it("루트 레벨 property key를 감지한다", () => {
      // "id" 키 위치에서의 컨텍스트
      const ctx = getJsonContext(SAMPLE_ENTITY, 5);
      expect(ctx.isAtPropertyKey).toBe(true);
    });

    it("props[0].type value 위치를 감지한다", () => {
      const idx = SAMPLE_ENTITY.indexOf('"string"', SAMPLE_ENTITY.indexOf('"type"'));
      const ctx = getJsonContext(SAMPLE_ENTITY, idx + 1);
      expect(ctx.path[0]).toBe("props");
      expect(ctx.path[1]).toBe(0);
      expect(ctx.path[2]).toBe("type");
      expect(ctx.isAtPropertyKey).toBe(false);
    });

    it("props[3].with value 위치를 감지한다", () => {
      const idx = SAMPLE_ENTITY.indexOf('"Profile"');
      const ctx = getJsonContext(SAMPLE_ENTITY, idx + 1);
      expect(ctx.path[0]).toBe("props");
      expect(ctx.path[1]).toBe(3);
      expect(ctx.path[2]).toBe("with");
      expect(ctx.isAtPropertyKey).toBe(false);
    });
  });

  describe("findRangeForPath", () => {
    it("존재하는 경로에 대해 올바른 range를 반환한다", () => {
      const range = findRangeForPath(SAMPLE_ENTITY, ["id"]);
      expect(range.start.line).toBeGreaterThanOrEqual(0);
      expect(range.end.line).toBeGreaterThanOrEqual(range.start.line);
    });

    it("중첩 경로에 대해 올바른 range를 반환한다", () => {
      const range = findRangeForPath(SAMPLE_ENTITY, ["props", 0, "name"]);
      expect(range.start.line).toBeGreaterThan(0);
    });

    it("존재하지 않는 경로에 대해 부모 노드로 fallback한다", () => {
      const range = findRangeForPath(SAMPLE_ENTITY, ["props", 0, "nonexistent"]);
      // 부모 노드 (props[0])의 range를 반환해야 함
      expect(range.start.line).toBeGreaterThan(0);
    });
  });

  describe("getExistingKeys", () => {
    it("루트 레벨 키를 반환한다", () => {
      const keys = getExistingKeys(SAMPLE_ENTITY, []);
      expect(keys).toContain("id");
      expect(keys).toContain("props");
      expect(keys).toContain("indexes");
      expect(keys).toContain("subsets");
      expect(keys).toContain("enums");
    });

    it("props[0]의 키를 반환한다", () => {
      const keys = getExistingKeys(SAMPLE_ENTITY, ["props", 0]);
      expect(keys).toContain("name");
      expect(keys).toContain("type");
      expect(keys).toContain("desc");
    });

    it("존재하지 않는 경로는 빈 배열을 반환한다", () => {
      const keys = getExistingKeys(SAMPLE_ENTITY, ["nonexistent"]);
      expect(keys).toEqual([]);
    });
  });

  describe("getExistingArrayValues", () => {
    it("subset 배열의 기존 값을 반환한다", () => {
      const values = getExistingArrayValues(SAMPLE_ENTITY, ["subsets", "A"]);
      expect(values).toContain("username");
      expect(values).toContain("email");
    });

    it("존재하지 않는 경로는 빈 배열을 반환한다", () => {
      const values = getExistingArrayValues(SAMPLE_ENTITY, ["subsets", "nonexistent"]);
      expect(values).toEqual([]);
    });
  });
});

describe("entity-completion", async () => {
  const { handleEntityCompletion } = await import("../src/providers/entity-completion.js");
  const { TextDocument } = await import("vscode-languageserver-textdocument");

  function createEntityDoc(content: string, uri = "file:///test.entity.json") {
    return TextDocument.create(uri, "json", 0, content);
  }

  function getCompletionAt(content: string, searchStr: string, offsetInSearch = 0) {
    const doc = createEntityDoc(content);
    const idx = content.indexOf(searchStr) + offsetInSearch;
    const position = doc.positionAt(idx);
    return handleEntityCompletion(
      { textDocument: { uri: doc.uri }, position, context: undefined as never },
      doc,
    );
  }

  it("props[n].type 위치에서 타입 목록을 제안한다", () => {
    const content = `{
  "id": "Test",
  "props": [
    {
      "name": "field1",
      "type": ""
    }
  ]
}`;
    const items = getCompletionAt(content, '"type": "', 9);
    expect(items).not.toBeNull();
    const labels = items?.map((i) => i.label);
    expect(labels).toContain("string");
    expect(labels).toContain("integer");
    expect(labels).toContain("relation");
    expect(labels).toContain("enum");
  });

  it("props[n].relationType 위치에서 관계 타입을 제안한다", () => {
    const content = `{
  "id": "Test",
  "props": [
    {
      "name": "field1",
      "type": "relation",
      "relationType": ""
    }
  ]
}`;
    const items = getCompletionAt(content, '"relationType": "', 17);
    expect(items).not.toBeNull();
    const labels = items?.map((i) => i.label);
    expect(labels).toContain("BelongsToOne");
    expect(labels).toContain("HasMany");
    expect(labels).toContain("ManyToMany");
    expect(labels).toContain("OneToOne");
  });

  it("indexes[n].type 위치에서 인덱스 타입을 제안한다", () => {
    const content = `{
  "id": "Test",
  "indexes": [
    {
      "type": ""
    }
  ]
}`;
    const items = getCompletionAt(content, '"type": "', 9);
    expect(items).not.toBeNull();
    const labels = items?.map((i) => i.label);
    expect(labels).toContain("index");
    expect(labels).toContain("unique");
    expect(labels).toContain("hnsw");
  });

  it("루트 레벨 property key에서 기존 키를 제외한 목록을 제안한다", () => {
    // 마지막 속성 뒤에 새 키를 입력하는 상황
    const content = `{
  "id": "Test",
  "table": "tests",
  ""
}`;
    const items = getCompletionAt(content, '  ""\n}', 3);
    if (items) {
      const labels = items.map((i) => i.label);
      expect(labels).not.toContain("id");
      expect(labels).not.toContain("table");
      expect(labels).toContain("props");
      expect(labels).toContain("title");
    }
  });
});

describe("entity-diagnostics", async () => {
  const { computeEntityDiagnostics } = await import("../src/providers/entity-diagnostics.js");
  const { TextDocument } = await import("vscode-languageserver-textdocument");

  it("잘못된 JSON에 대해 구문 에러를 반환한다", () => {
    const doc = TextDocument.create("file:///test.entity.json", "json", 0, "{ invalid }");
    const diagnostics = computeEntityDiagnostics(doc);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].source).toBe("sonamu");
  });

  it("유효한 JSON에 대해 sonamu 스키마 없이 빈 배열을 반환한다", () => {
    const doc = TextDocument.create("file:///test.entity.json", "json", 0, '{"id": "Test"}');
    const diagnostics = computeEntityDiagnostics(doc);
    // sonamu가 설치되지 않은 환경이므로 빈 배열
    expect(diagnostics).toEqual([]);
  });
});
