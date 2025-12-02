import vscode from "vscode";
import { getAllTraces, type NaiteTraceEntry, onTraceChange } from "./naite-socket-server";

/**
 * 하단 패널용 Trace 뷰어
 * - 왼쪽: Key 목록
 * - 오른쪽: 선택된 Key의 Trace 상세
 * - 상태 유지: 탭 전환해도 살아있음
 */
export class NaiteTracePanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "naiteTracePanelView";

  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];

  // 마지막 데이터 캐시 (webview 재생성 시 복원용)
  private _lastKeys: string[] = [];
  private _lastKeyMap: Record<string, NaiteTraceEntry[]> = {};

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
          // Webview가 준비되면 캐시된 데이터 전송
          this._sendData();
        }
      },
      null,
      this._disposables,
    );

    // trace 변경 시 업데이트
    this._disposables.push(
      onTraceChange(() => {
        this._buildCache();
        this._sendData();
      }),
    );

    // 초기 데이터 빌드
    this._buildCache();
  }

  private _buildCache(): void {
    const traces = getAllTraces();

    // Key별로 그룹화
    const keyMap: Record<string, NaiteTraceEntry[]> = {};
    for (const trace of traces) {
      const key = trace.key || "(no key)";
      if (!keyMap[key]) {
        keyMap[key] = [];
      }
      keyMap[key].push(trace);
    }

    this._lastKeys = Object.keys(keyMap);
    this._lastKeyMap = keyMap;
  }

  private _sendData(): void {
    if (!this._view) return;

    this._view.webview.postMessage({
      type: "updateData",
      keys: this._lastKeys,
      keyMap: this._lastKeyMap,
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
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-panel-background);
      height: 100vh;
      overflow: hidden;
    }
    
    .container {
      display: flex;
      height: 100%;
    }
    
    /* 왼쪽: Key 목록 */
    .key-list {
      width: 280px;
      min-width: 180px;
      border-right: 1px solid var(--vscode-panel-border);
      overflow-y: auto;
      background: var(--vscode-sideBar-background);
    }
    
    .key-item {
      padding: 6px 12px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    
    .key-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    
    .key-item.selected {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }
    
    .key-name {
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .key-count {
      font-size: 11px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 1px 6px;
      border-radius: 10px;
      margin-left: 8px;
      flex-shrink: 0;
    }
    
    /* 오른쪽: Trace 상세 */
    .trace-detail {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }
    
    .trace-detail.empty {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--vscode-descriptionForeground);
    }
    
    .trace-item {
      margin-bottom: 8px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      overflow: hidden;
    }
    
    .trace-header {
      padding: 6px 10px;
      background: var(--vscode-sideBar-background);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
    }
    
    .trace-header:hover {
      background: var(--vscode-list-hoverBackground);
    }
    
    .trace-location {
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
    }
    
    .trace-time {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    
    .trace-value {
      padding: 8px 10px;
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      background: var(--vscode-editor-background);
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 150px;
      overflow-y: auto;
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
    <div class="key-list" id="keyList">
      <div class="empty-message">테스트를 실행하세요</div>
    </div>
    <div class="trace-detail empty" id="traceDetail">
      왼쪽에서 Key를 선택하세요
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    // 상태 복원
    let state = vscode.getState() || { keys: [], keyMap: {}, selectedKey: null };
    let currentKeys = state.keys;
    let currentKeyMap = state.keyMap;
    let selectedKey = state.selectedKey;
    
    function saveState() {
      vscode.setState({ keys: currentKeys, keyMap: currentKeyMap, selectedKey });
    }
    
    function renderKeyList() {
      const container = document.getElementById('keyList');
      
      if (currentKeys.length === 0) {
        container.innerHTML = '<div class="empty-message">테스트를 실행하세요</div>';
        return;
      }
      
      container.innerHTML = currentKeys.map(key => {
        const count = currentKeyMap[key]?.length || 0;
        const isSelected = key === selectedKey;
        return '<div class="key-item ' + (isSelected ? 'selected' : '') + '" data-key="' + escapeAttr(key) + '">' +
          '<span class="key-name">' + escapeHtml(key) + '</span>' +
          '<span class="key-count">' + count + '</span>' +
        '</div>';
      }).join('');
      
      // 이벤트 바인딩
      container.querySelectorAll('.key-item').forEach(el => {
        el.addEventListener('click', () => {
          selectKey(el.dataset.key);
        });
      });
    }
    
    function selectKey(key) {
      selectedKey = key;
      saveState();
      renderKeyList();
      renderTraceDetail();
    }
    
    function renderTraceDetail() {
      const container = document.getElementById('traceDetail');
      
      if (!selectedKey) {
        container.className = 'trace-detail empty';
        container.innerHTML = '왼쪽에서 Key를 선택하세요';
        return;
      }
      
      const traces = currentKeyMap[selectedKey] || [];
      container.className = 'trace-detail';
      
      if (traces.length === 0) {
        container.innerHTML = '<div class="empty-message">No traces</div>';
        return;
      }
      
      container.innerHTML = traces.map((trace, idx) => {
        const fileName = trace.filePath ? trace.filePath.split('/').pop() : '?';
        const time = new Date(trace.at).toLocaleTimeString('ko-KR', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
        const valueStr = JSON.stringify(trace.value, null, 2);
        
        return '<div class="trace-item">' +
          '<div class="trace-header" data-file="' + escapeAttr(trace.filePath) + '" data-line="' + trace.lineNumber + '">' +
            '<span class="trace-location">' + escapeHtml(fileName) + ':' + trace.lineNumber + '</span>' +
            '<span class="trace-time">' + time + '</span>' +
          '</div>' +
          '<div class="trace-value">' + escapeHtml(valueStr) + '</div>' +
        '</div>';
      }).join('');
      
      // 이벤트 바인딩
      container.querySelectorAll('.trace-header').forEach(el => {
        el.addEventListener('click', () => {
          vscode.postMessage({
            type: 'goToLocation',
            filePath: el.dataset.file,
            lineNumber: parseInt(el.dataset.line)
          });
        });
      });
    }
    
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
    
    function escapeAttr(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;');
    }
    
    window.addEventListener('message', (event) => {
      const message = event.data;
      
      if (message.type === 'updateData') {
        currentKeys = message.keys || [];
        currentKeyMap = message.keyMap || {};
        
        // 선택된 키가 더 이상 없으면 null로
        if (selectedKey && !currentKeys.includes(selectedKey)) {
          selectedKey = null;
        }
        
        saveState();
        renderKeyList();
        renderTraceDetail();
      }
    });
    
    // 초기 렌더링
    renderKeyList();
    renderTraceDetail();
    
    // extension에게 준비됐다고 알림
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
