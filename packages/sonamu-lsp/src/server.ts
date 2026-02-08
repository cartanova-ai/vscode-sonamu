import {
  type Connection,
  createConnection,
  type InitializeResult,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import NaiteExpressionScanner from "./core/expression-scanner.js";
import { NaiteSocketServer } from "./core/naite-socket-server.js";
import { TraceStore } from "./core/trace-store.js";
import { NaiteTracker } from "./core/tracker.js";
import { EntityStore } from "./entity/entity-store.js";
import { loadSonamuSchemas } from "./entity/schema-loader.js";
import { handleCompletion } from "./providers/completion.js";
import { handleDefinition } from "./providers/definition.js";
import { computeDiagnostics } from "./providers/diagnostics.js";
import { handleEntityCompletion } from "./providers/entity-completion.js";
import { computeEntityDiagnostics } from "./providers/entity-diagnostics.js";
import { handleEntityHover } from "./providers/entity-hover.js";
import { handleHover } from "./providers/hover.js";
import { handleInlayHints } from "./providers/inlay-hints.js";
import { handleReferences } from "./providers/references.js";
import { handleDocumentSymbol, handleWorkspaceSymbol } from "./providers/symbols.js";
import { findConfigPaths } from "./utils/file-scanner.js";
import { broadcastToViewerClients, startViewerServer } from "./viewer/viewer-server.js";

function isEntityJson(uri: string): boolean {
  return uri.endsWith(".entity.json");
}

const connection: Connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let workspaceRoot = "";

connection.onInitialize((params): InitializeResult => {
  if (params.workspaceFolders && params.workspaceFolders.length > 0) {
    const uri = params.workspaceFolders[0].uri;
    workspaceRoot = uri.startsWith("file://") ? uri.slice(7) : uri;
  } else if (params.rootUri) {
    workspaceRoot = params.rootUri.startsWith("file://") ? params.rootUri.slice(7) : params.rootUri;
  }

  NaiteTracker.setWorkspaceRoot(workspaceRoot);

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        triggerCharacters: ['"', "'", "`"],
      },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
      workspaceSymbolProvider: true,
      inlayHintProvider: true,
    },
  };
});

connection.onInitialized(async () => {
  // 워크스페이스 스캔
  await NaiteTracker.scanWorkspace();

  // sonamu.config.ts 기반 프로젝트 루트 탐색
  const configPaths = await findConfigPaths(workspaceRoot);

  // entity.json 인덱싱 + sonamu 스키마 로드
  EntityStore.setWorkspaceRoot(workspaceRoot);
  await EntityStore.scanWorkspace();
  await loadSonamuSchemas(workspaceRoot, configPaths);

  // 소켓 서버 시작
  await NaiteSocketServer.startAll(configPaths);

  // Viewer HTTP/WebSocket 서버 시작
  startViewerServer();

  // 테스트 결과 수신 시 클라이언트에 알림 + 진단 갱신
  TraceStore.onTestResultAdded(() => {
    connection.sendNotification("naite/testResultsUpdated");
    connection.languages.inlayHint.refresh();
  });

  TraceStore.onTestResultChange(() => {
    connection.languages.inlayHint.refresh();
  });
});

// LSP Provider 핸들러
connection.onCompletion((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (isEntityJson(params.textDocument.uri)) {
    return handleEntityCompletion(params, doc);
  }
  return handleCompletion(params, doc);
});

connection.onHover((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (isEntityJson(params.textDocument.uri)) {
    return handleEntityHover(params, doc);
  }
  return handleHover(params, doc);
});

connection.onDefinition(async (params) => {
  const doc = documents.get(params.textDocument.uri);
  return handleDefinition(params, doc);
});

connection.onReferences(async (params) => {
  const doc = documents.get(params.textDocument.uri);
  return handleReferences(params, doc);
});

connection.onDocumentSymbol((params) => {
  const doc = documents.get(params.textDocument.uri);
  return handleDocumentSymbol(params, doc);
});

connection.onWorkspaceSymbol((params) => {
  return handleWorkspaceSymbol(params);
});

connection.languages.inlayHint.on((params) => {
  const doc = documents.get(params.textDocument.uri);
  return handleInlayHints(params, doc);
});

// 문서 이벤트 핸들러
const scanDebounceMap = new Map<string, ReturnType<typeof setTimeout>>();

function debouncedScanAndUpdate(document: TextDocument): void {
  const key = document.uri;
  const existing = scanDebounceMap.get(key);
  if (existing) {
    clearTimeout(existing);
  }
  scanDebounceMap.set(
    key,
    setTimeout(() => {
      scanAndUpdate(document);
      scanDebounceMap.delete(key);
    }, 200),
  );
}

function scanAndUpdate(document: TextDocument): void {
  if (isEntityJson(document.uri)) {
    EntityStore.updateFromDocument(document.uri, document.getText());
    const diagnostics = computeEntityDiagnostics(document);
    connection.sendDiagnostics({ uri: document.uri, diagnostics });
    return;
  }

  // 문서 스캔
  NaiteTracker.scanDocument(document);

  // Trace 라인 번호 동기화
  syncTraceLineNumbers(document);

  // 진단 업데이트
  const diagnostics = computeDiagnostics(document);
  connection.sendDiagnostics({ uri: document.uri, diagnostics });
}

function syncTraceLineNumbers(document: TextDocument): void {
  const filePath = document.uri.startsWith("file://") ? document.uri.slice(7) : document.uri;
  const currentTraces = TraceStore.getAllTraces();
  const fileTraces = currentTraces.filter((t) => t.filePath === filePath);

  if (fileTraces.length === 0) {
    return;
  }

  const scanner = new NaiteExpressionScanner(document);
  const naiteCalls = Array.from(scanner.scanNaiteCalls(["Naite.t"]));

  const keyLineEntries = naiteCalls.map((call) => ({
    key: call.key,
    lineNumber: call.location.range.start.line + 1,
  }));

  TraceStore.updateTraceLineNumbers(filePath, keyLineEntries);
}

documents.onDidOpen((event) => {
  debouncedScanAndUpdate(event.document);
});

documents.onDidChangeContent((event) => {
  debouncedScanAndUpdate(event.document);
});

documents.onDidSave((event) => {
  debouncedScanAndUpdate(event.document);
});

documents.onDidClose((event) => {
  const key = event.document.uri;
  const timer = scanDebounceMap.get(key);
  if (timer) {
    clearTimeout(timer);
    scanDebounceMap.delete(key);
  }
});

// Custom notifications (클라이언트 → 서버)
connection.onNotification("naite/focusKey", (params: { key: string }) => {
  broadcastToViewerClients({ type: "focusKey", key: params.key });
});

connection.onNotification("naite/focusTest", (params: { suiteName: string; testName: string }) => {
  broadcastToViewerClients({
    type: "focusTest",
    suiteName: params.suiteName,
    testName: params.testName,
  });
});

connection.onNotification("naite/openViewer", () => {
  connection.sendNotification("naite/openViewer");
});

// 서버 시작
documents.listen(connection);
connection.listen();
