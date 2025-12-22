import vscode from "vscode";

/**
 * 상태창 메시지를 관리하는 유틸리티 클래스
 */
class StatusBarManager {
  private enabled: boolean = true;

  /**
   * 상태창 메시지 표시 여부를 설정합니다
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 상태창에 메시지를 표시합니다 (설정이 활성화된 경우에만)
   */
  show(message: string, options?: { timeout?: number; done?: boolean }): vscode.Disposable {
    if (this.enabled) {
      const icon = options?.done ? "$(check)" : "$(sync~spin)";
      const fullMessage = `${icon} ${message}`;
      if (options?.timeout !== undefined) {
        return vscode.window.setStatusBarMessage(fullMessage, options.timeout);
      } else {
        return vscode.window.setStatusBarMessage(fullMessage);
      }
    }
    return vscode.Disposable.from();
  }
}

export const StatusBar = new StatusBarManager();
