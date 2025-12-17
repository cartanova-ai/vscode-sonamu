import vscode from "vscode";
import {
  disposeInlineValueDecorations,
  updateInlineValueDecorations,
} from "./naite/features/inline-value-display/value-decorator";
import { NaiteCompletionProvider } from "./naite/features/key-completion/completion-provider";
import {
  disposeKeyDecorations,
  updateKeyDecorations,
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
import NaiteExpressionScanner from "./naite/lib/code-parsing/expression-scanner";
import { NaiteSocketServer } from "./naite/lib/messaging/naite-socket-server";
import { TraceStore } from "./naite/lib/messaging/trace-store";
import { NaiteTracker } from "./naite/lib/tracking/tracker";
import { goToKeyLocations } from "./naite/lib/utils/editor-navigation";

// ============================================================================
// 익스텐션의 엔트리 포인트! IDE가 실행해주는건 아래 두개밖에 없어요.
// ============================================================================

/**
 * Extension의 시작점입니다.
 * package.json의 activationEvents에 명시된 이벤트가 발생하면 activate이 실행됩니다.
 *
 * @param context
 * @returns
 */
export async function activate(context: vscode.ExtensionContext) {
  vscode.commands.executeCommand("setContext", "sonamu:isActive", true);

  await NaiteTracker.scanWorkspace();

  const { traceTabProvider } = registerTraceViewers(context);
  const diagnosticProvider = registerDiagnosticProvider(context);
  diagnosticProvider.updateAllDiagnostics();

  registerConfigListeners(context, diagnosticProvider);
  registerDocumentEventHandlers(context, traceTabProvider, diagnosticProvider);
  registerLanguageProviders(context);
  registerCommands(context, traceTabProvider);

  context.subscriptions.push(
    TraceStore.onTestResultAdded(() => {
      // 테스트 결과가 도착하면 Trace Viewer Tab을 보여줍니다.
      traceTabProvider.show();

      for (const editor of vscode.window.visibleTextEditors) {
        // 유일하게 영향 받는 inline value decoration만 업데이트합니다.
        updateInlineValueDecorations(editor);
      }
    }),
  );

  const socketPaths = await startSocketServers();

  console.log(`[Sonamu] Naite Socket servers started: ${socketPaths.length}개`);
}

/**
 * Extension의 종료점입니다.
 * 익스텐션 비활성화, VSCode 종료, 또는 창(workspace) 닫기 시 호출됩니다.
 */
export async function deactivate() {
  disposeKeyDecorations();
  disposeInlineValueDecorations();
  await NaiteSocketServer.stop();
}

// ============================================================================
// Socket Server
// ============================================================================

/**
 * Sonamu에서 보내는 테스트 정보를 받기 위한 socket 서버를 시작합니다.
 * 각각의 프로젝트는 고유한 socket 서버를 가집니다.
 * 만약 워크스페이스에 sonamu.config.ts가 여러 개 있다면 여러 개의 socket 서버를 시작합니다.
 *
 * @returns 시작된 서버들의 unix domain socket 경로들의 배열
 */
async function startSocketServers(): Promise<string[]> {
  const configFiles = await vscode.workspace.findFiles("**/sonamu.config.ts", "**/node_modules/**");

  if (configFiles.length === 0) {
    throw new Error(
      "sonamu.config.ts를 찾을 수 없습니다. Naite 소켓 서버를 시작할 수 없습니다. 그치만 sonamu.config.ts가 없으면 extension 자체가 activate되지 않아야 함이 타당합니다. 어딘가에서 변경이 일어난 것으로 추정됩니다.",
    );
  }

  const configPaths = configFiles.map((f) => f.fsPath);
  return NaiteSocketServer.startAll(configPaths);
}

// ============================================================================
// register 시리즈! 아래 친구들로 인해 extension의 기능들이 실제로 작동하게 됩니다.
// ============================================================================

/**
 * Diagnostic Provider를 등록합니다.
 *
 * @param context
 * @returns NaiteDiagnosticProvider 인스턴스
 */
function registerDiagnosticProvider(context: vscode.ExtensionContext): NaiteDiagnosticProvider {
  const provider = new NaiteDiagnosticProvider();
  context.subscriptions.push(provider);
  return provider;
}

/**
 * Naite Trace Viewer(panel, tab)를 등록합니다.
 *
 * @param context
 * @returns 각 provider 인스턴스
 */
function registerTraceViewers(context: vscode.ExtensionContext): {
  tracePanelProvider: NaiteTracePanelProvider;
  traceTabProvider: NaiteTraceTabProvider;
} {
  // 하단 패널 WebviewView
  const tracePanelProvider = new NaiteTracePanelProvider();
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      NaiteTracePanelProvider.viewType,
      tracePanelProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  // 에디터 탭 WebviewPanel
  const traceTabProvider = new NaiteTraceTabProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer("naiteTraceViewer", {
      async deserializeWebviewPanel(panel: vscode.WebviewPanel, _state: unknown) {
        traceTabProvider.restorePanel(panel);
      },
    }),
  );

  return { tracePanelProvider, traceTabProvider };
}

