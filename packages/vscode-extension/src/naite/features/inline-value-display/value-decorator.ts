import type vscode from "vscode";

// 인라인 값 표시는 이제 LSP의 inlay hints로 처리됩니다.
// 이 파일은 하위 호환을 위해 빈 구현을 유지합니다.

let inlineValueDecorationType: vscode.TextEditorDecorationType | null = null;

export function updateInlineValueDecorations(_editor: vscode.TextEditor) {
  // LSP inlay hints가 인라인 값 표시를 담당합니다.
  // 추후 LSP에서 제공하지 않는 추가적인 데코레이션이 필요할 경우 여기에 구현합니다.
}

export function disposeInlineValueDecorations() {
  if (inlineValueDecorationType) {
    inlineValueDecorationType.dispose();
    inlineValueDecorationType = null;
  }
}
