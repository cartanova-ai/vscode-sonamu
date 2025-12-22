const vscode = acquireVsCodeApi();

// 상태 복원 (VSCode가 보관 중인 상태)
let state = vscode.getState() || {
  testResults: [],
  collapsedSuites: [],   // 닫힌 suite 이름
  expandedTests: [],     // 열린 "suite::testName" (기본 닫힘)
  expandedTraces: [],    // 열린 trace key
  followEnabled: true    // 에디터 클릭 시 트레이스 따라가기 (기본 켜짐)
};

function saveState() {
  vscode.setState(state);
}

// ============================================================================
// 유틸리티
// ============================================================================

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

function escapeId(str) {
  return str.replace(/[^a-zA-Z0-9-_]/g, '_');
}

function findTrace(suite, testName, traceIdx) {
  for (const result of state.testResults) {
    if (result.suiteName === suite && result.testName === testName) {
      return result.traces[traceIdx];
    }
  }
  return null;
}

// ============================================================================
// Lazy Rendering
// ============================================================================

/**
 * trace-content 엘리먼트에 JSON을 렌더링합니다 (아직 렌더링 안 된 경우에만)
 */
function renderTraceContentIfNeeded(contentEl) {
  if (contentEl.dataset.rendered) {
    return;
  }

  const item = contentEl.closest('.trace-item');
  if (!item) {
    return;
  }

  const { suite, testName, traceIdx } = item.dataset;
  const trace = findTrace(suite, testName, parseInt(traceIdx));
  if (trace) {
    contentEl.innerHTML = '<div class="json-viewer">' + renderJsonValue(trace.value) + '</div>';
    contentEl.dataset.rendered = 'true';
  }
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

// ============================================================================
// Follow 버튼
// ============================================================================

function updateFollowButton() {
  const btn = document.getElementById('follow-btn');
  if (btn) {
    btn.classList.toggle('active', state.followEnabled);
  }
}

function toggleFollow() {
  state.followEnabled = !state.followEnabled;
  updateFollowButton();
  saveState();
  vscode.postMessage({ type: 'followStateChanged', enabled: state.followEnabled });
}

// ============================================================================
// Toggle 함수들
// ============================================================================

function toggleSuite(name) {
  const content = document.getElementById('suite-content-' + escapeId(name));
  const arrow = document.getElementById('suite-arrow-' + escapeId(name));
  if (!content || !arrow) {
    return;
  }

  const isExpanded = !content.classList.contains('collapsed');
  content.classList.toggle('collapsed', isExpanded);
  arrow.textContent = isExpanded ? '▶' : '▼';

  if (isExpanded) {
    if (!state.collapsedSuites.includes(name)) {
      state.collapsedSuites.push(name);
    }
  } else {
    state.collapsedSuites = state.collapsedSuites.filter(s => s !== name);
  }
  saveState();
}

function toggleTest(suite, testName) {
  const key = suite + '::' + testName;
  const id = escapeId(key);
  const content = document.getElementById('test-content-' + id);
  const arrow = document.getElementById('test-arrow-' + id);
  if (!content || !arrow) {
    return;
  }

  if (!state.expandedTests) {
    state.expandedTests = [];
  }

  const isExpanded = !content.classList.contains('collapsed');
  content.classList.toggle('collapsed', isExpanded);
  arrow.textContent = isExpanded ? '▶' : '▼';

  if (isExpanded) {
    state.expandedTests = state.expandedTests.filter(t => t !== key);
  } else {
    if (!state.expandedTests.includes(key)) {
      state.expandedTests.push(key);
    }
  }
  saveState();
}

function toggleTrace(suite, testName, traceKey, traceAt, traceIdx) {
  const stateKey = suite + '::' + testName + '::' + traceKey + '::' + traceAt + '::' + traceIdx;
  const id = escapeId(stateKey);
  const content = document.getElementById('trace-content-' + id);
  const arrow = document.getElementById('trace-arrow-' + id);
  if (!content || !arrow) {
    return;
  }

  const isExpanded = !content.classList.contains('collapsed');

  if (isExpanded) {
    content.classList.add('collapsed');
    arrow.classList.remove('expanded');
    state.expandedTraces = state.expandedTraces.filter(t => t !== stateKey);
  } else {
    renderTraceContentIfNeeded(content);
    content.classList.remove('collapsed');
    arrow.classList.add('expanded');
    if (!state.expandedTraces.includes(stateKey)) {
      state.expandedTraces.push(stateKey);
    }
  }
  saveState();
}

function goToLocation(filePath, lineNumber) {
  vscode.postMessage({ type: 'goToLocation', filePath, lineNumber });
}

// ============================================================================
// Expand/Collapse All
// ============================================================================

function expandAll() {
  // 모든 suite 펼치기
  document.querySelectorAll('.suite-content').forEach(el => {
    el.classList.remove('collapsed');
  });
  document.querySelectorAll('.suite-arrow').forEach(el => {
    el.textContent = '▼';
  });
  state.collapsedSuites = [];

  // 모든 test 펼치기
  state.expandedTests = [];
  document.querySelectorAll('.test-group').forEach(el => {
    const { suite, testName } = el.dataset;
    if (suite && testName) {
      state.expandedTests.push(suite + '::' + testName);
    }
  });
  document.querySelectorAll('.test-content').forEach(el => {
    el.classList.remove('collapsed');
  });
  document.querySelectorAll('.test-arrow').forEach(el => {
    el.textContent = '▼';
  });

  // 모든 trace 펼치기
  state.expandedTraces = [];
  document.querySelectorAll('.trace-item').forEach(item => {
    const { suite, testName, traceKey, traceAt, traceIdx } = item.dataset;
    if (suite && testName && traceKey && traceAt && traceIdx) {
      state.expandedTraces.push(suite + '::' + testName + '::' + traceKey + '::' + traceAt + '::' + traceIdx);
    }

    const content = item.querySelector('.trace-content');
    const arrow = item.querySelector('.trace-arrow');
    if (content) {
      renderTraceContentIfNeeded(content);
      content.classList.remove('collapsed');
    }
    if (arrow) {
      arrow.classList.add('expanded');
    }
  });

  saveState();
}

function collapseAll() {
  // 모든 suite 접기
  state.collapsedSuites = [];
  document.querySelectorAll('.suite-group').forEach(el => {
    const { suite } = el.dataset;
    if (suite) {
      state.collapsedSuites.push(suite);
    }
  });
  document.querySelectorAll('.suite-content').forEach(el => {
    el.classList.add('collapsed');
  });
  document.querySelectorAll('.suite-arrow').forEach(el => {
    el.textContent = '▶';
  });

  // 모든 test 접기
  state.expandedTests = [];
  document.querySelectorAll('.test-content').forEach(el => {
    el.classList.add('collapsed');
  });
  document.querySelectorAll('.test-arrow').forEach(el => {
    el.textContent = '▶';
  });

  // 모든 trace 접기
  state.expandedTraces = [];
  document.querySelectorAll('.trace-content').forEach(el => {
    el.classList.add('collapsed');
  });
  document.querySelectorAll('.trace-arrow').forEach(el => {
    el.classList.remove('expanded');
  });

  saveState();
}

// ============================================================================
// 렌더링
// ============================================================================

function updateStats(suiteCount, testCount, traceCount) {
  const stats = document.getElementById('stats');
  if (stats) {
    stats.textContent = suiteCount + ' suites · ' + testCount + ' tests · ' + traceCount + ' traces';
  }
}

function renderTestResults(testResults) {
  // Suite > Test 구조로 그룹화
  const suiteMap = new Map();
  let totalTests = 0;
  let totalTraces = 0;

  for (const result of testResults) {
    const suiteName = result.suiteName || '(no suite)';
    const testName = result.testName || '(no test)';

    if (!suiteMap.has(suiteName)) {
      suiteMap.set(suiteName, { testMap: new Map(), suiteFilePath: result.suiteFilePath });
    }
    const suiteData = suiteMap.get(suiteName);
    suiteData.testMap.set(testName, result);
    totalTraces += result.traces.length;
  }

  for (const suiteData of suiteMap.values()) {
    totalTests += suiteData.testMap.size;
  }

  updateStats(suiteMap.size, totalTests, totalTraces);

  if (testResults.length === 0) {
    document.getElementById('traces-container').innerHTML =
      '<div class="empty">테스트를 실행하면 trace가 여기에 표시됩니다.</div>';
    return;
  }

  let html = '';

  for (const [suiteName, suiteData] of suiteMap) {
    const testMap = suiteData.testMap;
    const suiteTestCount = testMap.size;
    let suiteTraceCount = 0;
    for (const result of testMap.values()) {
      suiteTraceCount += result.traces.length;
    }

    const suiteExpanded = !state.collapsedSuites.includes(suiteName);
    const suiteId = escapeId(suiteName);
    const testFileName = suiteData.suiteFilePath ? suiteData.suiteFilePath.split('/').pop() : null;

    html += '<div class="suite-group" data-suite="' + escapeAttr(suiteName) + '">';
    html += '<div class="suite-header" onclick="toggleSuite(\'' + escapeAttr(suiteName) + '\')">';
    html += '<span class="arrow suite-arrow" id="suite-arrow-' + suiteId + '">' + (suiteExpanded ? '▼' : '▶') + '</span>';
    html += '<span class="suite-name">' + escapeHtml(suiteName) + '</span>';
    if (testFileName && suiteData.suiteFilePath) {
      html += '<span class="suite-file" onclick="event.stopPropagation(); goToLocation(\'' + escapeAttr(suiteData.suiteFilePath) + '\', 1)">' + escapeHtml(testFileName) + '</span>';
    }
    html += '<span class="suite-count">' + suiteTestCount + ' tests · ' + suiteTraceCount + ' traces</span>';
    html += '</div>';
    html += '<div class="suite-content' + (suiteExpanded ? '' : ' collapsed') + '" id="suite-content-' + suiteId + '">';

    for (const [testName, result] of testMap) {
      const testKey = suiteName + '::' + testName;
      const testExpanded = state.expandedTests?.includes(testKey) ?? false;
      const testId = escapeId(testKey);
      const testTraces = result.traces;

      html += '<div class="test-group" data-suite="' + escapeAttr(suiteName) + '" data-test-name="' + escapeAttr(testName) + '">';
      html += '<div class="test-header" onclick="toggleTest(\'' + escapeAttr(suiteName) + '\', \'' + escapeAttr(testName) + '\')">';
      html += '<span class="arrow test-arrow" id="test-arrow-' + testId + '">' + (testExpanded ? '▼' : '▶') + '</span>';
      html += '<span class="test-name">' + escapeHtml(testName) + '</span>';
      if (result.testFilePath && result.testLine) {
        html += '<span class="test-line" onclick="event.stopPropagation(); goToLocation(\'' + escapeAttr(result.testFilePath) + '\', ' + result.testLine + ')">:' + result.testLine + '</span>';
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
        const traceStateKey = suiteName + '::' + testName + '::' + trace.key + '::' + trace.at + '::' + traceIdx;
        const traceExpanded = state.expandedTraces.includes(traceStateKey);
        const traceId = escapeId(traceStateKey);

        // data attribute로 모든 정보 저장
        html += '<div class="trace-item" id="item-' + traceId + '"';
        html += ' data-suite="' + escapeAttr(suiteName) + '"';
        html += ' data-test-name="' + escapeAttr(testName) + '"';
        html += ' data-trace-key="' + escapeAttr(trace.key) + '"';
        html += ' data-trace-at="' + trace.at + '"';
        html += ' data-trace-idx="' + traceIdx + '"';
        html += ' data-filepath="' + escapeAttr(trace.filePath) + '"';
        html += ' data-line="' + trace.lineNumber + '"';
        html += '>';

        html += '<div class="trace-header" onclick="toggleTrace(\'' + escapeAttr(suiteName) + '\', \'' + escapeAttr(testName) + '\', \'' + escapeAttr(trace.key) + '\', \'' + trace.at + '\', ' + traceIdx + ')">';
        html += '<span class="arrow trace-arrow' + (traceExpanded ? ' expanded' : '') + '" id="trace-arrow-' + traceId + '">▶</span>';
        html += '<span class="key">' + escapeHtml(trace.key) + '</span>';
        html += '<span class="location-link" onclick="event.stopPropagation(); goToLocation(\'' + escapeAttr(trace.filePath) + '\', ' + trace.lineNumber + ')">' + escapeHtml(fileName) + ':' + trace.lineNumber + '</span>';
        html += '<span class="time">' + time + '</span>';
        html += '</div>';

        if (traceExpanded) {
          html += '<div class="trace-content" id="trace-content-' + traceId + '" data-rendered="true">';
          html += '<div class="json-viewer">' + renderJsonValue(trace.value) + '</div>';
          html += '</div>';
        } else {
          html += '<div class="trace-content collapsed" id="trace-content-' + traceId + '"></div>';
        }
        html += '</div>';
      }

      html += '</div></div>';
    }

    html += '</div></div>';
  }

  document.getElementById('traces-container').innerHTML = '<div class="traces">' + html + '</div>';
}

// ============================================================================
// 메시지 핸들러
// ============================================================================

window.addEventListener('message', (event) => {
  const message = event.data;

  if (message.type === 'updateTestResults') {
    state.testResults = message.testResults || [];
    saveState();
    renderTestResults(state.testResults);
  }

  if (message.type === 'focusKey') {
    focusTracesByKey(message.key);
  }

  if (message.type === 'focusTest') {
    focusTest(message.suiteName, message.testName);
  }
});

function focusTracesByKey(key) {
  const items = document.querySelectorAll('.trace-item');
  let firstMatch = null;

  // 기존 하이라이트 제거
  document.querySelectorAll('.trace-item.highlight').forEach(el => {
    el.classList.remove('highlight');
  });

  for (const item of items) {
    if (item.dataset.traceKey !== key) {
      continue;
    }
    if (!firstMatch) {
      firstMatch = item;
    }

    // 부모 suite/test 열기
    expandParents(item);

    // trace 열기
    const content = item.querySelector('.trace-content');
    const arrow = item.querySelector('.trace-arrow');
    if (content) {
      renderTraceContentIfNeeded(content);
      content.classList.remove('collapsed');

      const { suite, testName, traceKey, traceAt, traceIdx } = item.dataset;
      const stateKey = suite + '::' + testName + '::' + traceKey + '::' + traceAt + '::' + traceIdx;
      if (!state.expandedTraces.includes(stateKey)) {
        state.expandedTraces.push(stateKey);
      }
    }
    if (arrow) {
      arrow.classList.add('expanded');
    }

    item.classList.add('highlight');
  }

  saveState();

  if (firstMatch) {
    firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function focusTest(suiteName, testName) {
  const testKey = suiteName + '::' + testName;
  const testId = escapeId(testKey);
  const testContent = document.getElementById('test-content-' + testId);
  const testArrow = document.getElementById('test-arrow-' + testId);

  if (!testContent) {
    return;
  }

  // 기존 하이라이트 제거
  document.querySelectorAll('.test-group.highlight').forEach(el => {
    el.classList.remove('highlight');
  });

  // 부모 suite 열기
  expandParents(testContent);

  // test 펼치기
  testContent.classList.remove('collapsed');
  if (testArrow) {
    testArrow.textContent = '▼';
  }

  if (!state.expandedTests) {
    state.expandedTests = [];
  }
  if (!state.expandedTests.includes(testKey)) {
    state.expandedTests.push(testKey);
  }

  saveState();

  const testGroup = testContent.closest('.test-group');
  if (testGroup) {
    testGroup.classList.add('highlight');
    testGroup.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function expandParents(element) {
  let parent = element.parentElement;
  while (parent) {
    if (parent.classList.contains('suite-content')) {
      parent.classList.remove('collapsed');
      const suiteGroup = parent.closest('.suite-group');
      const suiteName = suiteGroup?.dataset.suite;
      if (suiteName) {
        const arrow = document.getElementById('suite-arrow-' + escapeId(suiteName));
        if (arrow) {
          arrow.textContent = '▼';
        }
        state.collapsedSuites = state.collapsedSuites.filter(s => s !== suiteName);
      }
    }
    if (parent.classList.contains('test-content')) {
      parent.classList.remove('collapsed');
      const testGroup = parent.closest('.test-group');
      const { suite, testName } = testGroup?.dataset || {};
      if (suite && testName) {
        const testKey = suite + '::' + testName;
        const arrow = document.getElementById('test-arrow-' + escapeId(testKey));
        if (arrow) {
          arrow.textContent = '▼';
        }
        if (!state.expandedTests) {
          state.expandedTests = [];
        }
        if (!state.expandedTests.includes(testKey)) {
          state.expandedTests.push(testKey);
        }
      }
    }
    parent = parent.parentElement;
  }
}

// ============================================================================
// 초기화
// ============================================================================

updateFollowButton();
if (state.testResults && state.testResults.length > 0) {
  renderTestResults(state.testResults);
}