/**
 * 설정이 변경되었을 때 이를 감지해서 적절한 일을 하는 리스너를 등록합니다.
 *
 * @param context
 */
function registerConfigListeners(
  context: vscode.ExtensionContext,
  diagnosticProvider: NaiteDiagnosticProvider,
) {
  const updateStatusBarMessagesEnabled = () => {
    const config = vscode.workspace.getConfiguration("sonamu.naite.statusBarMessages");
    NaiteTracker.setStatusBarMessagesEnabled(config.get<boolean>("enabled", true));
  };
  updateStatusBarMessagesEnabled();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("sonamu.naite.statusBarMessages.enabled")) {
        updateStatusBarMessagesEnabled();
      }
      if (e.affectsConfiguration("sonamu")) {
        if (vscode.window.activeTextEditor) {
          debouncedScanAndUpdate(vscode.window.activeTextEditor?.document, diagnosticProvider);
        }
      }
    }),
  );
}

/**
 * 문서 관련 이벤트(열기, 수정, 저장 등)가 발생하였을 때 적절한 일을 하는 리스너를 등록합니다.
 *
 * @param context
 * @param traceTabProvider Naite Trace Viewer Tab 인스턴스입니다.
 *                         왜 필요한가? 문서에서 Naite 호출문을 클릭(선택)하면 Naite Trace Viewer Tab 내에서
 *                         해당하는 key의 trace를 포커스하는 기능을 구현하기 위해서입니다.
 *                         이 기능은 provider 인스턴스를 통해 구현됩니다.
 */
function registerDocumentEventHandlers(
  context: vscode.ExtensionContext,
  traceTabProvider: NaiteTraceTabProvider,
  diagnosticProvider: NaiteDiagnosticProvider,
) {
  context.subscriptions.push(
    // 에디터 변경 시
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        debouncedScanAndUpdate(editor.document, diagnosticProvider);
      }
    }),

    // 문서 열기 시
    vscode.workspace.onDidOpenTextDocument((doc) => {
      debouncedScanAndUpdate(doc, diagnosticProvider);
    }),

    // 문서 변경 시
    vscode.workspace.onDidChangeTextDocument((e) => {
      debouncedScanAndUpdate(e.document, diagnosticProvider);
    }),

    // 파일 저장 시
    vscode.workspace.onDidSaveTextDocument((doc) => {
      debouncedScanAndUpdate(doc, diagnosticProvider);
    }),

    // 에디터 선택 변경 시 (Trace Viewer 연동)
    vscode.window.onDidChangeTextEditorSelection((e) => {
      focusSelectionOnTraceTab(e, traceTabProvider);
    }),
  );
}

/**
 * 자동완성, 정의/참조로 이동, 호버링, 심볼 검색 등 언어 기능을 위한 provider들을 등록합니다.
 *
 * @param context
 */
function registerLanguageProviders(context: vscode.ExtensionContext) {
  const selector = { language: "typescript", scheme: "file" };

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector,
      new NaiteCompletionProvider(),
      '"',
      "'",
    ),
    vscode.languages.registerDefinitionProvider(selector, new NaiteDefinitionProvider()),
    vscode.languages.registerReferenceProvider(selector, new NaiteReferenceProvider()),
    vscode.languages.registerHoverProvider(selector, new NaiteHoverProvider()),
    vscode.languages.registerDocumentSymbolProvider(selector, new NaiteDocumentSymbolProvider()),
    vscode.languages.registerWorkspaceSymbolProvider(new NaiteWorkspaceSymbolProvider()),
  );
}

/**
 * 명령들을 등록합니다.
 * 등록되는 명령 중에는 package.json에 명시된 공개된 명령들도 있고, 내부에서만 사용하는 명령들도 있습니다.
 *
 * @param context
 * @param traceTabProvider
 */
function registerCommands(
  context: vscode.ExtensionContext,
  traceTabProvider: NaiteTraceTabProvider,
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("sonamu.rescanNaiteKeys", async () => {
      await NaiteTracker.scanWorkspace();
      vscode.window.showInformationMessage(`Found ${NaiteTracker.getAllKeys().length} Naite keys`);
    }),

    vscode.commands.registerCommand("sonamu.helloWorld", () => {
      vscode.window.showInformationMessage(`Sonamu: ${NaiteTracker.getAllKeys().length} keys`);
    }),

    vscode.commands.registerCommand("sonamu.openTraceViewer", () => {
      traceTabProvider.show();
    }),

    vscode.commands.registerCommand("sonamu.naite.key.goToDefinition", async (key: string) => {
      await goToKeyLocations(key, "set", "정의");
    }),

    vscode.commands.registerCommand("sonamu.naite.key.goToReferences", async (key: string) => {
      await goToKeyLocations(key, "get", "참조");
    }),
  );
}

// ============================================================================
// 기타 루틴들!
// 주로 glue 코드들입니다.
// ============================================================================

const scanDebounceMap = new Map<string, NodeJS.Timeout>();

/**
 * 적절한 debounce를 적용하여 {@link scanAndUpdate}를 호출합니다.
 * @param doc
 * @param diagnosticProvider
 */
