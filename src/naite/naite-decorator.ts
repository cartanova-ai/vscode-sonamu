import vscode from "vscode";
import type NaiteTracker from "./tracker";

let decorationType: vscode.TextEditorDecorationType | null = null;
let currentStyle: string = "";

function getDecorationStyle(): vscode.DecorationRenderOptions {
  const config = vscode.workspace.getConfiguration("sonamu");
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
  const config = vscode.workspace.getConfiguration("sonamu");
  const style = config.get<string>("decoration.style", "underline");

  if (decorationType && currentStyle === style) {
    return decorationType;
  }

  // 기존 decoration type 정리
  if (decorationType) {
    decorationType.dispose();
  }

  currentStyle = style;
  decorationType = vscode.window.createTextEditorDecorationType(getDecorationStyle());
  return decorationType;
}

export function updateDecorations(editor: vscode.TextEditor, tracker: NaiteTracker) {
  if (editor.document.languageId !== "typescript") return;

  // 설정에서 decoration 활성화 여부 확인
  const config = vscode.workspace.getConfiguration("sonamu");
  if (!config.get<boolean>("decoration.enabled", true)) {
    // 비활성화된 경우 기존 데코레이션 제거
    if (decorationType) {
      editor.setDecorations(decorationType, []);
    }
    return;
  }

  const decType = ensureDecorationType();

  // tracker에서 스캔된 데이터 사용 (주석 자동 제외)
  const entries = tracker.getEntriesForFile(editor.document.uri);
  const decorations: vscode.DecorationOptions[] = [];

  for (const entry of entries) {
    // 호출문 텍스트에서 키 위치 찾기
    const callText = editor.document.getText(entry.location.range);
    const keyIndex = callText.indexOf(`"${entry.key}"`) + 1; // +1 to skip opening quote
    const keyIndexSingle = callText.indexOf(`'${entry.key}'`) + 1;
    const keyIndexBacktick = callText.indexOf(`\`${entry.key}\``) + 1;

    const offset = keyIndex > 0 ? keyIndex : keyIndexSingle > 0 ? keyIndexSingle : keyIndexBacktick;
    if (offset <= 0) continue;

    const startOffset = editor.document.offsetAt(entry.location.range.start) + offset;
    const endOffset = startOffset + entry.key.length;

    const startPos = editor.document.positionAt(startOffset);
    const endPos = editor.document.positionAt(endOffset);
    decorations.push({ range: new vscode.Range(startPos, endPos) });
  }

  editor.setDecorations(decType, decorations);
}

export function disposeDecorations() {
  if (decorationType) {
    decorationType.dispose();
    decorationType = null;
  }
}
