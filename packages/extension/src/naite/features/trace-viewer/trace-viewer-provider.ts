// esbuild 플러그인이 naite-trace-viewer 빌드 결과물을 주입합니다
import traceViewerHtml from "@vscode-sonamu/naite-trace-viewer";
import vscode from "vscode";
import { goToLocation } from "../../lib/utils/editor-navigation";

/**
 * 에디터 탭용 Trace Viewer (WebviewPanel)
 * LSP 서버에서 테스트 결과를 받아 웹뷰에 전달합니다.
 */
export class NaiteTraceViewerProvider {
  private _panel: vscode.WebviewPanel | null = null;
  private _disposables: vscode.Disposable[] = [];
  private _followEnabled: boolean = true;

  isFollowEnabled(): boolean {
    return this._followEnabled;
  }

  isVisible(): boolean {
    return this._panel?.visible ?? false;
  }

  show(): vscode.WebviewPanel {
    if (this._panel) {
      if (!this.isVisible()) {
        this._panel.reveal();
      }
      return this._panel;
    }
    this._panel = vscode.window.createWebviewPanel(
      "naiteTraceViewer",
      "Naite Traces",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    vscode.commands.executeCommand("workbench.action.lockEditorGroup");

    this._setupPanel(this._panel);

    return this._panel;
  }

  restorePanel(panel: vscode.WebviewPanel): void {
    this._panel = panel;
    this._setupPanel(panel);
  }

  private _setupPanel(panel: vscode.WebviewPanel): void {
    panel.webview.html = traceViewerHtml;

    panel.onDidDispose(() => {
      this.dispose();
    });

    panel.webview.onDidReceiveMessage(async (message: unknown) => {
      if (!this._isValidMessage(message)) {
        console.warn("[Trace Viewer] Invalid message received:", message);
        return;
      }

      if (message.type === "goToLocation") {
        if (typeof message.filePath === "string" && typeof message.lineNumber === "number") {
          await goToLocation(message.filePath, message.lineNumber);
        }
      } else if (message.type === "followStateChanged") {
        if (typeof message.enabled === "boolean") {
          this._followEnabled = message.enabled;
        }
      }
    });
  }

  /**
   * LSP 서버에서 받은 테스트 결과를 웹뷰에 전송
   */
  sendTestResults(testResults: unknown[]): void {
    if (!this._panel) {
      return;
    }

    this._panel.webview.postMessage({
      type: "updateTestResults",
      testResults,
    });
  }

  focusKey(key: string): void {
    if (!this._panel) {
      return;
    }

    setTimeout(() => {
      this._panel?.webview.postMessage({
        type: "focusKey",
        key,
      });
    }, 100);
  }

  focusTest(suiteName: string, testName: string): void {
    if (!this._panel) {
      return;
    }

    setTimeout(() => {
      this._panel?.webview.postMessage({
        type: "focusTest",
        suiteName,
        testName,
      });
    }, 100);
  }

  private _isValidMessage(message: unknown): message is { type: string; [key: string]: unknown } {
    return (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      typeof (message as { type: unknown }).type === "string"
    );
  }

  dispose(): void {
    if (this._panel) {
      this._panel.dispose();
      this._panel = null;
    }
    for (const d of this._disposables) {
      d.dispose();
    }
  }
}
