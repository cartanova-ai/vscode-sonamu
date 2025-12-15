import vscode from "vscode";
import { NaiteCompletionProvider } from "./naite/features/key-completion/completion-provider";
import {
  disposeDecorations,
  updateDecorations,
} from "./naite/features/key-highlighting/key-decorator";
import { NaiteHoverProvider } from "./naite/features/key-hover-info-box/hover-provider";
import { NaiteDefinitionProvider } from "./naite/features/key-navigation/definition-provider";
import { NaiteReferenceProvider } from "./naite/features/key-navigation/reference-provider";
import {
  NaiteDocumentSymbolProvider,
  NaiteWorkspaceSymbolProvider,
} from "./naite/features/key-symbol-search/symbol-provider";
import { NaiteDiagnosticProvider } from "./naite/features/key-undefined-warning/diagnostic-provider";
import { NaiteTracePanelProvider } from "./naite/features/trace-viewer-panel/trace-panel-provider";
import { NaiteTraceTabProvider } from "./naite/features/trace-viewer-tab/trace-tab-provider";
import {
  disposeRuntimeDecorations,
  setupRuntimeDecorationListeners,
  syncTraceLineNumbersWithDocument,
  updateRuntimeDecorations,
} from "./naite/features/value-inline-display/value-decorator";
import { NaiteSocketServer } from "./naite/lib/messaging/naite-socket-server";
import { TraceStore } from "./naite/lib/messaging/trace-store";
import NaiteTracker from "./naite/lib/tracking/tracker";

let tracker: NaiteTracker;
let diagnosticProvider: NaiteDiagnosticProvider;

