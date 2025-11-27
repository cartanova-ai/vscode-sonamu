import * as vscode from 'vscode';

// 확장이 활성화될 때 호출됩니다
export function activate(context: vscode.ExtensionContext) {
  console.log('Sonamu extension is now active!');

  // 명령어 등록
  const disposable = vscode.commands.registerCommand('sonamu.helloWorld', () => {
    vscode.window.showInformationMessage('Hello from Sonamu!');
  });

  context.subscriptions.push(disposable);
}

// 확장이 비활성화될 때 호출됩니다
export function deactivate() {}
