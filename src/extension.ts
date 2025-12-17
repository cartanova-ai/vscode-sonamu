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

let diagnosticProvider: NaiteDiagnosticProvider;

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

  diagnosticProvider = new NaiteDiagnosticProvider();
  await NaiteTracker.scanWorkspace();
  diagnosticProvider.updateAllDiagnostics();
  context.subscriptions.push(diagnosticProvider);

  const socketPaths = await startSocketServers();
  if (!socketPaths) {
    return;
  }

  const { traceTabProvider } = registerTraceViewers(context);

  registerConfigListeners(context);
  registerDocumentEventHandlers(context, traceTabProvider);
  registerLanguageProviders(context);
  registerCommands(context, traceTabProvider);

  context.subscriptions.push(
    TraceStore.onTestResultChange(() => {
      // 새로운 test result가 들어올 때 모든 에디터의 데코레이터 업데이트
      for (const editor of vscode.window.visibleTextEditors) {
        updateInlineValueDecorations(editor);
      }
    }),
  );

  context.subscriptions.push(
    TraceStore.onTestResultChange((testResults) => {
      if (testResults.length > 0) {
        traceTabProvider.show();
      }
    }),
  );

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
async function startSocketServers(): Promise<string[] | null> {
  const configFiles = await vscode.workspace.findFiles("**/sonamu.config.ts", "**/node_modules/**");

  if (configFiles.length === 0) {
    vscode.window.showWarningMessage(
      "sonamu.config.ts를 찾을 수 없습니다. Naite 소켓 서버를 시작할 수 없습니다.",
    );
    return null;
  }

  const configPaths = configFiles.map((f) => f.fsPath);
  return NaiteSocketServer.startAll(configPaths);
}

// ============================================================================
// register 시리즈! 아래 친구들로 인해 extension의 기능들이 실제로 작동하게 됩니다.
// ============================================================================

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
function registerConfigListeners(context: vscode.ExtensionContext) {
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
        updateDecorationsForEditor(vscode.window.activeTextEditor);
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
) {
  context.subscriptions.push(
    // 에디터 변경 시
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        debouncedScanAndUpdate(editor.document);
      }
    }),

    // 문서 열기 시
    vscode.workspace.onDidOpenTextDocument((doc) => {
      debouncedScanAndUpdate(doc);
    }),

    // 문서 변경 시
    vscode.workspace.onDidChangeTextDocument((e) => {
      debouncedScanAndUpdate(e.document);
    }),

    // 파일 저장 시
    vscode.workspace.onDidSaveTextDocument((doc) => {
      debouncedScanAndUpdate(doc);
    }),

    // 에디터 선택 변경 시 (Trace Viewer 연동)
    vscode.window.onDidChangeTextEditorSelection((e) => {
      if (!traceTabProvider.isVisible() || !traceTabProvider.isFollowEnabled()) return;

      const editor = e.textEditor;
      if (!editor || editor.document.languageId !== "typescript") return;
      if (e.kind !== vscode.TextEditorSelectionChangeKind.Mouse) return;
      if (e.selections.length !== 1 || !e.selections[0].isEmpty) return;

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
    vscode.languages.registerDocumentSymbolProvider(
      selector,
      new NaiteDocumentSymbolProvider(),
    ),
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
// 기타 등등!
// ============================================================================

/**
 * 주어진 에디터에서 보여지는 다음 decoration들을 업데이트합니다.
 * - Naite 호출문에서 첫 번째 인자인 key를 강조하는 decoration
 * - Naite 호출에 실제로 들어간 값을 우측에 인라인으로 표시하는 decoration
 *
 * @param editor
 * @returns
 */
function updateDecorationsForEditor(editor?: vscode.TextEditor) {
  if (!editor || editor.document.languageId !== "typescript") {
    return;
  }
  updateKeyDecorations(editor);
  updateInlineValueDecorations(editor);
}

/**
 * 주어진 문서를 띄우고 있는 모든 에디터에 대해 {@link updateDecorationsForEditor}를 호출합니다.
 *
 * @param doc
 * @returns
 */
function updateDecorationsForDocument(doc: vscode.TextDocument) {
  if (doc.languageId !== "typescript") {
    return;
  }
  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document === doc) {
      updateDecorationsForEditor(editor);
    }
  }
}

