import type vscode from "vscode";
import type { NaiteMessagingTypes } from "../../lib/messaging/messaging-types";
import { TraceStore } from "../../lib/messaging/trace-store";
import { goToLocation } from "../../lib/utils/editor-navigation";
import tracePanelHtml from "./ui/index.html";

/**
 * 하단 패널용 Trace 뷰어 (3-Column)
 * - 왼쪽: Key 목록 + 퍼지 검색
 * - 가운데: Suite > Test 트리 (성공/실패, 시간)
 * - 오른쪽: 선택된 Test의 Trace 상세
 */
export class NaiteTracePanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "naiteTracePanelView";

  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];
  private _lastTestResults: NaiteMessagingTypes.TestResult[] = [];

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this._getHtml();

    // 메시지 핸들러
    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        if (message.type === "goToLocation") {
          await goToLocation(message.filePath, message.lineNumber);
        } else if (message.type === "ready") {
          this._sendData();
        }
      },
      null,
      this._disposables,
    );

    // test result 변경 시 업데이트
    this._disposables.push(
      TraceStore.onTestResultChange(() => {
        this._lastTestResults = TraceStore.getAllTestResults();
        this._sendData();
      }),
    );

    this._lastTestResults = TraceStore.getAllTestResults();
  }

  private _sendData(): void {
    if (!this._view) return;

    this._view.webview.postMessage({
      type: "updateData",
      testResults: this._lastTestResults,
    });
  }

  // Trace Panel HTML (빌드 시 임베딩됨)
  private _getHtml(): string {
    return tracePanelHtml;
  }

  dispose(): void {
    for (const d of this._disposables) {
      d.dispose();
    }
  }
}
