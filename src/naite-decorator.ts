import * as vscode from 'vscode';
import { NaiteTracker } from './naite-tracker';

const decorationType = vscode.window.createTextEditorDecorationType({
  textDecoration: 'underline',
});

export function updateDecorations(editor: vscode.TextEditor, tracker: NaiteTracker) {
  if (editor.document.languageId !== 'typescript') return;

  // tracker에서 스캔된 데이터 사용 (주석 자동 제외)
  const entries = tracker.getEntriesForFile(editor.document.uri);
  const decorations: vscode.DecorationOptions[] = [];

  for (const entry of entries) {
    // 호출문 텍스트에서 키 위치 찾기
    const callText = editor.document.getText(entry.location.range);
    const keyIndex = callText.indexOf(`"${entry.key}"`) + 1; // +1 to skip opening quote
    const keyIndexSingle = callText.indexOf(`'${entry.key}'`) + 1;
    const keyIndexBacktick = callText.indexOf(`\`${entry.key}\``) + 1;

    let offset = keyIndex > 0 ? keyIndex : (keyIndexSingle > 0 ? keyIndexSingle : keyIndexBacktick);
    if (offset <= 0) continue;

    const startOffset = editor.document.offsetAt(entry.location.range.start) + offset;
    const endOffset = startOffset + entry.key.length;

    const startPos = editor.document.positionAt(startOffset);
    const endPos = editor.document.positionAt(endOffset);
    decorations.push({ range: new vscode.Range(startPos, endPos) });
  }

  editor.setDecorations(decorationType, decorations);
}
