import * as vscode from 'vscode';
import { NaiteTracker } from './naite-tracker';

const decorationType = vscode.window.createTextEditorDecorationType({
  textDecoration: 'underline',
});

export function updateDecorations(editor: vscode.TextEditor, tracker: NaiteTracker) {
  if (editor.document.languageId !== 'typescript') return;

  const text = editor.document.getText();
  const pattern = tracker.buildRegexPattern();
  const decorations: vscode.DecorationOptions[] = [];

  let match;
  while ((match = pattern.exec(text)) !== null) {
    // 마지막 캡처 그룹이 키
    const key = match[match.length - 1];
    const keyStart = match.index + match[0].indexOf(key);
    const keyEnd = keyStart + key.length;
    const startPos = editor.document.positionAt(keyStart);
    const endPos = editor.document.positionAt(keyEnd);
    decorations.push({ range: new vscode.Range(startPos, endPos) });
  }

  editor.setDecorations(decorationType, decorations);
}
