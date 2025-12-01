import assert from "node:assert";
import vscode from "vscode";
import NaiteParser from "./parser";

suite("NaiteParser", () => {
  test("should parse the Naite.t calls", async () => {
    const [uri] = await vscode.workspace.findFiles("calculator.ts");

    const result = new NaiteParser(await vscode.workspace.openTextDocument(uri), {
      setPatterns: ["Naite.t"],
      getPatterns: ["Naite.get"],
    }).parse();

    assert.strictEqual(result.size, 2);

    assert.strictEqual(result.get("add:params")?.length, 1);
    assert.strictEqual(result.get("add:params")?.[0].key, "add:params");
    assert.strictEqual(result.get("add:params")?.[0].location.uri.fsPath, uri.fsPath);
    assert.strictEqual(result.get("add:params")?.[0].location.range.start.line, 3);
    assert.strictEqual(result.get("add:params")?.[0].location.range.start.character, 2);
    assert.strictEqual(result.get("add:params")?.[0].location.range.end.line, 3);
    assert.strictEqual(result.get("add:params")?.[0].location.range.end.character, 33);
    assert.strictEqual(result.get("add:params")?.[0].type, "set");
    assert.strictEqual(result.get("add:params")?.[0].pattern, "Naite.t");

    assert.strictEqual(result.get("add:result")?.length, 1);
    assert.strictEqual(result.get("add:result")?.[0].key, "add:result");
    assert.strictEqual(result.get("add:result")?.[0].location.uri.fsPath, uri.fsPath);
    assert.strictEqual(result.get("add:result")?.[0].location.range.start.line, 6);
    assert.strictEqual(result.get("add:result")?.[0].location.range.start.character, 2);
    assert.strictEqual(result.get("add:result")?.[0].location.range.end.line, 6);
    assert.strictEqual(result.get("add:result")?.[0].location.range.end.character, 31);
    assert.strictEqual(result.get("add:result")?.[0].type, "set");
    assert.strictEqual(result.get("add:result")?.[0].pattern, "Naite.t");
  });

  test("should parse the Naite.get calls", async () => {
    const [uri] = await vscode.workspace.findFiles("calculator.test.ts");

    const result = new NaiteParser(await vscode.workspace.openTextDocument(uri), {
      setPatterns: ["Naite.t"],
      getPatterns: ["Naite.get"],
    }).parse();

    assert.strictEqual(result.size, 3);

    assert.strictEqual(result.get("add:params")?.length, 1);
    assert.strictEqual(result.get("add:params")?.[0].key, "add:params");
    assert.strictEqual(result.get("add:params")?.[0].location.uri.fsPath, uri.fsPath);
    assert.strictEqual(result.get("add:params")?.[0].location.range.start.line, 7);
    assert.strictEqual(result.get("add:params")?.[0].location.range.start.character, 4);
    assert.strictEqual(result.get("add:params")?.[0].location.range.end.line, 7);
    assert.strictEqual(result.get("add:params")?.[0].location.range.end.character, 27);
    assert.strictEqual(result.get("add:params")?.[0].type, "get");
    assert.strictEqual(result.get("add:params")?.[0].pattern, "Naite.get");

    assert.strictEqual(result.get("add:result")?.length, 1);
    assert.strictEqual(result.get("add:result")?.[0].key, "add:result");
    assert.strictEqual(result.get("add:result")?.[0].location.uri.fsPath, uri.fsPath);
    assert.strictEqual(result.get("add:result")?.[0].location.range.start.line, 8);
    assert.strictEqual(result.get("add:result")?.[0].location.range.start.character, 4);
    assert.strictEqual(result.get("add:result")?.[0].location.range.end.line, 8);
    assert.strictEqual(result.get("add:result")?.[0].location.range.end.character, 27);
    assert.strictEqual(result.get("add:result")?.[0].type, "get");
    assert.strictEqual(result.get("add:result")?.[0].pattern, "Naite.get");

    assert.strictEqual(result.get("add:*")?.length, 1);
    assert.strictEqual(result.get("add:*")?.[0].key, "add:*");
    assert.strictEqual(result.get("add:*")?.[0].location.uri.fsPath, uri.fsPath);
    assert.strictEqual(result.get("add:*")?.[0].location.range.start.line, 9);
    assert.strictEqual(result.get("add:*")?.[0].location.range.start.character, 4);
    assert.strictEqual(result.get("add:*")?.[0].location.range.end.line, 9);
    assert.strictEqual(result.get("add:*")?.[0].location.range.end.character, 22);
    assert.strictEqual(result.get("add:*")?.[0].type, "get");
    assert.strictEqual(result.get("add:*")?.[0].pattern, "Naite.get");
  });
});