export async function activate(context: vscode.ExtensionContext) {
  // 소나무 프로젝트에서만 UI 표시
  vscode.commands.executeCommand("setContext", "sonamu:isActive", true);

  // 하단 패널 WebviewView 등록 (상태 유지됨)
  const tracePanelProvider = new NaiteTracePanelProvider();
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      NaiteTracePanelProvider.viewType,
      tracePanelProvider,
      {
        webviewOptions: { retainContextWhenHidden: true },
      },
    ),
  );

  // Trace Viewer (에디터 탭)
  const traceTabProvider = new NaiteTraceTabProvider(context);

  // 위치로 이동하는 명령어
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "naiteTrace.goToLocation",
      async (filePath: string, lineNumber: number) => {
        const uri = vscode.Uri.file(filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
        const line = lineNumber - 1;
        const position = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter,
        );
      },
    ),
  );

  tracker = new NaiteTracker();
  diagnosticProvider = new NaiteDiagnosticProvider(tracker);

  // 상태창 메시지 표시 설정 적용
  const updateStatusBarMessagesEnabled = () => {
    const config = vscode.workspace.getConfiguration("sonamu.statusBarMessages");
    tracker.setStatusBarMessagesEnabled(config.get<boolean>("enabled", true));
  };
  updateStatusBarMessagesEnabled();

  // 설정 변경 시 업데이트
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("sonamu.statusBarMessages.enabled")) {
        updateStatusBarMessagesEnabled();
      }
    }),
  );

  // 워크스페이스 스캔
  await tracker.scanWorkspace();

  // 초기 진단 실행
  diagnosticProvider.updateAllDiagnostics();

  context.subscriptions.push(diagnosticProvider);

  // Naite Socket 서버 시작 (Sonamu에서 trace 메시지 수신)
  const socketPath = await NaiteSocketServer.start();
  console.log(`[Sonamu] Naite Socket server started at ${socketPath}`);

  // Runtime decoration 리스너 등록
  setupRuntimeDecorationListeners(context);

  // 트레이스 수신 시 자동으로 Trace Viewer Tab 열기
  context.subscriptions.push(
    TraceStore.onTestResultChange((testResults) => {
      // 트레이스가 있을 때만 탭 열기
      if (testResults.length > 0) {
        traceTabProvider.show();
      }
    }),
  );

  // 상태바에 소켓 상태 표시
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = `$(plug) Naite`;
  statusBarItem.tooltip = `Naite Socket: ${socketPath}\nClick to open Trace Viewer`;
  statusBarItem.command = "sonamu.openTraceViewerTab";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // 데코레이터 업데이트 함수 (일관된 진입점)
  const updateDecorationsForEditor = (editor?: vscode.TextEditor) => {
    if (!editor || editor.document.languageId !== "typescript") return;
    updateDecorations(editor, tracker);
    updateRuntimeDecorations(editor);
  };

  // 특정 문서의 모든 에디터에 대해 데코레이터 업데이트
  const updateDecorationsForDocument = (doc: vscode.TextDocument) => {
    if (doc.languageId !== "typescript") return;
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document === doc) {
        updateDecorationsForEditor(editor);
      }
    }
  };

  // 스캔 후 데코레이터 업데이트를 포함한 완전한 파일 처리
  const scanAndUpdate = async (doc: vscode.TextDocument) => {
    if (doc.languageId !== "typescript") return;
    await tracker.scanFile(doc.uri);
    diagnosticProvider.updateDiagnostics(doc);
    updateDecorationsForDocument(doc);
  };

  // 런타임 데코레이터 업데이트 (trace 동기화 포함)
  const updateRuntimeDecorationsForDocument = async (doc: vscode.TextDocument) => {
    if (doc.languageId !== "typescript") return;
    await syncTraceLineNumbersWithDocument(doc);
    updateDecorationsForDocument(doc);
  };

  // 문서 변경 시 debounce된 스캔 및 런타임 데코레이터 업데이트
  const scanDebounceMap = new Map<string, NodeJS.Timeout>();
  const debouncedScanAndUpdate = (doc: vscode.TextDocument) => {
    const key = doc.uri.toString();
    const existing = scanDebounceMap.get(key);
    if (existing) clearTimeout(existing);
    scanDebounceMap.set(
      key,
      setTimeout(async () => {
        await scanAndUpdate(doc);
        await updateRuntimeDecorationsForDocument(doc);
        scanDebounceMap.delete(key);
      }, 200),
    );
  };

  // 이벤트 핸들러 등록
  context.subscriptions.push(
    // 에디터 변경 시 데코레이터 업데이트
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      updateDecorationsForEditor(editor);
      if (editor && editor.document.languageId === "typescript") {
        diagnosticProvider.updateDiagnostics(editor.document);
      }
    }),

    // 문서 변경 시: 즉시 데코레이터 업데이트 + debounced 스캔 및 런타임 데코레이터 업데이트
    vscode.workspace.onDidChangeTextDocument((e) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && e.document === editor.document) {
        // 즉시 데코레이터 업데이트
        updateDecorationsForEditor(editor);
        // 스캔 및 런타임 데코레이터는 debounce (완료 후 자동 업데이트)
        if (e.document.languageId === "typescript") {
          debouncedScanAndUpdate(e.document);
        }
      }
    }),

    // 파일 저장 시: 즉시 스캔 + trace 라인 번호 동기화 + 데코레이터 업데이트
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      await scanAndUpdate(doc);
      await updateRuntimeDecorationsForDocument(doc);
    }),

    // 설정 변경 시 데코레이터 업데이트
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("sonamu")) {
        updateDecorationsForEditor(vscode.window.activeTextEditor);
      }
    }),

    // 에디터 선택 변경 시: Naite 호출 또는 test case 라인 클릭 감지
    vscode.window.onDidChangeTextEditorSelection((e) => {
      // Trace Viewer Tab이 열려있지 않으면 무시
      if (!traceTabProvider.isVisible()) return;

      const editor = e.textEditor;
      if (!editor || editor.document.languageId !== "typescript") return;

      // 선택이 아닌 커서 이동만 처리 (클릭)
      if (e.kind !== vscode.TextEditorSelectionChangeKind.Mouse) return;
      if (e.selections.length !== 1 || !e.selections[0].isEmpty) return;

      const line = e.selections[0].active.line;
      const filePath = editor.document.uri.fsPath;

      // 1. Naite 호출 라인인지 확인
      const naiteEntries = tracker.getEntriesForFile(editor.document.uri);
      const naiteEntry = naiteEntries.find(
        (entry) => entry.location.range.start.line === line,
      );
      if (naiteEntry) {
        traceTabProvider.focusKey(naiteEntry.key);
        return;
      }

      // 2. Test case 라인인지 확인
      const testResults = TraceStore.getAllTestResults();
      const testResult = testResults.find(
        (result) => result.testFilePath === filePath && result.testLine - 1 === line,
      );
      if (testResult) {
        traceTabProvider.focusTest(testResult.suiteName, testResult.testName);
      }
    }),
  );

  // 초기 데코레이터 업데이트
  if (vscode.window.activeTextEditor) {
    updateDecorationsForEditor(vscode.window.activeTextEditor);
  }

  // Provider 등록
  const selector = { language: "typescript", scheme: "file" };

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector,
      new NaiteCompletionProvider(tracker),
      '"',
      "'",
    ),
    vscode.languages.registerDefinitionProvider(selector, new NaiteDefinitionProvider(tracker)),
    vscode.languages.registerReferenceProvider(selector, new NaiteReferenceProvider(tracker)),
    vscode.languages.registerHoverProvider(selector, new NaiteHoverProvider(tracker)),
    vscode.languages.registerDocumentSymbolProvider(
      selector,
      new NaiteDocumentSymbolProvider(tracker),
    ),
    vscode.languages.registerWorkspaceSymbolProvider(new NaiteWorkspaceSymbolProvider(tracker)),
  );

  // 명령어
  context.subscriptions.push(
    vscode.commands.registerCommand("sonamu.rescanNaite", async () => {
      await tracker.scanWorkspace();
      vscode.window.showInformationMessage(`Found ${tracker.getAllKeys().length} Naite keys`);
    }),
    vscode.commands.registerCommand("sonamu.helloWorld", () => {
      vscode.window.showInformationMessage(`Sonamu: ${tracker.getAllKeys().length} keys`);
    }),
    vscode.commands.registerCommand(
      "sonamu.openTraceInEditor",
      async (args: { filePath: string; lineNumber: number }) => {
        const traces = TraceStore.getTracesForLine(args.filePath, args.lineNumber);
        if (traces.length === 0) {
          vscode.window.showWarningMessage("No trace data available");
          return;
        }

        // Trace Viewer 열고 해당 trace 하이라이트
        traceTabProvider.show();
        traceTabProvider.highlightTrace(args.filePath, args.lineNumber, traces[0].key);
      },
    ),
    vscode.commands.registerCommand("sonamu.openTraceViewerTab", () => {
      traceTabProvider.show();
    }),
  );
}

export async function deactivate() {
  disposeDecorations();
  disposeRuntimeDecorations();
  await NaiteSocketServer.stop();
}
