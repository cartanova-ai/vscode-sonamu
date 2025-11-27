import * as vscode from 'vscode';
import { NaiteTracker } from './naite-tracker';

export class NaiteCodeLensProvider implements vscode.CodeLensProvider {
  constructor(private tracker: NaiteTracker) {}

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (document.languageId !== 'typescript') return [];

    const text = document.getText();
    const pattern = /Naite\.(t|get)\s*\(\s*["'`]([^"'`]+)["'`]/g;
    const lenses: vscode.CodeLens[] = [];
    const seenKeys = new Set<string>();

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const key = match[2];
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const pos = document.positionAt(match.index);
      const range = new vscode.Range(pos, pos);

      const setLocs = this.tracker.getKeyLocations(key, 'set');
      const getLocs = this.tracker.getKeyLocations(key, 'get');

      lenses.push(new vscode.CodeLens(range, {
        title: `정의 ${setLocs.length} | 사용 ${getLocs.length}`,
        command: 'sonamu.showNaiteLocations',
        arguments: [key, setLocs, getLocs]
      }));
    }

    return lenses;
  }
}

export function showNaiteLocations(key: string, setLocs: vscode.Location[], getLocs: vscode.Location[]) {
  const items: vscode.QuickPickItem[] = [];

  if (setLocs.length > 0) {
    items.push({ label: '── 정의 (Naite.t) ──', kind: vscode.QuickPickItemKind.Separator });
    for (const loc of setLocs) {
      items.push({
        label: `$(symbol-method) ${vscode.workspace.asRelativePath(loc.uri)}`,
        description: `Line ${loc.range.start.line + 1}`,
        detail: loc.uri.fsPath,
      });
    }
  }

  if (getLocs.length > 0) {
    items.push({ label: '── 사용 (Naite.get) ──', kind: vscode.QuickPickItemKind.Separator });
    for (const loc of getLocs) {
      items.push({
        label: `$(symbol-variable) ${vscode.workspace.asRelativePath(loc.uri)}`,
        description: `Line ${loc.range.start.line + 1}`,
        detail: loc.uri.fsPath,
      });
    }
  }

  const allLocs = [...setLocs, ...getLocs];

  vscode.window.showQuickPick(items, { placeHolder: `"${key}" 위치 선택` }).then(selected => {
    if (!selected || selected.kind === vscode.QuickPickItemKind.Separator) return;
    const idx = items.filter(i => i.kind !== vscode.QuickPickItemKind.Separator).indexOf(selected);
    if (idx >= 0 && allLocs[idx]) {
      vscode.window.showTextDocument(allLocs[idx].uri, { selection: allLocs[idx].range });
    }
  });
}
