import vscode from "vscode";
import { NaiteTracker } from "../../lib/tracking/tracker";

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

  // 기존 decoration type 정리
  if (decorationType) {
    decorationType.dispose();
  }

  currentStyle = style;
  decorationType = vscode.window.createTextEditorDecorationType(getDecorationStyle());
  return decorationType;
}

export function updateKeyDecorations(editor: vscode.TextEditor) {
  if (editor.document.languageId !== "typescript") {
    return;
  }

  // 설정에서 decoration 활성화 여부 확인
  const config = vscode.workspace.getConfiguration("sonamu.naite");
  if (!config.get<boolean>("decoration.enabled", true)) {
    // 비활성화된 경우 기존 데코레이션 제거
    if (decorationType) {
      editor.setDecorations(decorationType, []);
    }
    return;
  }

  const decType = ensureDecorationType();

  // tracker에서 스캔된 데이터 사용 (주석 자동 제외)
  const entries = NaiteTracker.getEntriesForFile(editor.document.uri);
  const decorations: vscode.DecorationOptions[] = [];

  for (const entry of entries) {
    // 호출문 텍스트에서 키 위치 찾기
    const callText = editor.document.getText(entry.location.range);

    // 다양한 따옴표 형식 지원 (큰따옴표, 작은따옴표, 백틱)
    const quotePatterns = [
      { pattern: `"${entry.key}"`, quoteLength: 1 },
      { pattern: `'${entry.key}'`, quoteLength: 1 },
      { pattern: `\`${entry.key}\``, quoteLength: 1 },
    ];

    let offset = -1;
    for (const { pattern, quoteLength } of quotePatterns) {
      const index = callText.indexOf(pattern);
      if (index !== -1) {
        offset = index + quoteLength; // 여는 따옴표 건너뛰기
        break;
      }
    }

    if (offset === -1) {
      continue;
    }

    const startOffset = editor.document.offsetAt(entry.location.range.start) + offset;
    const endOffset = startOffset + entry.key.length;

    const startPos = editor.document.positionAt(startOffset);
    const endPos = editor.document.positionAt(endOffset);
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
