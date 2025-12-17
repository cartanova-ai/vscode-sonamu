import vscode from "vscode";
import { NaiteTracker } from "../tracking/tracker";

/**
 * 파일의 특정 라인으로 이동하고 화면 중앙에 표시
 */
export async function goToLocation(filePath: string, lineNumber: number): Promise<void> {
  const uri = vscode.Uri.file(filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
  const line = lineNumber - 1;
  const position = new vscode.Position(line, 0);
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
}

/**
 * vscode.Location으로 이동하고 화면 중앙에 표시
 */
async function revealLocation(loc: vscode.Location): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(loc.uri);
  const editor = await vscode.window.showTextDocument(doc);
  editor.selection = new vscode.Selection(loc.range.start, loc.range.start);
  editor.revealRange(loc.range, vscode.TextEditorRevealType.InCenter);
}

/**
 * Naite 키의 정의 또는 참조 위치로 이동
 * 여러 개일 경우 QuickPick으로 선택
 */
export async function goToKeyLocations(
  key: string,
  type: "set" | "get",
  label: string,
): Promise<void> {
  const locs = NaiteTracker.getKeyLocations(key, type);

  if (locs.length === 0) {
    vscode.window.showInformationMessage(`"${key}" ${label}를 찾을 수 없습니다.`);
    return;
  }

  if (locs.length === 1) {
    await revealLocation(locs[0]);
    return;
  }

  // 여러 개일 때 QuickPick으로 선택
  const icon = type === "set" ? "symbol-method" : "references";
  const items = locs.map((loc) => ({
    label: `$(${icon}) ${vscode.workspace.asRelativePath(loc.uri)}:${loc.range.start.line + 1}`,
    location: loc,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `"${key}" ${label} 선택`,
  });

  if (selected) {
    await revealLocation(selected.location);
  }
}
