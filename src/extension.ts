import vscode from "vscode";
import { NaiteSocketServer } from "./naite/messaging/naite-socket-server";
import { TraceStore } from "./naite/messaging/trace-store";
import {
  NaiteCodeLensProvider,
  showNaiteLocations,
} from "./naite/providers/naite-codelens-provider";
import { NaiteCompletionProvider } from "./naite/providers/naite-completion-provider";
import { disposeDecorations, updateDecorations } from "./naite/providers/naite-decorator";
import { NaiteDefinitionProvider } from "./naite/providers/naite-definition-provider";
import { NaiteDiagnosticProvider } from "./naite/providers/naite-diagnostic-provider";
import { NaiteHoverProvider } from "./naite/providers/naite-hover-provider";
import { NaiteReferenceProvider } from "./naite/providers/naite-reference-provider";
import {
  disposeRuntimeDecorations,
  setupRuntimeDecorationListeners,
  syncTraceLineNumbersWithDocument,
  updateRuntimeDecorations,
} from "./naite/providers/naite-runtime-decorator";
import {
  NaiteDocumentSymbolProvider,
  NaiteWorkspaceSymbolProvider,
} from "./naite/providers/naite-symbol-provider";
import { NaiteTracePanelProvider } from "./naite/providers/naite-trace-panel-provider";
import { NaiteTraceViewerProvider } from "./naite/providers/naite-trace-viewer-provider";
import NaiteTracker from "./naite/tracking/tracker";

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

  // Trace Viewer (사이드 패널)
  const traceViewerProvider = new NaiteTraceViewerProvider(context);

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

  // 상태바에 소켓 상태 표시
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = `$(plug) Naite`;
  statusBarItem.tooltip = `Naite Socket: ${socketPath}\nClick to open Trace Viewer`;
  statusBarItem.command = "sonamu.openGlobalTraceViewer";
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
    vscode.languages.registerCodeLensProvider(selector, new NaiteCodeLensProvider(tracker)),
    vscode.languages.registerDocumentSymbolProvider(
      selector,
      new NaiteDocumentSymbolProvider(tracker),
    ),
    vscode.languages.registerWorkspaceSymbolProvider(new NaiteWorkspaceSymbolProvider(tracker)),
  );

  // 명령어
  context.subscriptions.push(
    vscode.commands.registerCommand("sonamu.showNaiteLocations", showNaiteLocations),
    vscode.commands.registerCommand("sonamu.showNaiteLocationsByKey", (key: string) => {
      const setLocs = tracker.getKeyLocations(key, "set");
      const getLocs = tracker.getKeyLocations(key, "get");
      showNaiteLocations(key, setLocs, getLocs);
    }),
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
        traceViewerProvider.show();
        traceViewerProvider.highlightTrace(args.filePath, args.lineNumber, traces[0].key);
      },
    ),
    vscode.commands.registerCommand("sonamu.openGlobalTraceViewer", () => {
      traceViewerProvider.show();
    }),
  );
}

export async function deactivate() {
  disposeDecorations();
  disposeRuntimeDecorations();
  await NaiteSocketServer.stop();
}
