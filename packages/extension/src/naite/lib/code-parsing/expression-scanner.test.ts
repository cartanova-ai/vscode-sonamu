import assert from "node:assert";
import vscode from "vscode";
import NaiteExpressionScanner from "./expression-scanner";

suite("NaiteExpressionScanner", () => {
  test("calculator.ts에서 Naite.t 호출을 잘 물어옵니다.", async () => {
    const [uri] = await vscode.workspace.findFiles("calculator.ts");

    const document = await vscode.workspace.openTextDocument(uri);
    const scanner = new NaiteExpressionScanner(document);
    const results = Array.from(scanner.scanNaiteCalls(["Naite.t"]));

    assert.strictEqual(results.length, 2);

    const addParams = results.find((r) => r.key === "add:params");
    assert.ok(addParams);
    assert.strictEqual(addParams.key, "add:params");
    assert.strictEqual(addParams.location.uri.fsPath, uri.fsPath);
    assert.strictEqual(addParams.location.range.start.line, 3);
    assert.strictEqual(addParams.location.range.start.character, 2);
    assert.strictEqual(addParams.location.range.end.line, 3);
    assert.strictEqual(addParams.location.range.end.character, 33);
    assert.strictEqual(addParams.pattern, "Naite.t");

    const addResult = results.find((r) => r.key === "add:result");
    assert.ok(addResult);
    assert.strictEqual(addResult.key, "add:result");
    assert.strictEqual(addResult.location.uri.fsPath, uri.fsPath);
    assert.strictEqual(addResult.location.range.start.line, 6);
    assert.strictEqual(addResult.location.range.start.character, 2);
    assert.strictEqual(addResult.location.range.end.line, 6);
    assert.strictEqual(addResult.location.range.end.character, 31);
    assert.strictEqual(addResult.pattern, "Naite.t");
  });

  test("calculator.test.ts에서 Naite.get 호출을 잘 물어옵니다.", async () => {
    const [uri] = await vscode.workspace.findFiles("calculator.test.ts");

    const document = await vscode.workspace.openTextDocument(uri);
    const scanner = new NaiteExpressionScanner(document);
    const results = Array.from(scanner.scanNaiteCalls(["Naite.get"]));

    assert.strictEqual(results.length, 3);

    const addParams = results.find((r) => r.key === "add:params");
    assert.ok(addParams);
    assert.strictEqual(addParams.key, "add:params");
    assert.strictEqual(addParams.location.uri.fsPath, uri.fsPath);
    assert.strictEqual(addParams.location.range.start.line, 7);
    assert.strictEqual(addParams.location.range.start.character, 4);
    assert.strictEqual(addParams.location.range.end.line, 7);
    assert.strictEqual(addParams.location.range.end.character, 27);
    assert.strictEqual(addParams.pattern, "Naite.get");

    const addResult = results.find((r) => r.key === "add:result");
    assert.ok(addResult);
    assert.strictEqual(addResult.key, "add:result");
    assert.strictEqual(addResult.location.uri.fsPath, uri.fsPath);
    assert.strictEqual(addResult.location.range.start.line, 8);
    assert.strictEqual(addResult.location.range.start.character, 4);
    assert.strictEqual(addResult.location.range.end.line, 8);
    assert.strictEqual(addResult.location.range.end.character, 27);
    assert.strictEqual(addResult.pattern, "Naite.get");

    const addWildcard = results.find((r) => r.key === "add:*");
    assert.ok(addWildcard);
    assert.strictEqual(addWildcard.key, "add:*");
    assert.strictEqual(addWildcard.location.uri.fsPath, uri.fsPath);
    assert.strictEqual(addWildcard.location.range.start.line, 9);
    assert.strictEqual(addWildcard.location.range.start.character, 4);
    assert.strictEqual(addWildcard.location.range.end.line, 9);
    assert.strictEqual(addWildcard.location.range.end.character, 22);
    assert.strictEqual(addWildcard.pattern, "Naite.get");
  });
});
