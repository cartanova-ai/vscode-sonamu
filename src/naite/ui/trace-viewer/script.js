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
    html += '<div class="suite-header" onclick="toggleSuite(\'' + escapeHtml(suiteName).replace(/'/g, "\\'") + '\')">';
    html += '<span class="arrow suite-arrow" id="suite-arrow-' + suiteId + '">' + (suiteExpanded ? '▼' : '▶') + '</span>';
    html += '<span class="suite-name">' + escapeHtml(suiteName) + '</span>';
    if (testFileName && suiteData.suiteFilePath) {
      html += '<span class="suite-file" onclick="event.stopPropagation(); goToLocation(\'' + escapeHtml(suiteData.suiteFilePath).replace(/'/g, "\\'") + '\', 1)">' + escapeHtml(testFileName) + '</span>';
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
      html += '<div class="test-header" onclick="toggleTest(\'' + escapeHtml(suiteName).replace(/'/g, "\\'") + '\', \'' + escapeHtml(testName).replace(/'/g, "\\'") + '\')">';
      html += '<span class="arrow test-arrow" id="test-arrow-' + testId + '">' + (testExpanded ? '▼' : '▶') + '</span>';
      html += '<span class="test-name">' + escapeHtml(testName) + '</span>';
      if (result.testFilePath && result.testLine) {
        html += '<span class="test-line" onclick="event.stopPropagation(); goToLocation(\'' + escapeHtml(result.testFilePath).replace(/'/g, "\\'") + '\', ' + result.testLine + ')">:' + result.testLine + '</span>';
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
        html += '<div class="trace-header" onclick="toggleTrace(\'' + escapeHtml(suiteName).replace(/'/g, "\\'") + '\', \'' + escapeHtml(testName).replace(/'/g, "\\'") + '\', \'' + escapeHtml(trace.key).replace(/'/g, "\\'") + '\', \'' + trace.at + '\', ' + traceIdx + ')">';
        html += '<span class="arrow' + (traceExpanded ? ' expanded' : '') + '" id="trace-arrow-' + traceId + '">▶</span>';
        html += '<span class="key">' + escapeHtml(trace.key) + '</span>';
        html += '<span class="location-link" onclick="event.stopPropagation(); goToLocation(\'' + escapeHtml(trace.filePath).replace(/'/g, "\\'") + '\', ' + trace.lineNumber + ')">' + escapeHtml(fileName) + ':' + trace.lineNumber + '</span>';
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
