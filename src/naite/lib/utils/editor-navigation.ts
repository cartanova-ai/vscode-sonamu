import vscode from "vscode";

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
  editor.revealRange(
    new vscode.Range(position, position),
    vscode.TextEditorRevealType.InCenter,
  );
}
