// esbuild 플러그인이 naite-trace-viewer 빌드 결과물을 주입합니다
import traceViewerHtml from "@vscode-sonamu/naite-trace-viewer";
import vscode from "vscode";
import { TraceStore } from "../../lib/messaging/trace-store";
import { goToLocation } from "../../lib/utils/editor-navigation";

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
  private _webviewReady: boolean = false;
  private _pendingMessages: Array<Record<string, unknown>> = [];

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
    // 패널 재생성 시 상태 초기화
    this._webviewReady = false;
    this._pendingMessages = [];

    panel.webview.html = traceViewerHtml;

    panel.onDidDispose(() => {
      this.dispose();
    });

    // 메시지 핸들러
    panel.webview.onDidReceiveMessage(async (message: unknown) => {
      if (!this._isValidMessage(message)) {
        console.warn("[Trace Viewer] Invalid message received:", message);
        return;
      }

      // webview가 준비됨을 알리는 메시지 처리
      if (message.type === "ready") {
        this._webviewReady = true;
        this._flushPendingMessages();
        return;
      }

      if (message.type === "goToLocation") {
        if (typeof message.filePath === "string" && typeof message.lineNumber === "number") {
          await goToLocation(message.filePath, message.lineNumber);
        } else {
          console.warn("[Trace Viewer] Invalid goToLocation payload:", message);
        }
      } else if (message.type === "followStateChanged") {
        if (typeof message.enabled === "boolean") {
          this._followEnabled = message.enabled;
        } else {
          console.warn("[Trace Viewer] Invalid followStateChanged payload:", message);
        }
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
    if (!this._panel) {
      return;
    }

    this._postMessageWhenReady({
      type: "focusKey",
      key,
    });
  }

  /**
   * 특정 test case로 이동하고 펼치기 (trace는 닫힌 상태)
   */
  focusTest(suiteName: string, testName: string): void {
    if (!this._panel) {
      return;
    }

    this._postMessageWhenReady({
      type: "focusTest",
      suiteName,
      testName,
    });
  }

  /**
   * webview가 준비되면 메시지를 전송하고, 아직 준비되지 않았으면 큐에 저장
   */
  private _postMessageWhenReady(message: Record<string, unknown>): void {
    if (this._webviewReady) {
      this._panel?.webview.postMessage(message);
    } else {
      this._pendingMessages.push(message);
    }
  }

  /**
   * 큐에 저장된 모든 메시지를 전송
   */
  private _flushPendingMessages(): void {
    for (const message of this._pendingMessages) {
      this._panel?.webview.postMessage(message);
    }
    this._pendingMessages = [];
  }

  private _sendData(): void {
    if (!this._panel) {
      return;
    }

    const testResults = TraceStore.getAllTestResults();

    this._panel.webview.postMessage({
      type: "updateTestResults",
      testResults,
    });
  }

  /**
   * webview에서 수신한 메시지가 유효한 구조인지 검증
   */
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
