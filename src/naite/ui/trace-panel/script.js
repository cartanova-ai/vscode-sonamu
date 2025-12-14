const vscode = acquireVsCodeApi();

// 상태
let state = vscode.getState() || {
  testResults: [],
  selectedKey: null,
  selectedTest: null,
  searchQuery: '',
  keysPanelWidth: 200,
  testsPanelWidth: 280
};

function saveState() {
  vscode.setState(state);
}

// 패널 크기 복원
function restorePanelSizes() {
  const keysPanel = document.getElementById('keysPanel');
  const testsPanel = document.getElementById('testsPanel');
  if (state.keysPanelWidth) {
    keysPanel.style.width = state.keysPanelWidth + 'px';
  }
  if (state.testsPanelWidth) {
    testsPanel.style.width = state.testsPanelWidth + 'px';
  }
}

// 리사이저 드래그 핸들링
function setupResizers() {
  const resizer1 = document.getElementById('resizer1');
  const resizer2 = document.getElementById('resizer2');
  const keysPanel = document.getElementById('keysPanel');
  const testsPanel = document.getElementById('testsPanel');

  let isResizing = false;
  let currentResizer = null;

  function onMouseDown(e, resizer) {
    isResizing = true;
    currentResizer = resizer;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!isResizing) return;

    const containerRect = document.querySelector('.container').getBoundingClientRect();

    if (currentResizer === resizer1) {
      // Keys 패널 리사이즈
      let newWidth = e.clientX - containerRect.left;
      newWidth = Math.max(120, Math.min(400, newWidth));
      keysPanel.style.width = newWidth + 'px';
      state.keysPanelWidth = newWidth;
    } else if (currentResizer === resizer2) {
      // Tests 패널 리사이즈
      const keysWidth = keysPanel.getBoundingClientRect().width;
      const resizer1Width = resizer1.getBoundingClientRect().width;
      let newWidth = e.clientX - containerRect.left - keysWidth - resizer1Width;
      newWidth = Math.max(150, Math.min(500, newWidth));
      testsPanel.style.width = newWidth + 'px';
      state.testsPanelWidth = newWidth;
    }
  }

  function onMouseUp() {
    if (!isResizing) return;
    isResizing = false;
    if (currentResizer) {
      currentResizer.classList.remove('dragging');
    }
    currentResizer = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    saveState();
  }

  resizer1.addEventListener('mousedown', (e) => onMouseDown(e, resizer1));
  resizer2.addEventListener('mousedown', (e) => onMouseDown(e, resizer2));
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
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
  const suiteFilePaths = new Map(); // suite -> filePath
  for (const result of testResults) {
    const suite = result.suiteName || '(no suite)';
    const test = result.testName || '(no test)';

    if (!suiteMap.has(suite)) {
      suiteMap.set(suite, new Map());
      if (result.suiteFilePath) {
        suiteFilePaths.set(suite, result.suiteFilePath);
      }
    }
    const testMap = suiteMap.get(suite);

    // 같은 테스트가 여러번 실행될 수 있으므로 마지막 것만 사용
    testMap.set(test, result);
  }

  return { keyMap, suiteMap, suiteFilePaths };
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
        const newKey = state.selectedKey === el.dataset.key ? null : el.dataset.key;
        state.selectedKey = newKey;

        // 선택된 test가 새 key 필터에서도 유효한지 확인
        if (state.selectedTest && newKey) {
          const [suiteName, testName] = state.selectedTest.split('::');
          const testResults = state.testResults || [];
          const testResult = testResults.find(r => r.suiteName === suiteName && r.testName === testName);
          // 해당 test가 새 key를 포함하지 않으면 선택 해제
          if (!testResult || !testResult.traces.some(t => t.key === newKey)) {
            state.selectedTest = null;
          }
        }

        saveState();
        renderAll();
      });
    });
  }

  footer.textContent = matchResults.length + ' keys';
}