function debouncedScanAndUpdate(
  doc: vscode.TextDocument,
  diagnosticProvider: NaiteDiagnosticProvider,
) {
  const key = doc.uri.toString();
  const existing = scanDebounceMap.get(key);
  if (existing) {
    clearTimeout(existing);
  }
  scanDebounceMap.set(
    key,
    setTimeout(async () => {
      await scanAndUpdate(doc, diagnosticProvider);
      scanDebounceMap.delete(key);
    }, 200),
  );
}

/**
 * 문서의 변경에 대응하여 모든 것을 업데이트하고 새로 표시합니다.
 * 코드 옆에 따라다녀야 하는 것들이 제 위치에 제대로 표시되도록 합니다.
 * @param doc
 * @param diagnosticProvider
 * @returns
 */
async function scanAndUpdate(
  doc: vscode.TextDocument,
  diagnosticProvider: NaiteDiagnosticProvider,
) {
  if (doc.languageId !== "typescript") {
    return;
  }

  // 일단 변경된 파일을 스캔하여 모든 Naite 호출을 찾아줍니다.
  await NaiteTracker.scanFile(doc.uri);

  // 변경된 doc에 맞추어 trace 라인 번호를 업데이트합니다.
  await syncTraceLineNumbersWithDocument(doc);

  // 이제 tracker가 최신입니다.
  // 이를 기반으로 미사용 키 경고(diagnostic)를 업데이트합니다.
  diagnosticProvider.updateDiagnostics(doc);

  // decoration들도 업데이트합니다.
  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document === doc) {
      updateKeyDecorations(editor);
      updateInlineValueDecorations(editor);
    }
  }
}

/**
 * 기존 trace에 기록된 라인 번호를 변경된 doc에 맞추어 업데이트합니다.
 *
 * 테스트를 실행한 다음에 코드 파일을 변경하는 경우를 상정해보겠습니다.
 * 코드 변경으로 Naite.t 호출의 줄 번호가 바뀌더라도 테스트의 결과인 trace 속 Naite.t 호출의 줄 번호가 자동으로 바뀌지는 않습니다.
 * 이를 해결하기 위해 현재 document 기준으로 Naite.t를 스캔하여 (key, lineNumber) 배열을 만든 뒤,
 * TraceStore의 trace들이 가진 라인 번호를 가장 가까운 위치로 갱신합니다.
 *
 * 동일한 key가 여러 줄에 존재하더라도, 각 trace는 원래 라인 번호와 가장 가까운 위치로 매칭됩니다.
 *
 * @param doc
 */
async function syncTraceLineNumbersWithDocument(doc: vscode.TextDocument): Promise<void> {
  if (doc.languageId !== "typescript") {
    return;
  }

  const filePath = doc.uri.fsPath;
  const currentTraces = TraceStore.getAllTraces();
  const fileTraces = currentTraces.filter((t) => t.filePath === filePath);

  if (fileTraces.length === 0) {
    return;
  }

  // 현재 문서에서 Naite.t 호출 위치 스캔
  const scanner = new NaiteExpressionScanner(doc);
  const naiteCalls = Array.from(scanner.scanNaiteCalls(["Naite.t"]));

  // (key, lineNumber) 배열 생성
  const keyLineEntries = naiteCalls.map((call) => ({
    key: call.key,
    lineNumber: call.location.range.start.line + 1, // 1-based
  }));

  // trace 라인 번호 업데이트
  TraceStore.updateTraceLineNumbers(filePath, keyLineEntries);
}

/**
 * 에디터에서 선택된 부분에 해당하는 엔트리를 Trace Viewer Tab에서 포커스합니다.
 *
 * 코드에서 Naite 호출문이나 테스트 케이스를 선택하면 그걸 Trace Viewer Tab에서 보여주는 기능을 구현합니다.
 *
 * @param e
 * @param traceTabProvider
 * @returns
 */
function focusSelectionOnTraceTab(
  e: vscode.TextEditorSelectionChangeEvent,
  traceTabProvider: NaiteTraceTabProvider,
) {
  if (!traceTabProvider.isVisible() || !traceTabProvider.isFollowEnabled()) {
    return;
  }

  const editor = e.textEditor;
  if (!editor || editor.document.languageId !== "typescript") {
    return;
  }
  if (e.kind !== vscode.TextEditorSelectionChangeKind.Mouse) {
    return;
  }
  if (e.selections.length !== 1 || !e.selections[0].isEmpty) {
    return;
  }

  const line = e.selections[0].active.line;
  const filePath = editor.document.uri.fsPath;

  // Naite 호출 라인인지 확인
  const naiteEntries = NaiteTracker.getEntriesForFile(editor.document.uri);
  const naiteEntry = naiteEntries.find((entry) => entry.location.range.start.line === line);
  if (naiteEntry) {
    traceTabProvider.focusKey(naiteEntry.key);
    return;
  }

  // Test case 라인인지 확인
  const testResults = TraceStore.getAllTestResults();
  const testResult = testResults.find(
    (result) => result.testFilePath === filePath && result.testLine - 1 === line,
  );
  if (testResult) {
    traceTabProvider.focusTest(testResult.suiteName, testResult.testName);
  }
}