/**
 * 문서의 변경에 대응하여 모든 것을 업데이트하고 새로 표시합니다.
 * 코드 옆에 따라다녀야 하는 것들이 제 위치에 제대로 표시되도록 합니다.
 * @param doc
 * @returns
 */
async function scanAndUpdate(doc: vscode.TextDocument) {
  if (doc.languageId !== "typescript") {
    return;
  }

  // 일단 변경된 파일을 스캔하여 모든 Naite 호출을 찾아줍니다.
  await NaiteTracker.scanFile(doc.uri);

  // 이제 tracker가 최신입니다.
  // 이를 기반으로 미사용 키 경고(diagnostic), 키 하이라이팅, 인라인 값 표시를 업데이트합니다.
  diagnosticProvider.updateDiagnostics(doc);
  updateDecorationsForDocument(doc);
  await syncTraceLineNumbersWithDocument(doc);
}

async function goToKeyLocations(key: string, type: "set" | "get", label: string) {
  const locs = NaiteTracker.getKeyLocations(key, type);

  if (locs.length === 0) {
    vscode.window.showInformationMessage(`"${key}" ${label}를 찾을 수 없습니다.`);
    return;
  }

  if (locs.length === 1) {
    await revealLocation(locs[0]);
    return;
  }

  // 여러 개일 때 QuickPick으로 선택
  const icon = type === "set" ? "symbol-method" : "references";
  const items = locs.map((loc) => ({
    label: `$(${icon}) ${vscode.workspace.asRelativePath(loc.uri)}:${loc.range.start.line + 1}`,
    location: loc,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `"${key}" ${label} 선택`,
  });

  if (selected) {
    await revealLocation(selected.location);
  }
}

async function revealLocation(loc: vscode.Location) {
  const doc = await vscode.workspace.openTextDocument(loc.uri);
  const editor = await vscode.window.showTextDocument(doc);
  editor.selection = new vscode.Selection(loc.range.start, loc.range.start);
  editor.revealRange(loc.range, vscode.TextEditorRevealType.InCenter);
}

async function syncTraceLineNumbersWithDocument(doc: vscode.TextDocument): Promise<void> {
  if (doc.languageId !== "typescript") return;

  const filePath = doc.uri.fsPath;
  const currentTraces = TraceStore.getAllTraces();
  const fileTraces = currentTraces.filter((t) => t.filePath === filePath);

  if (fileTraces.length === 0) return;

  // 현재 문서에서 Naite.t 호출 위치 스캔
  const scanner = new NaiteExpressionScanner(doc);
  const naiteCalls = Array.from(scanner.scanNaiteCalls(["Naite.t"]));

  // key -> 라인 번호 매핑 생성
  const keyToLineMap = new Map<string, number>();
  for (const call of naiteCalls) {
    const lineNumber = call.location.range.start.line + 1; // 1-based
    keyToLineMap.set(call.key, lineNumber);
  }

  // trace 라인 번호 업데이트
  TraceStore.updateTraceLineNumbers(filePath, keyToLineMap);
}

const scanDebounceMap = new Map<string, NodeJS.Timeout>();

function debouncedScanAndUpdate(doc: vscode.TextDocument) {
  const key = doc.uri.toString();
  const existing = scanDebounceMap.get(key);
  if (existing) clearTimeout(existing);
  scanDebounceMap.set(
    key,
    setTimeout(async () => {
      await scanAndUpdate(doc);
      scanDebounceMap.delete(key);
    }, 200),
  );
}
