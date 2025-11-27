import * as vscode from 'vscode';
import { NaiteTracker } from './naite-tracker';
import { NaiteCompletionProvider } from './naite-completion-provider';
import { NaiteDefinitionProvider } from './naite-definition-provider';
import { NaiteReferenceProvider } from './naite-reference-provider';
import { NaiteHoverProvider } from './naite-hover-provider';
import { NaiteCodeLensProvider, showNaiteLocations } from './naite-codelens-provider';
import { NaiteDiagnosticProvider } from './naite-diagnostic-provider';
import { updateDecorations } from './naite-decorator';

let tracker: NaiteTracker;
let diagnosticProvider: NaiteDiagnosticProvider;

export async function activate(context: vscode.ExtensionContext) {
  tracker = new NaiteTracker();
  diagnosticProvider = new NaiteDiagnosticProvider(tracker);

  // 워크스페이스 스캔
  await tracker.scanWorkspace();

  // 초기 진단 실행
  diagnosticProvider.updateAllDiagnostics();

  // 파일 저장 시 재스캔 + 진단 업데이트
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.languageId === 'typescript') {
        await tracker.scanFile(doc.uri);
        diagnosticProvider.updateAllDiagnostics();
      }
    })
  );

  context.subscriptions.push(diagnosticProvider);

  // 데코레이션: 에디터 변경 시 업데이트
  const triggerUpdate = (editor?: vscode.TextEditor) => {
    if (editor) updateDecorations(editor, tracker);
  };

  if (vscode.window.activeTextEditor) {
    triggerUpdate(vscode.window.activeTextEditor);
  }

  // 문서 변경 시 debounce된 스캔 + 진단
  const scanDebounceMap = new Map<string, NodeJS.Timeout>();
  const debouncedScan = (doc: vscode.TextDocument) => {
    const key = doc.uri.toString();
    const existing = scanDebounceMap.get(key);
    if (existing) clearTimeout(existing);
    scanDebounceMap.set(key, setTimeout(async () => {
      await tracker.scanFile(doc.uri);
      diagnosticProvider.updateDiagnostics(doc);
      scanDebounceMap.delete(key);
    }, 500));
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      triggerUpdate(editor);
      if (editor && editor.document.languageId === 'typescript') {
        diagnosticProvider.updateDiagnostics(editor.document);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && e.document === editor.document) {
        triggerUpdate(editor);
        // TypeScript 파일이면 debounce된 스캔 트리거
        if (e.document.languageId === 'typescript') {
          debouncedScan(e.document);
        }
      }
    })
  );

  // Provider 등록
  const selector = { language: 'typescript', scheme: 'file' };

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(selector, new NaiteCompletionProvider(tracker), '"', "'"),
    vscode.languages.registerDefinitionProvider(selector, new NaiteDefinitionProvider(tracker)),
    vscode.languages.registerReferenceProvider(selector, new NaiteReferenceProvider(tracker)),
    vscode.languages.registerHoverProvider(selector, new NaiteHoverProvider(tracker)),
    vscode.languages.registerCodeLensProvider(selector, new NaiteCodeLensProvider(tracker))
  );

  // 명령어
  context.subscriptions.push(
    vscode.commands.registerCommand('sonamu.showNaiteLocations', showNaiteLocations),
    vscode.commands.registerCommand('sonamu.showNaiteLocationsByKey', (key: string) => {
      const setLocs = tracker.getKeyLocations(key, 'set');
      const getLocs = tracker.getKeyLocations(key, 'get');
      showNaiteLocations(key, setLocs, getLocs);
    }),
    vscode.commands.registerCommand('sonamu.rescanNaite', async () => {
      await tracker.scanWorkspace();
      vscode.window.showInformationMessage(`Found ${tracker.getAllKeys().length} Naite keys`);
    }),
    vscode.commands.registerCommand('sonamu.helloWorld', () => {
      vscode.window.showInformationMessage(`Sonamu: ${tracker.getAllKeys().length} keys`);
    })
  );
}

export function deactivate() {}
