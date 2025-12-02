import vscode from "vscode";
import { getAllTestResults, onTestResultChange, type TestResultEntry } from "./naite-socket-server";

/**
 * 하단 패널용 Trace 뷰어 (3-Column)
 * - 왼쪽: Key 목록 + 퍼지 검색
 * - 가운데: Suite > Test 트리 (성공/실패, 시간)
 * - 오른쪽: 선택된 Test의 Trace 상세
 */
export class NaiteTracePanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "naiteTracePanelView";

  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];
  private _lastTestResults: TestResultEntry[] = [];

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this._getHtml();

    // 메시지 핸들러
    webviewView.webview.onDidReceiveMessage(
      async (message) => {
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
        } else if (message.type === "ready") {
          this._sendData();
        }
      },
      null,
      this._disposables,
    );

    // test result 변경 시 업데이트
    this._disposables.push(
      onTestResultChange(() => {
        this._lastTestResults = getAllTestResults();
        this._sendData();
      }),
    );

    this._lastTestResults = getAllTestResults();
  }

  private _sendData(): void {
    if (!this._view) return;

    this._view.webview.postMessage({
      type: "updateData",
      testResults: this._lastTestResults,
    });
  }

  private _getHtml(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: 12px;
      color: var(--vscode-foreground);
      background: var(--vscode-panel-background);
      height: 100vh;
      overflow: hidden;
      padding: 0;
      margin: 0;
    }

    .container {
      display: flex;
      height: 100%;
    }

    /* 공통 패널 스타일 */
    .panel {
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--vscode-panel-border);
      overflow: hidden;
    }
    .panel:last-child { border-right: none; }

    .panel-header {
      padding: 8px 6px;
      font-weight: 500;
      font-size: 11px;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .panel-header-btns {
      display: flex;
      gap: 4px;
    }
    .panel-header-btn {
      background: transparent;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      padding: 2px 4px;
      font-size: 10px;
      border-radius: 3px;
    }
    .panel-header-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
      color: var(--vscode-foreground);
    }

    .panel-content {
      flex: 1;
      overflow-y: auto;
    }

    .panel-footer {
      padding: 4px 6px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      border-top: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
      flex-shrink: 0;
    }

    /* 왼쪽: Keys 패널 */
    .keys-panel { width: 200px; min-width: 150px; }

    .search-box {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-size: 12px;
      outline: none;
    }
    .search-box:focus {
      border-color: var(--vscode-focusBorder);
    }
    .search-box::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }

    .key-item {
      padding: 4px 6px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .key-item:hover { background: var(--vscode-list-hoverBackground); }
    .key-item.selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }

    .key-name {
      font-family: var(--vscode-editor-font-family);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .key-name .match {
      font-weight: bold;
      color: var(--vscode-textLink-foreground);
    }
    .key-count {
      font-size: 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 1px 5px;
      border-radius: 8px;
      margin-left: 6px;
      flex-shrink: 0;
    }

    /* 가운데: Tests 패널 */
    .tests-panel { width: 280px; min-width: 200px; }

    .suite-item {
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .suite-header {
      padding: 6px 6px;
      font-weight: 500;
      background: var(--vscode-sideBar-background);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .suite-header:hover { background: var(--vscode-list-hoverBackground); }
    .suite-icon { font-size: 10px; }
    .suite-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .suite-tests { display: block; }
    .suite-tests.collapsed { display: none; }

    .test-item {
      padding: 4px 6px 4px 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .test-item:hover { background: var(--vscode-list-hoverBackground); }
    .test-item.selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }

    .test-status { font-size: 12px; }
    .test-status.pass { color: #4caf50; }
    .test-status.fail { color: #f44336; }
    .test-status.skip { color: #ff9800; }
    .test-status.todo { color: #9e9e9e; }
    .test-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .test-time { font-size: 10px; color: var(--vscode-descriptionForeground); }
    .test-traces {
      font-size: 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 1px 5px;
      border-radius: 8px;
    }

    /* 오른쪽: Traces 패널 */
    .traces-panel { flex: 1; min-width: 250px; }

    .trace-item {
      border-bottom: 1px solid var(--vscode-panel-border);
      padding: 8px 6px;
    }
    .trace-item:hover { background: var(--vscode-list-hoverBackground); }

    .trace-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .trace-key {
      font-family: var(--vscode-editor-font-family);
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
    }
    .trace-key:hover { text-decoration: underline; }
    .trace-location {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
    }
    .trace-location:hover { color: var(--vscode-textLink-foreground); }

    .trace-value {
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      background: var(--vscode-editor-background);
      padding: 6px 8px;
      border-radius: 3px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 120px;
      overflow-y: auto;
    }

    .error-message {
      margin-top: 8px;
      padding: 6px 8px;
      background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
      border-radius: 3px;
      font-size: 11px;
      color: var(--vscode-inputValidation-errorForeground, #f48771);
    }

    .empty-message {
      padding: 20px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- 왼쪽: Keys -->
    <div class="panel keys-panel">
      <div class="panel-header">
        <input type="text" class="search-box" id="keySearch" placeholder="Search keys...">
      </div>
      <div class="panel-content" id="keyList"></div>
      <div class="panel-footer" id="keyFooter">0 keys</div>
    </div>

    <!-- 가운데: Tests -->
    <div class="panel tests-panel">
      <div class="panel-header">
        <span>Tests</span>
        <div class="panel-header-btns">
          <button class="panel-header-btn" id="expandAllTests" title="모두 펼치기">▼</button>
          <button class="panel-header-btn" id="collapseAllTests" title="모두 접기">▶</button>
        </div>
      </div>
      <div class="panel-content" id="testList"></div>
      <div class="panel-footer" id="testFooter">0 tests</div>
    </div>

    <!-- 오른쪽: Traces -->
    <div class="panel traces-panel">
      <div class="panel-header" id="traceHeader">Traces</div>
      <div class="panel-content" id="traceList"></div>
      <div class="panel-footer" id="traceFooter">Select a test</div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // 상태
    let state = vscode.getState() || {
      testResults: [],
      selectedKey: null,
      selectedTest: null,
      searchQuery: ''
    };

    function saveState() {
      vscode.setState(state);
    }

    // 데이터 파싱
    function parseData() {
      const testResults = state.testResults || [];

      // Unique keys (모든 테스트 결과의 traces에서 추출)
      const keyMap = new Map();
      for (const result of testResults) {
        for (const t of result.traces) {
          const key = t.key || '(no key)';
          keyMap.set(key, (keyMap.get(key) || 0) + 1);
        }
      }

      // Suite > Test 구조 (TestResultEntry 기반)
      const suiteMap = new Map();
      for (const result of testResults) {
        const suite = result.suiteName || '(no suite)';
        const test = result.testName || '(no test)';

        if (!suiteMap.has(suite)) {
          suiteMap.set(suite, new Map());
        }
        const testMap = suiteMap.get(suite);

        // 같은 테스트가 여러번 실행될 수 있으므로 마지막 것만 사용
        testMap.set(test, result);
      }

      return { keyMap, suiteMap };
    }

    // 퍼지 검색 - 매칭 인덱스 반환
    function fuzzyMatch(query, text) {
      if (!query) return { matched: true, indices: [] };
      const lowerQuery = query.toLowerCase();
      const lowerText = text.toLowerCase();
      const indices = [];
      let qi = 0;
      for (let i = 0; i < lowerText.length && qi < lowerQuery.length; i++) {
        if (lowerText[i] === lowerQuery[qi]) {
          indices.push(i);
          qi++;
        }
      }
      return { matched: qi === lowerQuery.length, indices };
    }

    // 매칭 부분 하이라이트
    function highlightMatch(text, indices) {
      if (indices.length === 0) return escapeHtml(text);
      const indexSet = new Set(indices);
      let result = '';
      for (let i = 0; i < text.length; i++) {
        const char = escapeHtml(text[i]);
        if (indexSet.has(i)) {
          result += '<span class="match">' + char + '</span>';
        } else {
          result += char;
        }
      }
      return result;
    }

    // 렌더링: Keys
    function renderKeys() {
      const { keyMap } = parseData();
      const container = document.getElementById('keyList');
      const footer = document.getElementById('keyFooter');

      // 선택된 key가 현재 데이터에 없으면 초기화
      if (state.selectedKey && !keyMap.has(state.selectedKey)) {
        state.selectedKey = null;
        saveState();
      }

      const query = state.searchQuery || '';
      const matchResults = Array.from(keyMap.entries())
        .map(([key, count]) => {
          const result = fuzzyMatch(query, key);
          return { key, count, ...result };
        })
        .filter(r => r.matched);

      if (matchResults.length === 0) {
        container.innerHTML = '<div class="empty-message">No keys</div>';
      } else {
        container.innerHTML = matchResults.map(({ key, count, indices }) => {
          const selected = state.selectedKey === key ? 'selected' : '';
          const highlighted = highlightMatch(key, indices);
          return '<div class="key-item ' + selected + '" data-key="' + escapeAttr(key) + '">' +
            '<span class="key-name">' + highlighted + '</span>' +
            '<span class="key-count">' + count + '</span>' +
          '</div>';
        }).join('');

        container.querySelectorAll('.key-item').forEach(el => {
          el.addEventListener('click', () => {
            state.selectedKey = state.selectedKey === el.dataset.key ? null : el.dataset.key;
            state.selectedTest = null;
            saveState();
            renderAll();
          });
        });
      }

      footer.textContent = matchResults.length + ' keys';
    }

    // 렌더링: Tests
    function renderTests() {
      const { suiteMap } = parseData();
      const container = document.getElementById('testList');
      const footer = document.getElementById('testFooter');

      // 접힌 suite 상태 초기화 (없으면)
      if (!state.collapsedSuites) state.collapsedSuites = [];

      let totalTests = 0;
      let passedTests = 0;
      let html = '';

      for (const [suiteName, testMap] of suiteMap) {
        // Key 필터링
        let suiteHasMatch = !state.selectedKey;
        const testItems = [];

        for (const [testName, result] of testMap) {
          const hasKey = !state.selectedKey || result.traces.some(t => t.key === state.selectedKey);
          if (!hasKey) continue;

          suiteHasMatch = true;
          totalTests++;

          // 실제 status와 duration 사용
          const status = result.status;
          const passed = status === 'pass';
          if (passed) passedTests++;

          const duration = result.duration;
          const statusIcon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : status === 'skip' ? '○' : '◌';

          const testKey = suiteName + '::' + testName;
          const selected = state.selectedTest === testKey ? 'selected' : '';

          testItems.push(
            '<div class="test-item ' + selected + '" data-test="' + escapeAttr(testKey) + '">' +
              '<span class="test-status ' + status + '">' + statusIcon + '</span>' +
              '<span class="test-name">' + escapeHtml(testName) + '</span>' +
              '<span class="test-time">' + Math.round(duration) + 'ms</span>' +
              '<span class="test-traces">' + result.traces.length + '</span>' +
            '</div>'
          );
        }

        if (!suiteHasMatch) continue;

        const isCollapsed = state.collapsedSuites.includes(suiteName);
        html += '<div class="suite-item">' +
          '<div class="suite-header" data-suite="' + escapeAttr(suiteName) + '">' +
            '<span class="suite-icon">' + (isCollapsed ? '▶' : '▼') + '</span>' +
            '<span class="suite-name">' + escapeHtml(suiteName) + '</span>' +
          '</div>' +
          '<div class="suite-tests' + (isCollapsed ? ' collapsed' : '') + '">' +
          testItems.join('') +
          '</div>' +
        '</div>';
      }

      if (!html) {
        container.innerHTML = '<div class="empty-message">No tests</div>';
      } else {
        container.innerHTML = html;

        // Suite 토글
        container.querySelectorAll('.suite-header').forEach(el => {
          el.addEventListener('click', (e) => {
            const suiteName = el.dataset.suite;
            const idx = state.collapsedSuites.indexOf(suiteName);
            if (idx >= 0) {
              state.collapsedSuites.splice(idx, 1);
            } else {
              state.collapsedSuites.push(suiteName);
            }
            saveState();
            renderTests();
          });
        });

        // Test 선택
        container.querySelectorAll('.test-item').forEach(el => {
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            state.selectedTest = state.selectedTest === el.dataset.test ? null : el.dataset.test;
            saveState();
            renderAll();
          });
        });
      }

      footer.textContent = passedTests + '/' + totalTests + ' passed';
    }

    // 렌더링: Traces
    function renderTraces() {
      const { suiteMap } = parseData();
      const container = document.getElementById('traceList');
      const header = document.getElementById('traceHeader');
      const footer = document.getElementById('traceFooter');

      if (!state.selectedTest) {
        header.textContent = 'Traces';
        container.innerHTML = '<div class="empty-message">Select a test to see traces</div>';
        footer.textContent = 'Select a test';
        return;
      }

      const [suiteName, testName] = state.selectedTest.split('::');
      const testMap = suiteMap.get(suiteName);
      const testResult = testMap?.get(testName);

      if (!testResult) {
        // 선택된 테스트가 현재 데이터에 없으면 선택 초기화
        state.selectedTest = null;
        saveState();
        header.textContent = 'Traces';
        container.innerHTML = '<div class="empty-message">Select a test to see traces</div>';
        footer.textContent = 'Select a test';
        return;
      }

      // Key 필터링
      let traces = testResult.traces;
      if (state.selectedKey) {
        traces = traces.filter(t => t.key === state.selectedKey);
      }

      header.textContent = 'Traces - ' + testName;

      // 에러 메시지 표시
      let errorHtml = '';
      if (testResult.status === 'fail' && testResult.error) {
        errorHtml = '<div class="error-message">' +
          '<strong>Error:</strong> ' + escapeHtml(testResult.error.message) +
        '</div>';
      }

      if (traces.length === 0) {
        container.innerHTML = errorHtml + '<div class="empty-message">No traces in this test</div>';
        footer.textContent = '0 traces';
        return;
      }

      container.innerHTML = errorHtml + traces.map(t => {
        const fileName = t.filePath ? t.filePath.split('/').pop() : '?';
        const valueStr = JSON.stringify(t.value, null, 2);

        return '<div class="trace-item">' +
          '<div class="trace-header">' +
            '<span class="trace-key" data-file="' + escapeAttr(t.filePath) + '" data-line="' + t.lineNumber + '">' + escapeHtml(t.key) + '</span>' +
            '<span class="trace-location" data-file="' + escapeAttr(t.filePath) + '" data-line="' + t.lineNumber + '">' + escapeHtml(fileName) + ':' + t.lineNumber + '</span>' +
          '</div>' +
          '<div class="trace-value">' + escapeHtml(valueStr) + '</div>' +
        '</div>';
      }).join('');

      container.querySelectorAll('[data-file]').forEach(el => {
        el.addEventListener('click', () => {
          vscode.postMessage({
            type: 'goToLocation',
            filePath: el.dataset.file,
            lineNumber: parseInt(el.dataset.line)
          });
        });
      });

      footer.textContent = traces.length + ' traces';
    }

    function renderAll() {
      renderKeys();
      renderTests();
      renderTraces();
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }

    // 검색 이벤트
    const searchBox = document.getElementById('keySearch');
    searchBox.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      saveState();
      renderKeys();
    });

    // ESC 키로 초기화
    searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        state.searchQuery = '';
        state.selectedKey = null;
        state.selectedTest = null;
        searchBox.value = '';
        saveState();
        renderAll();
      }
    });

    // 전역 ESC 키 (검색창에 포커스 없을 때도)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.activeElement !== searchBox) {
        state.selectedKey = null;
        state.selectedTest = null;
        saveState();
        renderAll();
      }
    });

    // Tests 전체 접기/펼치기
    document.getElementById('expandAllTests').addEventListener('click', () => {
      state.collapsedSuites = [];
      saveState();
      renderTests();
    });

    document.getElementById('collapseAllTests').addEventListener('click', () => {
      const { suiteMap } = parseData();
      state.collapsedSuites = Array.from(suiteMap.keys());
      saveState();
      renderTests();
    });

    // 메시지 수신
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'updateData') {
        state.testResults = message.testResults || [];
        saveState();
        renderAll();
      }
    });

    // 초기화
    document.getElementById('keySearch').value = state.searchQuery || '';
    renderAll();
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }

  dispose(): void {
    for (const d of this._disposables) {
      d.dispose();
    }
  }
}
