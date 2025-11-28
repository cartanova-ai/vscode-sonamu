import * as vscode from 'vscode';
import { NaiteTracker } from './naite-tracker';
import { NaiteCompletionProvider } from './naite-completion-provider';
import { NaiteDefinitionProvider } from './naite-definition-provider';
import { NaiteReferenceProvider } from './naite-reference-provider';
import { NaiteHoverProvider } from './naite-hover-provider';
import { NaiteCodeLensProvider, showNaiteLocations } from './naite-codelens-provider';
import { NaiteDiagnosticProvider } from './naite-diagnostic-provider';
import { updateDecorations, disposeDecorations } from './naite-decorator';
import { startRuntimeWatcher, updateRuntimeDecorations, disposeRuntimeDecorations, getTracesForLine } from './naite-runtime-decorator';

// Naite Trace Webview 생성
function createTraceWebviewPanel(
  context: vscode.ExtensionContext,
  key: string,
  traces: Array<{ key: string; value: any; filePath: string; lineNumber: number; at: string }>
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'naiteTrace',
    `Naite: ${key}`,
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  const reversedTraces = [...traces].reverse();

  // 헤더용 위치 정보
  const firstTrace = traces[0];
  const fileName = firstTrace.filePath.split('/').pop() || firstTrace.filePath;
  const locationData = JSON.stringify({ filePath: firstTrace.filePath, lineNumber: firstTrace.lineNumber });

  const traceItems = reversedTraces.map((t, i) => {
    const originalIndex = traces.length - i;
    const time = new Date(t.at).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const isLatest = i === 0;

    return `
      <div class="trace-item ${isLatest ? 'latest' : ''}">
        <div class="trace-header" onclick="toggleTrace(${i})">
          <span class="arrow" id="arrow-${i}">▼</span>
          <span class="index">#${originalIndex}${isLatest ? ' <span class="badge">latest</span>' : ''}</span>
          <span class="time">${time}</span>
        </div>
        <div class="trace-content" id="content-${i}">
          <div class="json-viewer">${renderJsonValue(t.value)}</div>
        </div>
      </div>
    `;
  }).join('');

  panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --border: var(--vscode-panel-border);
      --hover: var(--vscode-list-hoverBackground);
      --accent: var(--vscode-textLink-foreground);
      --badge-bg: var(--vscode-badge-background);
      --badge-fg: var(--vscode-badge-foreground);
    }
    body {
      font-family: var(--vscode-font-family);
      padding: 16px;
      color: var(--fg);
      background: var(--bg);
    }
    .header {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .header h2 {
      margin: 0 0 4px 0;
      font-size: 16px;
      font-weight: 500;
    }
    .header .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .trace-item {
      margin-bottom: 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }
    .trace-item.latest {
      border-color: var(--accent);
    }
    .trace-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      cursor: pointer;
      background: var(--vscode-sideBar-background);
      user-select: none;
    }
    .trace-header:hover {
      background: var(--hover);
    }
    .arrow {
      font-size: 10px;
      transition: transform 0.2s;
      color: var(--vscode-descriptionForeground);
    }
    .arrow.collapsed {
      transform: rotate(-90deg);
    }
    .index {
      font-weight: 500;
    }
    .badge {
      background: var(--badge-bg);
      color: var(--badge-fg);
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: normal;
      margin-left: 4px;
    }
    .time {
      margin-left: auto;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-family: var(--vscode-editor-font-family);
    }
    .trace-content {
      padding: 12px;
      background: var(--bg);
      overflow: hidden;
      transition: max-height 0.2s ease-out;
    }
    .trace-content.collapsed {
      max-height: 0;
      padding: 0 12px;
    }
    pre {
      margin: 0;
      font-family: var(--vscode-editor-font-family);
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    code {
      color: var(--vscode-textPreformat-foreground);
    }
    .location {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 8px;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      color: var(--accent);
      cursor: pointer;
      font-family: var(--vscode-editor-font-family);
    }
    .location:hover {
      text-decoration: underline;
    }
    .json-viewer {
      font-family: var(--vscode-editor-font-family);
      font-size: 13px;
      line-height: 1.6;
    }
    .json-key {
      color: #9cdcfe;
    }
    .json-string {
      color: #ce9178;
    }
    .json-number {
      color: #b5cea8;
    }
    .json-boolean {
      color: #569cd6;
    }
    .json-null {
      color: #569cd6;
    }
    .json-bracket {
      color: var(--fg);
    }
    .json-object, .json-array {
      margin-left: 16px;
    }
    .json-item {
      display: block;
    }
    .json-inline {
      display: inline;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>📍 ${escapeHtml(key)}</h2>
    <div class="subtitle">${traces.length}회 호출됨</div>
    <div class="location" onclick="goToLocation(${escapeHtml(locationData)})">
      → ${escapeHtml(fileName)}:${firstTrace.lineNumber}
    </div>
  </div>
  <div class="traces">
    ${traceItems}
  </div>
  <script>
    const vscode = acquireVsCodeApi();

    function toggleTrace(index) {
      const content = document.getElementById('content-' + index);
      const arrow = document.getElementById('arrow-' + index);
      content.classList.toggle('collapsed');
      arrow.classList.toggle('collapsed');
    }

    function goToLocation(location) {
      vscode.postMessage({ type: 'goToLocation', ...location });
    }
  </script>
</body>
</html>`;

  // 메시지 핸들러 등록
  panel.webview.onDidReceiveMessage(async (message) => {
    if (message.type === 'goToLocation') {
      const uri = vscode.Uri.file(message.filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
      const line = message.lineNumber - 1;
      const position = new vscode.Position(line, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    }
  });

  return panel;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderJsonValue(value: any, inline = false): string {
  if (value === null) {
    return '<span class="json-null">null</span>';
  }
  if (value === undefined) {
    return '<span class="json-null">undefined</span>';
  }
  if (typeof value === 'string') {
    return `<span class="json-string">"${escapeHtml(value)}"</span>`;
  }
  if (typeof value === 'number') {
    return `<span class="json-number">${value}</span>`;
  }
  if (typeof value === 'boolean') {
    return `<span class="json-boolean">${value}</span>`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '<span class="json-bracket">[]</span>';
    }
    const items = value.map(v => `<span class="json-item">${renderJsonValue(v)},</span>`).join('');
    return `<span class="json-bracket">[</span><div class="json-array">${items}</div><span class="json-bracket">]</span>`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return '<span class="json-bracket">{}</span>';
    }
    const items = keys.map(k =>
      `<span class="json-item"><span class="json-key">"${escapeHtml(k)}"</span>: ${renderJsonValue(value[k])},</span>`
    ).join('');
    return `<span class="json-bracket">{</span><div class="json-object">${items}</div><span class="json-bracket">}</span>`;
  }
  return escapeHtml(String(value));
}

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
    if (editor) {
      updateDecorations(editor, tracker);
      updateRuntimeDecorations(editor);
    }
  };

  // Runtime value watcher 시작
  startRuntimeWatcher(context);

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
    }),
    // 설정 변경 시 데코레이션 업데이트
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('sonamu')) {
        if (vscode.window.activeTextEditor) {
          triggerUpdate(vscode.window.activeTextEditor);
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
    }),
    vscode.commands.registerCommand('sonamu.openTraceInEditor', async (args: { filePath: string; lineNumber: number }) => {
      const traces = getTracesForLine(args.filePath, args.lineNumber);
      if (traces.length === 0) {
        vscode.window.showWarningMessage('No trace data available');
        return;
      }

      const key = traces[0].key;
      createTraceWebviewPanel(context, key, traces);
    })
  );
}

export function deactivate() {
  disposeDecorations();
  disposeRuntimeDecorations();
}
