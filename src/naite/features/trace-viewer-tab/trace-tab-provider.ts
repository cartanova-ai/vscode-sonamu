import vscode from "vscode";
import { TraceStore } from "../../lib/messaging/trace-store";
import traceTabHtml from "./ui/index.html";

/**
 * 에디터 탭용 Trace Viewer (WebviewPanel)
 * - 상태바 클릭 또는 명령어로 열림
 * - Suite > Test > Trace 계층 구조
 *
 * 얘는 사실 Provider 모양의 클래스로 만들 필요는 없었습니다만,
 * 일관성을 맞추기 위해 이렇게 했습니다.
 */
export class NaiteTraceTabProvider {
  private _panel: vscode.WebviewPanel | null = null;
  private _disposable: vscode.Disposable | null = null;

  constructor(private readonly _context: vscode.ExtensionContext) {}

  /**
   * 패널이 열려있는지 확인
   */
  isVisible(): boolean {
    return this._panel?.visible ?? false;
  }

  /**
   * Trace Viewer 패널을 열거나 기존 패널을 표시
   */
  show(): vscode.WebviewPanel {
    if (this._panel) {
      if (!this.isVisible()) {
        // 있는데 안 보고 있었다면 보이게 해줘요.
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

    // 새 탭이 열렸으므로 탭 그룹 잠금
    vscode.commands.executeCommand("workbench.action.lockEditorGroup");

    this._panel.webview.html = traceTabHtml;

    this._panel.onDidDispose(() => {
      this._panel = null;
      if (this._disposable) {
        this._disposable.dispose();
        this._disposable = null;
      }
    });

    // 메시지 핸들러
    this._panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === "goToLocation") {
        const uri = vscode.Uri.file(message.filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
        const line = message.lineNumber - 1;
        const position = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter,
        );
      }
    });

    // 초기 데이터 전송
    this._sendData();

    // trace 변경 시 업데이트
    this._disposable = TraceStore.onTestResultChange(() => {
      this._sendData();
    });
    this._context.subscriptions.push(this._disposable);

    return this._panel;
  }

  /**
   * 특정 위치의 trace를 하이라이트
   */
  highlightTrace(filePath: string, lineNumber: number, key: string): void {
    if (!this._panel) return;

    // 약간의 딜레이 후 메시지 전송 (webview 로드 대기)
    setTimeout(() => {
      this._panel?.webview.postMessage({
        type: "highlightTrace",
        filePath,
        lineNumber,
        key,
      });
    }, 100);
  }

  /**
   * 특정 key의 모든 trace로 이동하고 펼치기
   */
  focusKey(key: string): void {
    if (!this._panel) return;

    setTimeout(() => {
      this._panel?.webview.postMessage({
        type: "focusKey",
        key,
      });
    }, 100);
  }

  /**
   * 특정 test case로 이동하고 펼치기 (trace는 닫힌 상태)
   */
  focusTest(suiteName: string, testName: string): void {
    if (!this._panel) return;

    setTimeout(() => {
      this._panel?.webview.postMessage({
        type: "focusTest",
        suiteName,
        testName,
      });
    }, 100);
  }

  private _sendData(): void {
    if (!this._panel) return;

    const testResults = TraceStore.getAllTestResults();

    this._panel.webview.postMessage({
      type: "updateTestResults",
      testResults,
    });
  }

  dispose(): void {
    if (this._panel) {
      this._panel.dispose();
      this._panel = null;
    }
    if (this._disposable) {
      this._disposable.dispose();
      this._disposable = null;
    }
  }
}
