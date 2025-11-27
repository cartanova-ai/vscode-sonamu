import * as vscode from 'vscode';
import { NaiteTracker } from './naite-tracker';

/**
 * Naite.get() 호출에서 자동완성을 제공합니다
 */
export class NaiteCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private tracker: NaiteTracker) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    // Naite.get(" 또는 Naite.t(" 패턴 체크
    if (!linePrefix.match(/Naite\.(get|t)\(["']$/)) {
      return undefined;
    }

    // 모든 Naite 키를 자동완성 항목으로 변환
    const keys = this.tracker.getAllKeys();
    const completionItems = keys.map(key => {
      const setLocs = this.tracker.getKeyLocations(key, 'set');
      const getLocs = this.tracker.getKeyLocations(key, 'get');

      // 정의된 파일명 (첫 번째 set 위치)
      const definedIn = setLocs.length > 0
        ? setLocs[0].uri.path.split('/').pop() || '(정의 없음)'
        : '(정의 없음)';

      const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Constant);
      item.detail = definedIn;

      // 상세 정보
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**정의** (Naite.t): ${setLocs.length}개\n\n`);
      for (const loc of setLocs.slice(0, 3)) {
        md.appendMarkdown(`- ${vscode.workspace.asRelativePath(loc.uri)}:${loc.range.start.line + 1}\n`);
      }
      if (setLocs.length > 3) md.appendMarkdown(`- ... 외 ${setLocs.length - 3}개\n`);

      md.appendMarkdown(`\n**사용** (Naite.get): ${getLocs.length}개\n\n`);
      for (const loc of getLocs.slice(0, 3)) {
        md.appendMarkdown(`- ${vscode.workspace.asRelativePath(loc.uri)}:${loc.range.start.line + 1}\n`);
      }
      if (getLocs.length > 3) md.appendMarkdown(`- ... 외 ${getLocs.length - 3}개\n`);

      item.documentation = md;

      return item;
    });

    return completionItems;
  }
}
