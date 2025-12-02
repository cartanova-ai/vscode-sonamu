import assert from "node:assert";
import vscode from "vscode";
import NaiteExpressionExtractor from "./expression-extractor";

suite("NaiteExpressionExtractor", () => {
  test("calculator.ts에서 Naite.t 키를 추출합니다", async () => {
    const [uri] = await vscode.workspace.findFiles("calculator.ts");

    const document = await vscode.workspace.openTextDocument(uri);
    const extractor = new NaiteExpressionExtractor(document);

    // "add:params" 키 위치 (2 spaces + "Naite.t(" + '"' = 11, 'a'는 11)
    const addParamsPosition = new vscode.Position(3, 11); // "add:params"의 'a' 위치
    const addParamsKey = extractor.extractKeyAtPosition(addParamsPosition, ["Naite.t"]);
    assert.strictEqual(addParamsKey, "add:params");

    // "add:result" 키 위치 (2 spaces + "Naite.t(" + '"' = 11, 'a'는 11)
    const addResultPosition = new vscode.Position(6, 11); // "add:result"의 'a' 위치
    const addResultKey = extractor.extractKeyAtPosition(addResultPosition, ["Naite.t"]);
    assert.strictEqual(addResultKey, "add:result");
  });

  test("calculator.test.ts에서 Naite.get 키를 추출합니다", async () => {
    const [uri] = await vscode.workspace.findFiles("calculator.test.ts");

    const document = await vscode.workspace.openTextDocument(uri);
    const extractor = new NaiteExpressionExtractor(document);

    // "add:params" 키 위치 (4 spaces + "Naite.get(" + '"' = 14, 'a'는 14)
    const addParamsPosition = new vscode.Position(7, 14); // "add:params"의 'a' 위치
    const addParamsKey = extractor.extractKeyAtPosition(addParamsPosition, ["Naite.get"]);
    assert.strictEqual(addParamsKey, "add:params");

    // "add:result" 키 위치 (4 spaces + "Naite.get(" + '"' = 14, 'a'는 14)
    const addResultPosition = new vscode.Position(8, 14); // "add:result"의 'a' 위치
    const addResultKey = extractor.extractKeyAtPosition(addResultPosition, ["Naite.get"]);
    assert.strictEqual(addResultKey, "add:result");

    // "add:*" 키 위치
    const addWildcardPosition = new vscode.Position(9, 12); // "add:*"의 ':' 위치
    const addWildcardKey = extractor.extractKeyAtPosition(addWildcardPosition, ["Naite.get"]);
    assert.strictEqual(addWildcardKey, "add:*");
  });

  test("키가 아닌 위치에서는 null을 반환합니다", async () => {
    const [uri] = await vscode.workspace.findFiles("calculator.ts");

    const document = await vscode.workspace.openTextDocument(uri);
    const extractor = new NaiteExpressionExtractor(document);

    // 함수 이름 위치 (line 3, 0-based index 2는 "export function add..." 이므로 character 16이 "add"의 'a')
    // 이 라인에는 Naite.t 호출이 없으므로 null을 반환해야 함
    const functionNamePosition = new vscode.Position(2, 16); // "add" 함수 이름의 'a' 위치 (0-based line)
    const result1 = extractor.extractKeyAtPosition(functionNamePosition, ["Naite.t"]);
    assert.strictEqual(result1, null, "함수 이름 위치에서는 null을 반환해야 함");

    // Naite.t 호출 밖의 위치 (line 3, 0-based index 3은 "  Naite.t(...)" 이므로 호출 밖)
    const outsidePosition = new vscode.Position(3, 35); // Naite.t 호출 밖
    const result2 = extractor.extractKeyAtPosition(outsidePosition, ["Naite.t"]);
    assert.strictEqual(result2, null);

    // 빈 줄 위치
    const emptyLinePosition = new vscode.Position(5, 0);
    const result3 = extractor.extractKeyAtPosition(emptyLinePosition, ["Naite.t"]);
    assert.strictEqual(result3, null);
  });

  test("패턴이 매칭되지 않으면 null을 반환합니다", async () => {
    const [uri] = await vscode.workspace.findFiles("calculator.ts");

    const document = await vscode.workspace.openTextDocument(uri);
    const extractor = new NaiteExpressionExtractor(document);

    // Naite.t 호출 위치이지만 Naite.get 패턴으로 검색
    const addParamsPosition = new vscode.Position(3, 11);
    const result = extractor.extractKeyAtPosition(addParamsPosition, ["Naite.get"]);
    assert.strictEqual(result, null);
  });

  test("여러 패턴 중 하나라도 매칭되면 키를 반환합니다", async () => {
    const [uri] = await vscode.workspace.findFiles("calculator.ts");

    const document = await vscode.workspace.openTextDocument(uri);
    const extractor = new NaiteExpressionExtractor(document);

    // Naite.t와 Naite.get 패턴 모두 제공
    const addParamsPosition = new vscode.Position(3, 11);
    const result = extractor.extractKeyAtPosition(addParamsPosition, ["Naite.t", "Naite.get"]);
    assert.strictEqual(result, "add:params");
  });
});
