import * as vscode from 'vscode';
import { NaiteTracker } from './naite-tracker';
import { NaiteCompletionProvider } from './naite-completion-provider';
import { NaiteDefinitionProvider } from './naite-definition-provider';
import { NaiteReferenceProvider } from './naite-reference-provider';
import { NaiteHoverProvider } from './naite-hover-provider';
import { NaiteCodeLensProvider, showNaiteLocations } from './naite-codelens-provider';
import { NaiteDiagnosticProvider } from './naite-diagnostic-provider';
import { updateDecorations, disposeDecorations } from './naite-decorator';
import { startRuntimeWatcher, updateRuntimeDecorations, disposeRuntimeDecorations, getTracesForLine, getAllTraces, onTraceChange, getCurrentRunInfo } from './naite-runtime-decorator';

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

// 글로벌 Naite Trace Viewer
let globalTracePanel: vscode.WebviewPanel | null = null;

function createGlobalTraceViewer(context: vscode.ExtensionContext): vscode.WebviewPanel {
  if (globalTracePanel) {
    globalTracePanel.reveal();
    return globalTracePanel;
  }

  globalTracePanel = vscode.window.createWebviewPanel(
    'naiteGlobalTrace',
    'Naite Traces',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  globalTracePanel.onDidDispose(() => {
    globalTracePanel = null;
  });

  // 메시지 핸들러
  globalTracePanel.webview.onDidReceiveMessage(async (message) => {
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

  // 초기 렌더링
  updateGlobalTraceViewer();

  // trace 변경 시 업데이트
  const disposable = onTraceChange(() => {
    updateGlobalTraceViewer();
  });
  context.subscriptions.push(disposable);

  return globalTracePanel;
}

function updateGlobalTraceViewer() {
  if (!globalTracePanel) return;

  const traces = getAllTraces();
  const runInfo = getCurrentRunInfo();

  // run 상태 표시
  let runStatusHtml = '';
  if (runInfo.runId) {
    const startTime = runInfo.runStartedAt
      ? new Date(runInfo.runStartedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      : '';
    const isRunning = !runInfo.runEndedAt;
    runStatusHtml = `
      <div class="run-status ${isRunning ? 'running' : 'ended'}">
        <span class="run-indicator"></span>
        <span class="run-label">${isRunning ? 'Test Running' : 'Test Completed'}</span>
        ${startTime ? `<span class="run-time">${startTime}</span>` : ''}
      </div>
    `;
  }

  // 테스트별로 그룹화: suite > testName > traces
  interface TestGroup {
    testName: string;
    traces: typeof traces;
  }
  interface SuiteGroup {
    suite: string;
    tests: Map<string, TestGroup>;
  }

  const suiteMap = new Map<string, SuiteGroup>();

  for (const trace of traces) {
    const suiteName = trace.testSuite || '(no suite)';
    const testName = trace.testName || '(no test)';

    if (!suiteMap.has(suiteName)) {
      suiteMap.set(suiteName, { suite: suiteName, tests: new Map() });
    }
    const suiteGroup = suiteMap.get(suiteName)!;

    if (!suiteGroup.tests.has(testName)) {
      suiteGroup.tests.set(testName, { testName, traces: [] });
    }
    suiteGroup.tests.get(testName)!.traces.push(trace);
  }

  // HTML 생성
  let traceIdx = 0;
  let contentHtml = '';

  for (const [suiteName, suiteGroup] of suiteMap) {
    const suiteTestCount = suiteGroup.tests.size;
    const suiteTraceCount = Array.from(suiteGroup.tests.values()).reduce((sum, t) => sum + t.traces.length, 0);

    contentHtml += `
      <div class="suite-group">
        <div class="suite-header" onclick="toggleSuite('${escapeHtml(suiteName)}')">
          <span class="arrow suite-arrow" id="suite-arrow-${escapeHtml(suiteName)}">▼</span>
          <span class="suite-name">${escapeHtml(suiteName)}</span>
          <span class="suite-count">${suiteTestCount} tests · ${suiteTraceCount} traces</span>
        </div>
        <div class="suite-content" id="suite-content-${escapeHtml(suiteName)}">
    `;

    for (const [testName, testGroup] of suiteGroup.tests) {
      const testId = `test-${traceIdx}`;
      contentHtml += `
        <div class="test-group">
          <div class="test-header" onclick="toggleTest('${testId}')">
            <span class="arrow test-arrow" id="arrow-${testId}">▼</span>
            <span class="test-name">${escapeHtml(testName)}</span>
            <span class="test-count">${testGroup.traces.length}</span>
          </div>
          <div class="test-content" id="content-${testId}">
      `;

      for (const trace of testGroup.traces) {
        const time = new Date(trace.at).toLocaleTimeString('ko-KR', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
        const fileName = trace.filePath.split('/').pop() || trace.filePath;
        const locationData = JSON.stringify({ filePath: trace.filePath, lineNumber: trace.lineNumber });
        const itemId = `item-${traceIdx++}`;

        contentHtml += `
          <div class="trace-item">
            <div class="trace-header" onclick="toggleTrace('${itemId}')">
              <span class="arrow" id="arrow-${itemId}">▶</span>
              <span class="key">${escapeHtml(trace.key)}</span>
              <span class="location-link" onclick="event.stopPropagation(); goToLocation(${escapeHtml(locationData)})">
                ${escapeHtml(fileName)}:${trace.lineNumber}
              </span>
              <span class="time">${time}</span>
            </div>
            <div class="trace-content collapsed" id="content-${itemId}">
              <div class="json-viewer">${renderJsonValue(trace.value)}</div>
            </div>
          </div>
        `;
      }

      contentHtml += `
          </div>
        </div>
      `;
    }

    contentHtml += `
        </div>
      </div>
    `;
  }

  globalTracePanel.webview.html = `<!DOCTYPE html>
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
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 500;
    }
    .header .count {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .empty {
      color: var(--vscode-descriptionForeground);
      text-align: center;
      padding: 32px;
    }
    /* Suite level */
    .suite-group {
      margin-bottom: 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }
    .suite-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      cursor: pointer;
      background: var(--vscode-sideBar-background);
      user-select: none;
      font-weight: 500;
    }
    .suite-header:hover {
      background: var(--hover);
    }
    .suite-name {
      color: var(--vscode-symbolIcon-classForeground, #ee9d28);
    }
    .suite-count {
      margin-left: auto;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-weight: normal;
    }
    .suite-content {
      border-top: 1px solid var(--border);
    }
    .suite-content.collapsed {
      display: none;
    }
    /* Test level */
    .test-group {
      border-bottom: 1px solid var(--border);
    }
    .test-group:last-child {
      border-bottom: none;
    }
    .test-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px 8px 24px;
      cursor: pointer;
      background: var(--bg);
      user-select: none;
    }
    .test-header:hover {
      background: var(--hover);
    }
    .test-name {
      color: var(--vscode-symbolIcon-functionForeground, #b180d7);
    }
    .test-count {
      margin-left: auto;
      background: var(--badge-bg);
      color: var(--badge-fg);
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 11px;
    }
    .test-content {
      padding-left: 24px;
    }
    .test-content.collapsed {
      display: none;
    }
    /* Trace level */
    .trace-item {
      border-top: 1px solid var(--border);
    }
    .trace-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      cursor: pointer;
      user-select: none;
      font-size: 13px;
    }
    .trace-header:hover {
      background: var(--hover);
    }
    .arrow {
      font-size: 10px;
      transition: transform 0.2s;
      color: var(--vscode-descriptionForeground);
      width: 10px;
    }
    .arrow.expanded {
      transform: rotate(90deg);
    }
    .key {
      color: var(--accent);
      font-family: var(--vscode-editor-font-family);
    }
    .location-link {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-family: var(--vscode-editor-font-family);
      cursor: pointer;
    }
    .location-link:hover {
      color: var(--accent);
      text-decoration: underline;
    }
    .time {
      margin-left: auto;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      font-family: var(--vscode-editor-font-family);
    }
    .trace-content {
      padding: 8px 12px;
      background: var(--vscode-sideBar-background);
    }
    .trace-content.collapsed {
      display: none;
    }
    .json-viewer {
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      line-height: 1.5;
    }
    .json-key { color: #9cdcfe; }
    .json-string { color: #ce9178; }
    .json-number { color: #b5cea8; }
    .json-boolean { color: #569cd6; }
    .json-null { color: #569cd6; }
    .json-bracket { color: var(--fg); }
    .json-object, .json-array { margin-left: 16px; }
    .json-item { display: block; }
    .run-status {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      background: var(--vscode-sideBar-background);
    }
    .run-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .run-status.running .run-indicator {
      background: #4caf50;
      animation: pulse 1.5s infinite;
    }
    .run-status.ended .run-indicator {
      background: var(--vscode-descriptionForeground);
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .run-label {
      font-weight: 500;
    }
    .run-time {
      color: var(--vscode-descriptionForeground);
      font-family: var(--vscode-editor-font-family);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h2>📊 Naite Traces</h2>
      <span class="count">${traces.length}개</span>
    </div>
    ${runStatusHtml}
  </div>
  ${traces.length === 0
    ? '<div class="empty">테스트를 실행하면 trace가 여기에 표시됩니다.</div>'
    : `<div class="traces">${contentHtml}</div>`
  }
  <script>
    const vscode = acquireVsCodeApi();

    function toggleSuite(name) {
      const content = document.getElementById('suite-content-' + name);
      const arrow = document.getElementById('suite-arrow-' + name);
      content.classList.toggle('collapsed');
      if (content.classList.contains('collapsed')) {
        arrow.textContent = '▶';
      } else {
        arrow.textContent = '▼';
      }
    }

    function toggleTest(id) {
      const content = document.getElementById('content-' + id);
      const arrow = document.getElementById('arrow-' + id);
      content.classList.toggle('collapsed');
      if (content.classList.contains('collapsed')) {
        arrow.textContent = '▶';
      } else {
        arrow.textContent = '▼';
      }
    }

    function toggleTrace(id) {
      const content = document.getElementById('content-' + id);
      const arrow = document.getElementById('arrow-' + id);
      content.classList.toggle('collapsed');
      arrow.classList.toggle('expanded');
    }

    function goToLocation(location) {
      vscode.postMessage({ type: 'goToLocation', ...location });
    }
  </script>
</body>
</html>`;
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
    }),
    vscode.commands.registerCommand('sonamu.openGlobalTraceViewer', () => {
      createGlobalTraceViewer(context);
    })
  );
}

export function deactivate() {
  disposeDecorations();
  disposeRuntimeDecorations();
}
