import vscode from "vscode";
import { TraceStore } from "../../lib/messaging/trace-store";
import { goToLocation } from "../../lib/utils/editor-navigation";
import traceTabHtml from "./ui/index.html";

/**
 * 에디터 탭용 Trace Viewer (WebviewPanel)
 * - 상태바 클릭 또는 명령어로 열림
 * - Suite > Test > Trace 계층 구조
 *
 * 얘는 사실 Provider 모양의 클래스로 만들 필요는 없었습니다만,
 * 일관성을 맞추기 위해 이렇게 했습니다.
 */
export class NaiteTraceViewerProvider {
  private _panel: vscode.WebviewPanel | null = null;
  private _disposables: vscode.Disposable[] = [];
  private _followEnabled: boolean = true;

  constructor(private readonly _context: vscode.ExtensionContext) {}

  /**
   * 에디터 클릭 시 트레이스 따라가기 활성화 여부
   */
  isFollowEnabled(): boolean {
    return this._followEnabled;
  }

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

    this._setupPanel(this._panel);

    return this._panel;
  }

  /**
   * VSCode 재시작 시 패널 복원
   */
  restorePanel(panel: vscode.WebviewPanel): void {
    this._panel = panel;
    this._setupPanel(panel);
  }

  /**
   * 패널 공통 설정 (생성/복원 시 모두 사용)
   */
  private _setupPanel(panel: vscode.WebviewPanel): void {
    panel.webview.html = traceTabHtml;

    panel.onDidDispose(() => {
      this.dispose();
    });

    // 메시지 핸들러
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === "goToLocation") {
        await goToLocation(message.filePath, message.lineNumber);
      } else if (message.type === "followStateChanged") {
        this._followEnabled = message.enabled;
      }
    });

    // 초기 데이터 전송
    this._sendData();

    // trace 변경 시 업데이트
    this._disposables.push(
      TraceStore.onTestResultAdded(() => {
        this._sendData();
      }),
      TraceStore.onTestResultChange(() => {
        this._sendData();
      }),
    );
    this._context.subscriptions.push(...this._disposables);
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
    for (const d of this._disposables) {
      d.dispose();
    }
  }
}
