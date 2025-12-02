import vscode from "vscode";
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
  getTracesForLine,
  onTraceChange,
  startRuntimeWatcher,
  syncTraceLineNumbersWithDocument,
  updateRuntimeDecorations,
} from "./naite/providers/naite-runtime-decorator";
import { getAllTestResults } from "./naite/providers/naite-socket-server";
import {
  NaiteDocumentSymbolProvider,
  NaiteWorkspaceSymbolProvider,
} from "./naite/providers/naite-symbol-provider";
import { NaiteTracePanelProvider } from "./naite/providers/naite-trace-panel-provider";
import NaiteTracker from "./naite/tracking/tracker";

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

  const testResults = getAllTestResults();

  globalTracePanel.webview.postMessage({
    type: "updateTestResults",
    testResults,
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
    .header-right {
      display: flex;
      align-items: center;
      gap: 4px;
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
    .header-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 12px;
      cursor: pointer;
    }
    .header-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
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
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h2>📊 Naite Traces</h2>
      <span class="count" id="trace-count">0개</span>
    </div>
    <div class="header-right">
      <button class="header-btn" onclick="expandAll()">모두 펼치기</button>
      <button class="header-btn" onclick="collapseAll()">모두 접기</button>
    </div>
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

    function toggleTrace(suite, testName, traceKey, traceAt, traceIdx) {
      const stateKey = suite + '::' + testName + '::' + traceKey + '::' + traceAt + '::' + traceIdx;
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

    function expandAll() {
      // 모든 suite 펼치기
      document.querySelectorAll('.suite-content').forEach(el => {
        el.classList.remove('collapsed');
      });
      document.querySelectorAll('.suite-arrow').forEach(el => {
        el.textContent = '▼';
      });
      collapsedState.suites.clear();

      // 모든 test 펼치기
      document.querySelectorAll('.test-content').forEach(el => {
        el.classList.remove('collapsed');
      });
      document.querySelectorAll('.test-arrow').forEach(el => {
        el.textContent = '▼';
      });
      collapsedState.tests.clear();

      // 모든 trace 펼치기
      document.querySelectorAll('.trace-content').forEach(el => {
        el.classList.remove('collapsed');
        const traceId = el.id.replace('trace-content-', '');
        expandedTraces.add(traceId);
      });
      document.querySelectorAll('.trace-item .arrow').forEach(el => {
        if (!el.classList.contains('suite-arrow') && !el.classList.contains('test-arrow')) {
          el.classList.add('expanded');
        }
      });
    }

    function collapseAll() {
      // 모든 suite 접기
      document.querySelectorAll('.suite-content').forEach(el => {
        el.classList.add('collapsed');
        const suiteId = el.id.replace('suite-content-', '');
        // suiteId를 원래 이름으로 변환은 복잡하므로 상태 추적 생략
      });
      document.querySelectorAll('.suite-arrow').forEach(el => {
        el.textContent = '▶';
      });
      // collapsedState.suites - 실제 이름 추적 어려우므로 리렌더링 시 상태 재구성

      // 모든 test 접기
      document.querySelectorAll('.test-content').forEach(el => {
        el.classList.add('collapsed');
      });
      document.querySelectorAll('.test-arrow').forEach(el => {
        el.textContent = '▶';
      });

      // 모든 trace 접기
      document.querySelectorAll('.trace-content').forEach(el => {
        el.classList.add('collapsed');
      });
      document.querySelectorAll('.trace-item .arrow').forEach(el => {
        if (!el.classList.contains('suite-arrow') && !el.classList.contains('test-arrow')) {
          el.classList.remove('expanded');
        }
      });
      expandedTraces.clear();
    }

    function renderTestResults(testResults) {
      // 전체 trace 개수 계산
      let totalTraces = 0;
      for (const result of testResults) {
        totalTraces += result.traces.length;
      }

      // count 업데이트
      document.getElementById('trace-count').textContent = totalTraces + '개';

      // 데이터가 없으면 empty
      if (testResults.length === 0) {
        document.getElementById('traces-container').innerHTML =
          '<div class="empty">테스트를 실행하면 trace가 여기에 표시됩니다.</div>';
        return;
      }

      // 300개 넘으면 자르기
      const MAX_TRACES = 300;
      let warningHtml = '';
      if (totalTraces > MAX_TRACES) {
        warningHtml = '<div class="warning-banner">' +
          '<span class="icon">⚠️</span>' +
          '<span>Trace가 ' + totalTraces + '개로 너무 많습니다. 테스트를 쪼개서 돌려보세요.</span>' +
          '</div>';
      }

      // Suite > Test 구조로 그룹화
      const suiteMap = new Map();  // suiteName -> { testMap, suiteFilePath }
      for (const result of testResults) {
        const suiteName = result.suiteName || '(no suite)';
        const testName = result.testName || '(no test)';

        if (!suiteMap.has(suiteName)) {
          suiteMap.set(suiteName, { testMap: new Map(), suiteFilePath: result.suiteFilePath });
        }
        const suiteData = suiteMap.get(suiteName);

        // 같은 테스트가 여러번 실행될 수 있으므로 마지막 것만 사용
        suiteData.testMap.set(testName, result);
      }

      // HTML 생성
      let html = warningHtml;

      for (const [suiteName, suiteData] of suiteMap) {
        const testMap = suiteData.testMap;
        const suiteTestCount = testMap.size;
        let suiteTraceCount = 0;
        for (const result of testMap.values()) {
          suiteTraceCount += result.traces.length;
        }

        const suiteExpanded = !collapsedState.suites.has(suiteName);  // 기본 열림
        const suiteId = escapeId(suiteName);
        const testFileName = suiteData.suiteFilePath ? suiteData.suiteFilePath.split('/').pop() : null;

        html += '<div class="suite-group">';
        html += '<div class="suite-header" onclick="toggleSuite(\\'' + escapeHtml(suiteName).replace(/'/g, "\\\\'") + '\\')">';
        html += '<span class="arrow suite-arrow" id="suite-arrow-' + suiteId + '">' + (suiteExpanded ? '▼' : '▶') + '</span>';
        html += '<span class="suite-name">' + escapeHtml(suiteName) + '</span>';
        if (testFileName && suiteData.suiteFilePath) {
          html += '<span class="suite-file" onclick="event.stopPropagation(); goToLocation(\\'' + escapeHtml(suiteData.suiteFilePath).replace(/'/g, "\\\\'") + '\\', 1)">' + escapeHtml(testFileName) + '</span>';
        }
        html += '<span class="suite-count">' + suiteTestCount + ' tests · ' + suiteTraceCount + ' traces</span>';
        html += '</div>';
        html += '<div class="suite-content' + (suiteExpanded ? '' : ' collapsed') + '" id="suite-content-' + suiteId + '">';

        for (const [testName, result] of testMap) {
          const testKey = suiteName + '::' + testName;
          const testExpanded = !collapsedState.tests.has(testKey);  // 기본 열림
          const testId = escapeId(testKey);
          const testTraces = result.traces;

          html += '<div class="test-group">';
          html += '<div class="test-header" onclick="toggleTest(\\'' + escapeHtml(suiteName).replace(/'/g, "\\\\'") + '\\', \\'' + escapeHtml(testName).replace(/'/g, "\\\\'") + '\\')">';
          html += '<span class="arrow test-arrow" id="test-arrow-' + testId + '">' + (testExpanded ? '▼' : '▶') + '</span>';
          html += '<span class="test-name">' + escapeHtml(testName) + '</span>';
          if (result.testFilePath && result.testLine) {
            html += '<span class="test-line" onclick="event.stopPropagation(); goToLocation(\\'' + escapeHtml(result.testFilePath).replace(/'/g, "\\\\'") + '\\', ' + result.testLine + ')">:' + result.testLine + '</span>';
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
            // 고유 식별자: suite + test + key + timestamp + index (같은 밀리초에 여러 trace 가능)
            const traceStateKey = suiteName + '::' + testName + '::' + trace.key + '::' + trace.at + '::' + traceIdx;
            const traceExpanded = expandedTraces.has(traceStateKey);  // 기본 닫힘
            const traceId = escapeId(traceStateKey);

            html += '<div class="trace-item" id="item-' + traceId + '" data-filepath="' + escapeHtml(trace.filePath) + '" data-line="' + trace.lineNumber + '" data-key="' + escapeHtml(trace.key) + '">';
            html += '<div class="trace-header" onclick="toggleTrace(\\'' + escapeHtml(suiteName).replace(/'/g, "\\\\'") + '\\', \\'' + escapeHtml(testName).replace(/'/g, "\\\\'") + '\\', \\'' + escapeHtml(trace.key).replace(/'/g, "\\\\'") + '\\', \\'' + trace.at + '\\', ' + traceIdx + ')">';
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

      if (message.type === 'updateTestResults') {
        renderTestResults(message.testResults);
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
