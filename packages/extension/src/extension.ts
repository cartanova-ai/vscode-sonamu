import path from "path";
import vscode from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import {
  disposeInlineValueDecorations,
  updateInlineValueDecorations,
} from "./naite/features/inline-value-display/value-decorator";
import {
  disposeKeyDecorations,
  updateKeyDecorations,
} from "./naite/features/key-highlighting/key-decorator";
import { NaiteTraceViewerProvider } from "./naite/features/trace-viewer/trace-viewer-provider";
import { goToLocation } from "./naite/lib/utils/editor-navigation";
import { StatusBar } from "./naite/lib/utils/status-bar";

let client: LanguageClient;

export async function activate(context: vscode.ExtensionContext) {
  // naite-lsp 서버 경로 (esbuild 번들)
  const serverModule = context.asAbsolutePath(path.join("out", "naite-lsp-server.mjs"));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "json", pattern: "**/*.entity.json" },
    ],
  };

  client = new LanguageClient("naite-lsp", "Naite Language Server", serverOptions, clientOptions);

  const traceViewerProvider = registerTraceViewerProvider(context);
  registerCommands(context, traceViewerProvider);
  registerConfigListeners(context);
  registerDocumentEventHandlers(context, traceViewerProvider);

  // Custom notification 핸들러
  client.onNotification("naite/testResultsUpdated", () => {
    traceViewerProvider.show();

    for (const editor of vscode.window.visibleTextEditors) {
      updateInlineValueDecorations(editor);
    }
  });

  client.onNotification("naite/openViewer", () => {
    traceViewerProvider.show();
  });

  client.onNotification(
    "naite/goToLocation",
    (params: { filePath: string; lineNumber: number }) => {
      goToLocation(params.filePath, params.lineNumber);
    },
  );

  await client.start();
}

export async function deactivate() {
  disposeKeyDecorations();
  disposeInlineValueDecorations();
  if (client) {
    await client.stop();
  }
}

function registerTraceViewerProvider(context: vscode.ExtensionContext): NaiteTraceViewerProvider {
  const traceViewerProvider = new NaiteTraceViewerProvider();
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer("naiteTraceViewer", {
      async deserializeWebviewPanel(panel: vscode.WebviewPanel, _state: unknown) {
        traceViewerProvider.restorePanel(panel);
      },
    }),
  );

  return traceViewerProvider;
}

function registerCommands(
  context: vscode.ExtensionContext,
  traceTabProvider: NaiteTraceViewerProvider,
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("sonamu.rescanNaiteKeys", async () => {
      vscode.window.showInformationMessage("Rescanning Naite keys...");
    }),

    vscode.commands.registerCommand("sonamu.openTraceViewer", () => {
      traceTabProvider.show();
    }),

    vscode.commands.registerCommand("sonamu.naite.key.goToDefinition", async (key: string) => {
      // LSP가 정의 이동을 처리하므로 여기서는 간단한 알림
      vscode.window.showInformationMessage(`"${key}" 정의로 이동`);
    }),

    vscode.commands.registerCommand("sonamu.naite.key.goToReferences", async (key: string) => {
      vscode.window.showInformationMessage(`"${key}" 참조로 이동`);
    }),
  );
}

function registerConfigListeners(context: vscode.ExtensionContext) {
  const updateStatusBarMessagesEnabled = () => {
    const config = vscode.workspace.getConfiguration("sonamu.naite.statusBarMessages");
    StatusBar.setEnabled(config.get<boolean>("enabled", true));
  };
  updateStatusBarMessagesEnabled();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("sonamu.naite.statusBarMessages.enabled")) {
        updateStatusBarMessagesEnabled();
      }
      if (e.affectsConfiguration("sonamu")) {
        for (const editor of vscode.window.visibleTextEditors) {
          updateKeyDecorations(editor);
          updateInlineValueDecorations(editor);
        }
      }
    }),
  );
}

function registerDocumentEventHandlers(
  context: vscode.ExtensionContext,
  traceTabProvider: NaiteTraceViewerProvider,
) {
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        updateKeyDecorations(editor);
        updateInlineValueDecorations(editor);
      }
    }),

    // 에디터 선택 변경 시 (Trace Viewer 연동)
    vscode.window.onDidChangeTextEditorSelection((e) => {
      focusSelectionOnTraceTab(e, traceTabProvider);
    }),
  );
}

function focusSelectionOnTraceTab(
  e: vscode.TextEditorSelectionChangeEvent,
  traceTabProvider: NaiteTraceViewerProvider,
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
  const lineText = editor.document.lineAt(line).text;

  // Naite 호출 라인인지 체크 (간단한 정규식)
  const naiteMatch = lineText.match(/Naite\.(t|get|del)\s*\(\s*["'`]([^"'`]+)["'`]/);
  if (naiteMatch) {
    const key = naiteMatch[2];
    traceTabProvider.focusKey(key);
    client.sendNotification("naite/focusKey", { key });
  }
}
