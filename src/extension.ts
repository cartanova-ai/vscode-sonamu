import * as vscode from "vscode";
import { NaiteCodeLensProvider, showNaiteLocations } from "./naite-codelens-provider";
import { NaiteCompletionProvider } from "./naite-completion-provider";
import { disposeDecorations, updateDecorations } from "./naite-decorator";
import { NaiteDefinitionProvider } from "./naite-definition-provider";
import { NaiteDiagnosticProvider } from "./naite-diagnostic-provider";
import { NaiteHoverProvider } from "./naite-hover-provider";
import { NaiteReferenceProvider } from "./naite-reference-provider";
import {
  disposeRuntimeDecorations,
  getAllTraces,
  getCurrentRunInfo,
  getTracesForLine,
  handleDocumentChange,
  onTraceChange,
  startRuntimeWatcher,
  updateRuntimeDecorations,
} from "./naite-runtime-decorator";
import { NaiteTracker } from "./naite-tracker";

// 글로벌 Naite Trace Viewer
let globalTracePanel: vscode.WebviewPanel | null = null;
let globalTraceDisposable: vscode.Disposable | null = null;

function createGlobalTraceViewer(context: vscode.ExtensionContext): vscode.WebviewPanel {
  if (globalTracePanel) {
    globalTracePanel.reveal();
    return globalTracePanel;
  }

  globalTracePanel = vscode.window.createWebviewPanel(
    "naiteGlobalTrace",
    "Naite Traces",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );

  // 기본 HTML 한 번만 설정
  globalTracePanel.webview.html = getGlobalTraceViewerHtml();

  globalTracePanel.onDidDispose(() => {
    globalTracePanel = null;
    if (globalTraceDisposable) {
      globalTraceDisposable.dispose();
      globalTraceDisposable = null;
    }
  });

  // 메시지 핸들러
  globalTracePanel.webview.onDidReceiveMessage(async (message) => {
    if (message.type === "goToLocation") {
      const uri = vscode.Uri.file(message.filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
      const line = message.lineNumber - 1;
      const position = new vscode.Position(line, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter,
      );
    }
  });

  // 초기 데이터 전송
  sendTraceDataToWebview();

  // trace 변경 시 업데이트
  globalTraceDisposable = onTraceChange(() => {
    sendTraceDataToWebview();
  });
  context.subscriptions.push(globalTraceDisposable);

  return globalTracePanel;
}

// 데이터를 webview에 postMessage로 전송
function sendTraceDataToWebview() {
  if (!globalTracePanel) return;

  const traces = getAllTraces();
  const runInfo = getCurrentRunInfo();

  globalTracePanel.webview.postMessage({
    type: "updateTraces",
    traces,
    runInfo,
  });
}

// Global Trace Viewer HTML 템플릿 (한 번만 생성)
function getGlobalTraceViewerHtml(): string {
  return `<!DOCTYPE html>
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
    .warning-banner {
      background: var(--vscode-inputValidation-warningBackground, #5a4d25);
      border: 1px solid var(--vscode-inputValidation-warningBorder, #b89500);
      color: var(--vscode-inputValidation-warningForeground, #cca700);
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 16px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .warning-banner .icon {
      font-size: 16px;
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
    .suite-file {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-weight: normal;
      font-family: var(--vscode-editor-font-family);
      cursor: pointer;
      margin-left: 8px;
    }
    .suite-file:hover {
      color: var(--accent);
      text-decoration: underline;
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
    .test-line {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-family: var(--vscode-editor-font-family);
      cursor: pointer;
    }
    .test-line:hover {
      color: var(--accent);
      text-decoration: underline;
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
      overflow-x: auto;
      max-height: 300px;
      overflow-y: auto;
    }
    .trace-content.collapsed {
      display: none;
    }
    .trace-item.highlight {
      background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.33));
      animation: fadeHighlight 2s ease-out forwards;
    }
    @keyframes fadeHighlight {
      0% { background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.33)); }
      100% { background: transparent; }
    }
    .json-viewer {
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .json-key { color: #9cdcfe; }
    .json-string { color: #ce9178; word-break: break-all; }
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
      <span class="count" id="trace-count">0개</span>
    </div>
    <div id="run-status-container"></div>
  </div>
  <div id="traces-container">
    <div class="empty">테스트를 실행하면 trace가 여기에 표시됩니다.</div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();

    // 열림/닫힘 상태 저장
    // suite, test: 기본 열림 → 닫힌 것만 추적
    // trace: 기본 닫힘 → 열린 것만 추적
    const collapsedState = {
      suites: new Set(),    // 닫힌 suite 이름
      tests: new Set(),     // 닫힌 "suite::testName"
    };
    const expandedTraces = new Set();  // 열린 trace key

    function escapeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function escapeId(str) {
      return str.replace(/[^a-zA-Z0-9-_]/g, '_');
    }

    function renderJsonValue(value) {
      if (value === null) {
        return '<span class="json-null">null</span>';
      }
      if (value === undefined) {
        return '<span class="json-null">undefined</span>';
      }
      if (typeof value === 'string') {
        return '<span class="json-string">"' + escapeHtml(value) + '"</span>';
      }
      if (typeof value === 'number') {
        return '<span class="json-number">' + value + '</span>';
      }
      if (typeof value === 'boolean') {
        return '<span class="json-boolean">' + value + '</span>';
      }
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return '<span class="json-bracket">[]</span>';
        }
        const items = value.map(v => '<span class="json-item">' + renderJsonValue(v) + ',</span>').join('');
        return '<span class="json-bracket">[</span><div class="json-array">' + items + '</div><span class="json-bracket">]</span>';
      }
      if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length === 0) {
          return '<span class="json-bracket">{}</span>';
        }
        const items = keys.map(k =>
          '<span class="json-item"><span class="json-key">"' + escapeHtml(k) + '"</span>: ' + renderJsonValue(value[k]) + ',</span>'
        ).join('');
        return '<span class="json-bracket">{</span><div class="json-object">' + items + '</div><span class="json-bracket">}</span>';
      }
      return escapeHtml(String(value));
    }

    function toggleSuite(name) {
      const content = document.getElementById('suite-content-' + escapeId(name));
      const arrow = document.getElementById('suite-arrow-' + escapeId(name));
      if (!content || !arrow) return;

      const isExpanded = !content.classList.contains('collapsed');
      if (isExpanded) {
        content.classList.add('collapsed');
        arrow.textContent = '▶';
        collapsedState.suites.add(name);  // 닫힘 추가
      } else {
        content.classList.remove('collapsed');
        arrow.textContent = '▼';
        collapsedState.suites.delete(name);  // 닫힘 제거
      }
    }

    function toggleTest(suite, testName) {
      const key = suite + '::' + testName;
      const id = escapeId(key);
      const content = document.getElementById('test-content-' + id);
      const arrow = document.getElementById('test-arrow-' + id);
      if (!content || !arrow) return;

      const isExpanded = !content.classList.contains('collapsed');
      if (isExpanded) {
        content.classList.add('collapsed');
        arrow.textContent = '▶';
        collapsedState.tests.add(key);  // 닫힘 추가
      } else {
        content.classList.remove('collapsed');
        arrow.textContent = '▼';
        collapsedState.tests.delete(key);  // 닫힘 제거
      }
    }

    function toggleTrace(suite, testName, traceKey, traceAt) {
      const stateKey = suite + '::' + testName + '::' + traceKey + '::' + traceAt;
      const id = escapeId(stateKey);
      const content = document.getElementById('trace-content-' + id);
      const arrow = document.getElementById('trace-arrow-' + id);
      if (!content || !arrow) return;

      const isExpanded = !content.classList.contains('collapsed');
      if (isExpanded) {
        content.classList.add('collapsed');
        arrow.classList.remove('expanded');
        expandedTraces.delete(stateKey);  // 열림 제거
      } else {
        content.classList.remove('collapsed');
        arrow.classList.add('expanded');
        expandedTraces.add(stateKey);  // 열림 추가
      }
    }

    function goToLocation(filePath, lineNumber) {
      vscode.postMessage({ type: 'goToLocation', filePath, lineNumber });
    }

    function renderTraces(traces, runInfo) {
      // count 업데이트
      document.getElementById('trace-count').textContent = traces.length + '개';

      // run status 업데이트
      const statusContainer = document.getElementById('run-status-container');
      if (runInfo.runId) {
        const startTime = runInfo.runStartedAt
          ? new Date(runInfo.runStartedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
          : '';
        const isRunning = !runInfo.runEndedAt;
        statusContainer.innerHTML =
          '<div class="run-status ' + (isRunning ? 'running' : 'ended') + '">' +
            '<span class="run-indicator"></span>' +
            '<span class="run-label">' + (isRunning ? 'Test Running' : 'Test Completed') + '</span>' +
            (startTime ? '<span class="run-time">' + startTime + '</span>' : '') +
          '</div>';
      } else {
        statusContainer.innerHTML = '';
      }

      // 데이터가 없으면 empty
      if (traces.length === 0) {
        document.getElementById('traces-container').innerHTML =
          '<div class="empty">테스트를 실행하면 trace가 여기에 표시됩니다.</div>';
        return;
      }

      // 300개 넘으면 자르기
      const MAX_TRACES = 300;
      const totalCount = traces.length;
      let warningHtml = '';
      if (totalCount > MAX_TRACES) {
        warningHtml = '<div class="warning-banner">' +
          '<span class="icon">⚠️</span>' +
          '<span>Trace가 ' + totalCount + '개로 너무 많아 처음 ' + MAX_TRACES + '개만 표시합니다. 테스트를 쪼개서 돌려보세요.</span>' +
          '</div>';
        traces = traces.slice(0, MAX_TRACES);
      }

      // 테스트별로 그룹화
      const suiteMap = new Map();  // suiteName -> { testMap, testFilePath }
      for (const trace of traces) {
        const suiteName = trace.testSuite || '(no suite)';
        const testName = trace.testName || '(no test)';

        if (!suiteMap.has(suiteName)) {
          suiteMap.set(suiteName, { testMap: new Map(), testFilePath: trace.testFilePath });
        }
        const suiteData = suiteMap.get(suiteName);

        if (!suiteData.testMap.has(testName)) {
          suiteData.testMap.set(testName, []);
        }
        suiteData.testMap.get(testName).push(trace);
      }

      // HTML 생성
      let html = warningHtml;

      for (const [suiteName, suiteData] of suiteMap) {
        const testMap = suiteData.testMap;
        const suiteTestCount = testMap.size;
        let suiteTraceCount = 0;
        for (const traces of testMap.values()) {
          suiteTraceCount += traces.length;
        }

        const suiteExpanded = !collapsedState.suites.has(suiteName);  // 기본 열림
        const suiteId = escapeId(suiteName);
        const testFileName = suiteData.testFilePath ? suiteData.testFilePath.split('/').pop() : null;

        html += '<div class="suite-group">';
        html += '<div class="suite-header" onclick="toggleSuite(\\'' + escapeHtml(suiteName).replace(/'/g, "\\\\'") + '\\')">';
        html += '<span class="arrow suite-arrow" id="suite-arrow-' + suiteId + '">' + (suiteExpanded ? '▼' : '▶') + '</span>';
        html += '<span class="suite-name">' + escapeHtml(suiteName) + '</span>';
        if (testFileName && suiteData.testFilePath) {
          html += '<span class="suite-file" onclick="event.stopPropagation(); goToLocation(\\'' + escapeHtml(suiteData.testFilePath).replace(/'/g, "\\\\'") + '\\', 1)">' + escapeHtml(testFileName) + '</span>';
        }
        html += '<span class="suite-count">' + suiteTestCount + ' tests · ' + suiteTraceCount + ' traces</span>';
        html += '</div>';
        html += '<div class="suite-content' + (suiteExpanded ? '' : ' collapsed') + '" id="suite-content-' + suiteId + '">';

        for (const [testName, testTraces] of testMap) {
          const testKey = suiteName + '::' + testName;
          const testExpanded = !collapsedState.tests.has(testKey);  // 기본 열림
          const testId = escapeId(testKey);

          html += '<div class="test-group">';
          html += '<div class="test-header" onclick="toggleTest(\\'' + escapeHtml(suiteName).replace(/'/g, "\\\\'") + '\\', \\'' + escapeHtml(testName).replace(/'/g, "\\\\'") + '\\')">';
          html += '<span class="arrow test-arrow" id="test-arrow-' + testId + '">' + (testExpanded ? '▼' : '▶') + '</span>';
          html += '<span class="test-name">' + escapeHtml(testName) + '</span>';
          const firstTrace = testTraces[0];
          if (firstTrace?.testFilePath && firstTrace?.testLine) {
            html += '<span class="test-line" onclick="event.stopPropagation(); goToLocation(\\'' + escapeHtml(firstTrace.testFilePath).replace(/'/g, "\\\\'") + '\\', ' + firstTrace.testLine + ')">:' + firstTrace.testLine + '</span>';
          }
          html += '<span class="test-count">' + testTraces.length + '</span>';
          html += '</div>';
          html += '<div class="test-content' + (testExpanded ? '' : ' collapsed') + '" id="test-content-' + testId + '">';

          for (let traceIdx = 0; traceIdx < testTraces.length; traceIdx++) {
            const trace = testTraces[traceIdx];
            const time = new Date(trace.at).toLocaleTimeString('ko-KR', {
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            });
            const fileName = trace.filePath.split('/').pop() || trace.filePath;
            // trace.at(timestamp)을 포함하여 각 트레이스를 고유하게 식별
            const traceStateKey = suiteName + '::' + testName + '::' + trace.key + '::' + trace.at;
            const traceExpanded = expandedTraces.has(traceStateKey);  // 기본 닫힘
            const traceId = escapeId(traceStateKey);

            html += '<div class="trace-item" id="item-' + traceId + '" data-filepath="' + escapeHtml(trace.filePath) + '" data-line="' + trace.lineNumber + '" data-key="' + escapeHtml(trace.key) + '">';
            html += '<div class="trace-header" onclick="toggleTrace(\\'' + escapeHtml(suiteName).replace(/'/g, "\\\\'") + '\\', \\'' + escapeHtml(testName).replace(/'/g, "\\\\'") + '\\', \\'' + escapeHtml(trace.key).replace(/'/g, "\\\\'") + '\\', ' + trace.at + ')">';
            html += '<span class="arrow' + (traceExpanded ? ' expanded' : '') + '" id="trace-arrow-' + traceId + '">▶</span>';
            html += '<span class="key">' + escapeHtml(trace.key) + '</span>';
            html += '<span class="location-link" onclick="event.stopPropagation(); goToLocation(\\'' + escapeHtml(trace.filePath).replace(/'/g, "\\\\'") + '\\', ' + trace.lineNumber + ')">' + escapeHtml(fileName) + ':' + trace.lineNumber + '</span>';
            html += '<span class="time">' + time + '</span>';
            html += '</div>';
            html += '<div class="trace-content' + (traceExpanded ? '' : ' collapsed') + '" id="trace-content-' + traceId + '">';
            html += '<div class="json-viewer">' + renderJsonValue(trace.value) + '</div>';
            html += '</div>';
            html += '</div>';
          }

          html += '</div></div>';
        }

        html += '</div></div>';
      }

      document.getElementById('traces-container').innerHTML = '<div class="traces">' + html + '</div>';
    }

    // 메시지 리스너
    window.addEventListener('message', (event) => {
      const message = event.data;

      if (message.type === 'updateTraces') {
        renderTraces(message.traces, message.runInfo);
      }

      if (message.type === 'highlightTrace') {
        // 해당 위치의 모든 trace 찾기
        const items = document.querySelectorAll('.trace-item');
        let firstMatch = null;
        for (const item of items) {
          if (item.dataset.filepath === message.filePath &&
              parseInt(item.dataset.line) === message.lineNumber) {
            if (!firstMatch) firstMatch = item;
            // 부모 suite/test 열기
            let parent = item.parentElement;
            while (parent) {
              if (parent.classList.contains('suite-content')) {
                parent.classList.remove('collapsed');
                const suiteName = parent.id.replace('suite-content-', '');
                const arrow = document.getElementById('suite-arrow-' + suiteName);
                if (arrow) arrow.textContent = '▼';
              }
              if (parent.classList.contains('test-content')) {
                parent.classList.remove('collapsed');
                const testId = parent.id.replace('test-content-', '');
                const arrow = document.getElementById('test-arrow-' + testId);
                if (arrow) arrow.textContent = '▼';
              }
              parent = parent.parentElement;
            }
            // trace 내용 열기
            const traceId = item.id.replace('item-', '');
            const content = document.getElementById('trace-content-' + traceId);
            const arrow = document.getElementById('trace-arrow-' + traceId);
            if (content) content.classList.remove('collapsed');
            if (arrow) arrow.classList.add('expanded');
            // 하이라이트
            item.classList.add('highlight');
          }
        }
        // 첫 번째 매칭으로 스크롤
        if (firstMatch) {
          firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  </script>
</body>
</html>`;
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
      if (doc.languageId === "typescript") {
        await tracker.scanFile(doc.uri);
        diagnosticProvider.updateAllDiagnostics();
      }
    }),
  );

  context.subscriptions.push(diagnosticProvider);

  // 데코레이션: 에디터 변경 시 업데이트
  const triggerUpdate = (editor?: vscode.TextEditor) => {
    if (editor) {
      updateDecorations(editor, tracker);
      updateRuntimeDecorations(editor);
    }
  };

  // Runtime value watcher 시작 (Unix Socket 서버)
  const socketPath = await startRuntimeWatcher(context);
  console.log(`[Sonamu] Naite Socket server started at ${socketPath}`);

  // 상태바에 소켓 상태 표시
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = `$(plug) Naite`;
  statusBarItem.tooltip = `Naite Socket: ${socketPath}\nClick to open Trace Viewer`;
  statusBarItem.command = "sonamu.openGlobalTraceViewer";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  if (vscode.window.activeTextEditor) {
    triggerUpdate(vscode.window.activeTextEditor);
  }

  // 문서 변경 시 debounce된 스캔 + 진단
  const scanDebounceMap = new Map<string, NodeJS.Timeout>();
  const debouncedScan = (doc: vscode.TextDocument) => {
    const key = doc.uri.toString();
    const existing = scanDebounceMap.get(key);
    if (existing) clearTimeout(existing);
    scanDebounceMap.set(
      key,
      setTimeout(async () => {
        await tracker.scanFile(doc.uri);
        diagnosticProvider.updateDiagnostics(doc);
        scanDebounceMap.delete(key);
      }, 500),
    );
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      triggerUpdate(editor);
      if (editor && editor.document.languageId === "typescript") {
        diagnosticProvider.updateDiagnostics(editor.document);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      // 라인 번호 보정 (trace 데코레이터용)
      handleDocumentChange(e);

      const editor = vscode.window.activeTextEditor;
      if (editor && e.document === editor.document) {
        triggerUpdate(editor);
        // TypeScript 파일이면 debounce된 스캔 트리거
        if (e.document.languageId === "typescript") {
          debouncedScan(e.document);
        }
      }
    }),
    // 설정 변경 시 데코레이션 업데이트
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("sonamu")) {
        if (vscode.window.activeTextEditor) {
          triggerUpdate(vscode.window.activeTextEditor);
        }
      }
    }),
  );

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
        const traces = getTracesForLine(args.filePath, args.lineNumber);
        if (traces.length === 0) {
          vscode.window.showWarningMessage("No trace data available");
          return;
        }

        // Global Trace Viewer 열고 해당 trace 하이라이트
        const panel = createGlobalTraceViewer(context);
        const key = traces[0].key;
        // 약간의 딜레이 후 메시지 전송 (webview 로드 대기)
        setTimeout(() => {
          panel.webview.postMessage({
            type: "highlightTrace",
            filePath: args.filePath,
            lineNumber: args.lineNumber,
            key,
          });
        }, 100);
      },
    ),
    vscode.commands.registerCommand("sonamu.openGlobalTraceViewer", () => {
      createGlobalTraceViewer(context);
    }),
  );
}

export function deactivate() {
  disposeDecorations();
  disposeRuntimeDecorations();
}
