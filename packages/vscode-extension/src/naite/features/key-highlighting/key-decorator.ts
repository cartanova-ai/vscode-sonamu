import vscode from "vscode";

let decorationType: vscode.TextEditorDecorationType | null = null;
let currentStyle: string = "";

function getDecorationStyle(): vscode.DecorationRenderOptions {
  const config = vscode.workspace.getConfiguration("sonamu.naite");
  const style = config.get<string>("decoration.style", "underline");

  const options: vscode.DecorationRenderOptions = {};

  if (style.includes("underline")) {
    options.textDecoration = "underline";
  }
  if (style.includes("bold")) {
    options.fontWeight = "bold";
  }
  if (style.includes("italic")) {
    options.fontStyle = "italic";
  }

  return options;
}

function ensureDecorationType(): vscode.TextEditorDecorationType {
  const config = vscode.workspace.getConfiguration("sonamu.naite");
  const style = config.get<string>("decoration.style", "underline");

  if (decorationType && currentStyle === style) {
    return decorationType;
  }

  if (decorationType) {
    decorationType.dispose();
  }

  currentStyle = style;
  decorationType = vscode.window.createTextEditorDecorationType(getDecorationStyle());
  return decorationType;
}

const NAITE_KEY_REGEX = /Naite\.(t|get|del)\s*\(\s*["'`]([^"'`]+)["'`]/g;

export function updateKeyDecorations(editor: vscode.TextEditor) {
  if (editor.document.languageId !== "typescript") {
    return;
  }

  const config = vscode.workspace.getConfiguration("sonamu.naite");
  if (!config.get<boolean>("decoration.enabled", true)) {
    if (decorationType) {
      editor.setDecorations(decorationType, []);
    }
    return;
  }

  const decType = ensureDecorationType();
  const text = editor.document.getText();
  const decorations: vscode.DecorationOptions[] = [];

  const regex = new RegExp(NAITE_KEY_REGEX.source, "g");
  for (let match = regex.exec(text); match !== null; match = regex.exec(text)) {
    const fullMatch = match[0];
    const key = match[2];
    const keyStart = match.index + fullMatch.indexOf(key);
    const keyEnd = keyStart + key.length;

    const startPos = editor.document.positionAt(keyStart);
    const endPos = editor.document.positionAt(keyEnd);
    decorations.push({ range: new vscode.Range(startPos, endPos) });
  }

  editor.setDecorations(decType, decorations);
}

export function disposeKeyDecorations() {
  if (decorationType) {
    decorationType.dispose();
    decorationType = null;
  }
}
