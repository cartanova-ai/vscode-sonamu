import { describe, expect, it } from "vitest";
import { TextDocument } from "vscode-languageserver-textdocument";
import NaiteExpressionScanner from "../src/core/expression-scanner.js";

function createDoc(content: string, uri = "file:///test.ts"): TextDocument {
  return TextDocument.create(uri, "typescript", 0, content);
}

describe("NaiteExpressionScanner", () => {
  it("여러 Naite 호출(Naite.t, Naite.get, Naite.del)이 섞인 코드에서 각각의 key, pattern, 위치를 정확히 추출한다", () => {
    const code = `import { Naite } from "sonamu";

export function add(a: number, b: number) {
  Naite.t("add:params", { a, b });

  const result = a + b;
  Naite.t("add:result", result);
  return result;
}

// test code
const params = Naite.get("add:params");
Naite.del("add:result");
`;
    const doc = createDoc(code);
    const scanner = new NaiteExpressionScanner(doc);
    const results = Array.from(scanner.scanNaiteCalls(["Naite.t", "Naite.get", "Naite.del"]));

    expect(results).toHaveLength(4);

    const addParams = results.find((r) => r.key === "add:params" && r.pattern === "Naite.t");
    expect(addParams).toBeDefined();
    expect(addParams?.pattern).toBe("Naite.t");
    expect(addParams?.location.range.start.line).toBe(3);

    const addResult = results.find((r) => r.key === "add:result" && r.pattern === "Naite.t");
    expect(addResult).toBeDefined();
    expect(addResult?.location.range.start.line).toBe(6);

    const getParams = results.find((r) => r.pattern === "Naite.get");
    expect(getParams).toBeDefined();
    expect(getParams?.key).toBe("add:params");
    expect(getParams?.location.range.start.line).toBe(11);

    const delResult = results.find((r) => r.pattern === "Naite.del");
    expect(delResult).toBeDefined();
    expect(delResult?.key).toBe("add:result");
    expect(delResult?.location.range.start.line).toBe(12);
  });

  it("주석 안의 Naite.t 호출은 무시한다", () => {
    const code = `// Naite.t("commented:key", value)
/* Naite.t("block:comment", value) */
Naite.t("real:key", value);
`;
    const doc = createDoc(code);
    const scanner = new NaiteExpressionScanner(doc);
    const results = Array.from(scanner.scanNaiteCalls(["Naite.t"]));

    expect(results).toHaveLength(1);
    expect(results[0].key).toBe("real:key");
  });

  it("첫 번째 인자가 변수인 경우 무시한다 (문자열 리터럴만 인식)", () => {
    const code = `const key = "dynamic:key";
Naite.t(key, value);
Naite.t("literal:key", value);
`;
    const doc = createDoc(code);
    const scanner = new NaiteExpressionScanner(doc);
    const results = Array.from(scanner.scanNaiteCalls(["Naite.t"]));

    expect(results).toHaveLength(1);
    expect(results[0].key).toBe("literal:key");
  });
});