// 렌더링: Tests
function renderTests() {
  const { suiteMap, suiteFilePaths } = parseData();
  const container = document.getElementById('testList');
  const footer = document.getElementById('testFooter');
  const filterHint = document.getElementById('testsFilterHint');

  // 필터 칩 업데이트: 선택된 key 표시
  if (state.selectedKey) {
    filterHint.innerHTML = '<span class="filter-chip">' +
      '<span class="filter-chip-text" title="' + escapeAttr(state.selectedKey) + '">' + escapeHtml(state.selectedKey) + '</span>' +
      '<span class="filter-chip-close" id="clearKeyFilter" title="Clear filter">×</span>' +
    '</span>';
    filterHint.style.display = 'block';
    document.getElementById('clearKeyFilter').addEventListener('click', () => {
      state.selectedKey = null;
      saveState();
      renderAll();
    });
  } else {
    filterHint.style.display = 'none';
  }

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

      // 파일명:라인넘버
      const testFileName = result.testFilePath ? result.testFilePath.split('/').pop() : '';
      const testLocationStr = testFileName && result.testLine ? testFileName + ':' + result.testLine : '';

      testItems.push(
        '<div class="test-item ' + selected + '" data-test="' + escapeAttr(testKey) + '">' +
          '<span class="test-status ' + status + '">' + statusIcon + '</span>' +
          '<span class="test-name">' + escapeHtml(testName) + '</span>' +
          '<span class="test-time">' + Math.round(duration) + 'ms</span>' +
          '<span class="test-traces">' + result.traces.length + '</span>' +
          (testLocationStr ? '<span class="location" data-file="' + escapeAttr(result.testFilePath) + '" data-line="' + result.testLine + '">' + escapeHtml(testLocationStr) + '</span>' : '') +
        '</div>'
      );
    }

    if (!suiteHasMatch) continue;

    const isCollapsed = state.collapsedSuites.includes(suiteName);
    const suiteFilePath = suiteFilePaths.get(suiteName) || '';
    const suiteFileName = suiteFilePath ? suiteFilePath.split('/').pop() : '';

    html += '<div class="suite-item">' +
      '<div class="suite-header" data-suite="' + escapeAttr(suiteName) + '">' +
        '<span class="suite-icon">' + (isCollapsed ? '▶' : '▼') + '</span>' +
        '<span class="suite-name">' + escapeHtml(suiteName) + '</span>' +
        (suiteFileName ? '<span class="location" data-file="' + escapeAttr(suiteFilePath) + '" data-line="1">' + escapeHtml(suiteFileName) + '</span>' : '') +
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
        // .location 클릭 시 파일 이동은 별도 핸들러에서 처리
        if (e.target.classList.contains('location')) return;

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
        // .location 클릭 시 파일 이동은 별도 핸들러에서 처리
        if (e.target.classList.contains('location')) return;

        e.stopPropagation();
        state.selectedTest = state.selectedTest === el.dataset.test ? null : el.dataset.test;
        saveState();
        renderAll();
      });
    });

    // 파일 위치 클릭 시 이동
    container.querySelectorAll('.location[data-file]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({
          type: 'goToLocation',
          filePath: el.dataset.file,
          lineNumber: parseInt(el.dataset.line) || 1
        });
      });
    });
  }

  footer.textContent = passedTests + '/' + totalTests + ' passed';
}

// 렌더링: Traces
function renderTraces() {
  const { suiteMap } = parseData();
  const container = document.getElementById('traceList');
  const breadcrumb = document.getElementById('tracesBreadcrumb');
  const footer = document.getElementById('traceFooter');

  if (!state.selectedTest) {
    breadcrumb.innerHTML = '';
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
    breadcrumb.innerHTML = '';
    container.innerHTML = '<div class="empty-message">Select a test to see traces</div>';
    footer.textContent = 'Select a test';
    return;
  }

  // 브레드크럼 업데이트: suite > test 표시 (평문)
  breadcrumb.innerHTML = '› <span class="breadcrumb-value">' + escapeHtml(suiteName) + '</span>' +
    ' › <span class="breadcrumb-value">' + escapeHtml(testName) + '</span>';

  // 에러 메시지 표시
  let errorHtml = '';
  if (testResult.status === 'fail' && testResult.error) {
    errorHtml = '<div class="error-message">' +
      '<strong>Error:</strong> ' + escapeHtml(testResult.error.message) +
    '</div>';
  }

  const traces = testResult.traces;
  if (traces.length === 0) {
    container.innerHTML = errorHtml + '<div class="empty-message">No traces in this test</div>';
    footer.textContent = '0 traces';
    return;
  }

  // 하이라이트: 선택된 key와 일치하는 trace에 highlighted 클래스 추가
  let highlightedCount = 0;
  container.innerHTML = errorHtml + traces.map(t => {
    const fileName = t.filePath ? t.filePath.split('/').pop() : '?';
    const valueStr = JSON.stringify(t.value, null, 2);
    const isHighlighted = state.selectedKey && t.key === state.selectedKey;
    if (isHighlighted) highlightedCount++;

    return '<div class="trace-item' + (isHighlighted ? ' highlighted' : '') + '">' +
      '<div class="trace-header">' +
        '<span class="trace-key" data-key="' + escapeAttr(t.key) + '" title="Filter by this key">' + escapeHtml(t.key) + '<span class="trace-key-filter">⏎</span></span>' +
        '<span class="trace-location" data-file="' + escapeAttr(t.filePath) + '" data-line="' + t.lineNumber + '">' + escapeHtml(fileName) + ':' + t.lineNumber + '</span>' +
      '</div>' +
      '<div class="trace-value">' + escapeHtml(valueStr) + '</div>' +
    '</div>';
  }).join('');

  // key 클릭 시 필터링
  container.querySelectorAll('.trace-key[data-key]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      // 이미 선택된 key면 해제, 아니면 선택
      state.selectedKey = state.selectedKey === key ? null : key;
      saveState();
      renderAll();
    });
  });

  // location 클릭 시 파일로 이동
  container.querySelectorAll('.trace-location[data-file]').forEach(el => {
    el.addEventListener('click', () => {
      vscode.postMessage({
        type: 'goToLocation',
        filePath: el.dataset.file,
        lineNumber: parseInt(el.dataset.line)
      });
    });
  });

  // Footer에 전체 traces 수 + 하이라이트된 개수 표시
  if (state.selectedKey && highlightedCount > 0) {
    footer.textContent = highlightedCount + ' / ' + traces.length + ' traces';
  } else {
    footer.textContent = traces.length + ' traces';
  }
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
restorePanelSizes();
setupResizers();
renderAll();
vscode.postMessage({ type: 'ready' });
