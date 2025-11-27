import * as vscode from 'vscode';
import { NaiteTracker } from './naite-tracker';

const decorationType = vscode.window.createTextEditorDecorationType({
  textDecoration: 'underline',
});

export function updateDecorations(editor: vscode.TextEditor, tracker: NaiteTracker) {
  if (editor.document.languageId !== 'typescript') return;

  const text = editor.document.getText();
  const pattern = /Naite\.(t|get)\s*\(\s*["'`]([^"'`]+)["'`]/g;
  const decorations: vscode.DecorationOptions[] = [];

  let match;
  while ((match = pattern.exec(text)) !== null) {
    const keyStart = match.index + match[0].indexOf(match[2]);
    const keyEnd = keyStart + match[2].length;
    const startPos = editor.document.positionAt(keyStart);
    const endPos = editor.document.positionAt(keyEnd);
    decorations.push({ range: new vscode.Range(startPos, endPos) });
  }

  editor.setDecorations(decorationType, decorations);
}
