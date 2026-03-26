import vscode from "vscode";

/**
 * 파일의 특정 라인으로 이동하고 화면 중앙에 표시
 *
 * @param filePath - 이동할 파일의 절대 경로
 * @param lineNumber - 이동할 라인 번호 (1-based)
 * @returns 성공 시 true, 실패 시 false
 */
export async function goToLocation(filePath: string, lineNumber: number): Promise<boolean> {
  try {
    const uri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    const line = lineNumber - 1;
    const position = new vscode.Position(line, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    return true;
  } catch (err) {
    console.error(`[goToLocation] Failed to open ${filePath}:${lineNumber}:`, err);
    return false;
  }
}
