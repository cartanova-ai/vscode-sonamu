const vscode = acquireVsCodeApi();

// 상태 복원 (VSCode가 보관 중인 상태)
let state = vscode.getState() || {
  testResults: [],
  collapsedSuites: [],   // 닫힌 suite 이름
  expandedTests: [],     // 열린 "suite::testName" (기본 닫힘)
  expandedTraces: []     // 열린 trace key
};

function saveState() {
  vscode.setState(state);
}

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
    if (!state.collapsedSuites.includes(name)) {
      state.collapsedSuites.push(name);
    }
  } else {
    content.classList.remove('collapsed');
    arrow.textContent = '▼';
    state.collapsedSuites = state.collapsedSuites.filter(s => s !== name);
  }
  saveState();
}

function toggleTest(suite, testName) {
  const key = suite + '::' + testName;
  const id = escapeId(key);
  const content = document.getElementById('test-content-' + id);
  const arrow = document.getElementById('test-arrow-' + id);
  if (!content || !arrow) return;

  if (!state.expandedTests) state.expandedTests = [];

  const isExpanded = !content.classList.contains('collapsed');
  if (isExpanded) {
    content.classList.add('collapsed');
    arrow.textContent = '▶';
    state.expandedTests = state.expandedTests.filter(t => t !== key);
  } else {
    content.classList.remove('collapsed');
    arrow.textContent = '▼';
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
  if (!content || !arrow) return;

  const isExpanded = !content.classList.contains('collapsed');
  if (isExpanded) {
    content.classList.add('collapsed');
    arrow.classList.remove('expanded');
    state.expandedTraces = state.expandedTraces.filter(t => t !== stateKey);
  } else {
    // lazy rendering: 처음 열 때만 JSON 렌더링
    if (!content.dataset.rendered) {
      const trace = findTrace(suite, testName, traceIdx);
      if (trace) {
        content.innerHTML = '<div class="json-viewer">' + renderJsonValue(trace.value) + '</div>';
        content.dataset.rendered = 'true';
      }
    }
    content.classList.remove('collapsed');
    arrow.classList.add('expanded');
    if (!state.expandedTraces.includes(stateKey)) {
      state.expandedTraces.push(stateKey);
    }
  }
  saveState();
}

function findTrace(suite, testName, traceIdx) {
  for (const result of state.testResults) {
    if (result.suiteName === suite && result.testName === testName) {
      return result.traces[traceIdx];
    }
  }
  return null;
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
  state.collapsedSuites = [];

  // 모든 test 펼치기
  const testKeys = [];
  document.querySelectorAll('.test-header').forEach(el => {
    const onclick = el.getAttribute('onclick');
    const match = onclick && onclick.match(/toggleTest\('(.+?)', '(.+?)'\)/);
    if (match) {
      testKeys.push(match[1].replace(/\\'/g, "'") + '::' + match[2].replace(/\\'/g, "'"));
    }
  });
  state.expandedTests = testKeys;
  document.querySelectorAll('.test-content').forEach(el => {
    el.classList.remove('collapsed');
  });
  document.querySelectorAll('.test-arrow').forEach(el => {
    el.textContent = '▼';
  });

  // 모든 trace 펼치기 (lazy rendering 적용)
  const expandedList = [];
  document.querySelectorAll('.trace-content').forEach(el => {
    const traceId = el.id.replace('trace-content-', '');
    expandedList.push(traceId);

    // lazy rendering: 아직 렌더링 안 됐으면 렌더링
    if (!el.dataset.rendered) {
      // traceId에서 suite, testName, traceIdx 파싱
      const item = el.closest('.trace-item');
      if (item) {
        const onclick = item.querySelector('.trace-header').getAttribute('onclick');
        const match = onclick && onclick.match(/toggleTrace\('(.+?)', '(.+?)', '(.+?)', '(.+?)', (\d+)\)/);
        if (match) {
          const suite = match[1].replace(/\\'/g, "'");
          const testName = match[2].replace(/\\'/g, "'");
          const traceIdx = parseInt(match[5]);
          const trace = findTrace(suite, testName, traceIdx);
          if (trace) {
            el.innerHTML = '<div class="json-viewer">' + renderJsonValue(trace.value) + '</div>';
            el.dataset.rendered = 'true';
          }
        }
      }
    }
    el.classList.remove('collapsed');
  });
  state.expandedTraces = expandedList;
  document.querySelectorAll('.trace-item .arrow').forEach(el => {
    if (!el.classList.contains('suite-arrow') && !el.classList.contains('test-arrow')) {
      el.classList.add('expanded');
    }
  });
  saveState();
}

function collapseAll() {
  // 모든 suite 접기 (상태에 모든 suite 이름 추가)
  const suiteNames = [];
  document.querySelectorAll('.suite-content').forEach(el => {
    el.classList.add('collapsed');
    // suite-content-{escapedName} 형식이므로 data 속성으로 원래 이름 저장 필요
    // 대신 suite-header에서 가져옴
  });
  document.querySelectorAll('.suite-header').forEach(el => {
    const onclick = el.getAttribute('onclick');
    // toggleSuite('SuiteName') 형식에서 이름 추출
    const match = onclick && onclick.match(/toggleSuite\('(.+?)'\)/);
    if (match) {
      suiteNames.push(match[1].replace(/\\'/g, "'"));
    }
  });
  state.collapsedSuites = suiteNames;
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
  document.querySelectorAll('.trace-content').forEach(el => {
    el.classList.add('collapsed');
  });
  document.querySelectorAll('.trace-item .arrow').forEach(el => {
    if (!el.classList.contains('suite-arrow') && !el.classList.contains('test-arrow')) {
      el.classList.remove('expanded');
    }
  });
  state.expandedTraces = [];
  saveState();
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
  let html = '';

  for (const [suiteName, suiteData] of suiteMap) {
    const testMap = suiteData.testMap;
    const suiteTestCount = testMap.size;
    let suiteTraceCount = 0;
    for (const result of testMap.values()) {
      suiteTraceCount += result.traces.length;
    }

    const suiteExpanded = !state.collapsedSuites.includes(suiteName);  // 기본 열림
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
      const testExpanded = state.expandedTests?.includes(testKey) ?? false;  // 기본 닫힘
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
        const traceExpanded = state.expandedTraces.includes(traceStateKey);  // 기본 닫힘
        const traceId = escapeId(traceStateKey);

        html += '<div class="trace-item" id="item-' + traceId + '" data-filepath="' + escapeHtml(trace.filePath) + '" data-line="' + trace.lineNumber + '" data-key="' + escapeHtml(trace.key) + '">';
        html += '<div class="trace-header" onclick="toggleTrace(\'' + escapeHtml(suiteName).replace(/'/g, "\\'") + '\', \'' + escapeHtml(testName).replace(/'/g, "\\'") + '\', \'' + escapeHtml(trace.key).replace(/'/g, "\\'") + '\', \'' + trace.at + '\', ' + traceIdx + ')">';
        html += '<span class="arrow' + (traceExpanded ? ' expanded' : '') + '" id="trace-arrow-' + traceId + '">▶</span>';
        html += '<span class="key">' + escapeHtml(trace.key) + '</span>';
        html += '<span class="location-link" onclick="event.stopPropagation(); goToLocation(\'' + escapeHtml(trace.filePath).replace(/'/g, "\\'") + '\', ' + trace.lineNumber + ')">' + escapeHtml(fileName) + ':' + trace.lineNumber + '</span>';
        html += '<span class="time">' + time + '</span>';
        html += '</div>';
        // lazy rendering: 펼쳐진 상태면 JSON 렌더링, 아니면 빈 div
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

// 메시지 리스너
window.addEventListener('message', (event) => {
  const message = event.data;

  if (message.type === 'updateTestResults') {
    state.testResults = message.testResults || [];
    saveState();
    renderTestResults(state.testResults);
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
        // trace 내용 열기 (lazy rendering 적용)
        const traceId = item.id.replace('item-', '');
        const content = document.getElementById('trace-content-' + traceId);
        const arrow = document.getElementById('trace-arrow-' + traceId);
        if (content) {
          // lazy rendering
          if (!content.dataset.rendered) {
            const onclick = item.querySelector('.trace-header').getAttribute('onclick');
            const match = onclick && onclick.match(/toggleTrace\('(.+?)', '(.+?)', '(.+?)', '(.+?)', (\d+)\)/);
            if (match) {
              const suite = match[1].replace(/\\'/g, "'");
              const testName = match[2].replace(/\\'/g, "'");
              const traceIdx = parseInt(match[5]);
              const trace = findTrace(suite, testName, traceIdx);
              if (trace) {
                content.innerHTML = '<div class="json-viewer">' + renderJsonValue(trace.value) + '</div>';
                content.dataset.rendered = 'true';
              }
            }
          }
          content.classList.remove('collapsed');
        }
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

  if (message.type === 'focusKey') {
    // 해당 key의 모든 trace 찾아서 펼치기
    const items = document.querySelectorAll('.trace-item');
    let firstMatch = null;

    // 기존 하이라이트 제거
    document.querySelectorAll('.trace-item.highlight').forEach(el => {
      el.classList.remove('highlight');
    });

    for (const item of items) {
      if (item.dataset.key === message.key) {
        if (!firstMatch) firstMatch = item;

        // 부모 suite/test 열기
        let parent = item.parentElement;
        while (parent) {
          if (parent.classList.contains('suite-content')) {
            parent.classList.remove('collapsed');
            const suiteName = parent.id.replace('suite-content-', '');
            const arrow = document.getElementById('suite-arrow-' + suiteName);
            if (arrow) arrow.textContent = '▼';
            // state 업데이트
            state.collapsedSuites = state.collapsedSuites.filter(s => s !== suiteName);
          }
          if (parent.classList.contains('test-content')) {
            parent.classList.remove('collapsed');
            const testId = parent.id.replace('test-content-', '');
            const arrow = document.getElementById('test-arrow-' + testId);
            if (arrow) arrow.textContent = '▼';
            // state 업데이트: expandedTests에 추가
            if (!state.expandedTests) state.expandedTests = [];
            // testId에서 원래 키 복원 (onclick에서 파싱)
            const testHeader = parent.previousElementSibling;
            if (testHeader) {
              const onclick = testHeader.getAttribute('onclick');
              const match = onclick && onclick.match(/toggleTest\('(.+?)', '(.+?)'\)/);
              if (match) {
                const testKey = match[1].replace(/\\'/g, "'") + '::' + match[2].replace(/\\'/g, "'");
                if (!state.expandedTests.includes(testKey)) {
                  state.expandedTests.push(testKey);
                }
              }
            }
          }
          parent = parent.parentElement;
        }

        // trace 내용 열기 (lazy rendering 적용)
        const traceId = item.id.replace('item-', '');
        const content = document.getElementById('trace-content-' + traceId);
        const arrow = document.getElementById('trace-arrow-' + traceId);
        if (content) {
          // lazy rendering
          if (!content.dataset.rendered) {
            const onclick = item.querySelector('.trace-header').getAttribute('onclick');
            const match = onclick && onclick.match(/toggleTrace\('(.+?)', '(.+?)', '(.+?)', '(.+?)', (\d+)\)/);
            if (match) {
              const suite = match[1].replace(/\\'/g, "'");
              const testName = match[2].replace(/\\'/g, "'");
              const traceIdx = parseInt(match[5]);
              const trace = findTrace(suite, testName, traceIdx);
              if (trace) {
                content.innerHTML = '<div class="json-viewer">' + renderJsonValue(trace.value) + '</div>';
                content.dataset.rendered = 'true';
              }
            }
          }
          content.classList.remove('collapsed');
          // state 업데이트
          if (!state.expandedTraces.includes(traceId)) {
            state.expandedTraces.push(traceId);
          }
        }
        if (arrow) arrow.classList.add('expanded');

        // 하이라이트
        item.classList.add('highlight');
      }
    }

    saveState();

    // 첫 번째 매칭으로 스크롤
    if (firstMatch) {
      firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  if (message.type === 'focusTest') {
    // 해당 test case로 이동하고 펼치기 (trace는 닫힌 상태 유지)
    const testKey = message.suiteName + '::' + message.testName;
    const testId = escapeId(testKey);
    const testContent = document.getElementById('test-content-' + testId);
    const testArrow = document.getElementById('test-arrow-' + testId);

    if (!testContent) return;

    // 기존 하이라이트 제거
    document.querySelectorAll('.test-group.highlight').forEach(el => {
      el.classList.remove('highlight');
    });

    // 부모 suite 열기
    let parent = testContent.parentElement;
    while (parent) {
      if (parent.classList.contains('suite-content')) {
        parent.classList.remove('collapsed');
        const suiteName = parent.id.replace('suite-content-', '');
        const arrow = document.getElementById('suite-arrow-' + suiteName);
        if (arrow) arrow.textContent = '▼';
        state.collapsedSuites = state.collapsedSuites.filter(s => s !== suiteName);
      }
      parent = parent.parentElement;
    }

    // test 펼치기
    testContent.classList.remove('collapsed');
    if (testArrow) testArrow.textContent = '▼';

    // state 업데이트
    if (!state.expandedTests) state.expandedTests = [];
    if (!state.expandedTests.includes(testKey)) {
      state.expandedTests.push(testKey);
    }

    saveState();

    // test-group에 하이라이트
    const testGroup = testContent.closest('.test-group');
    if (testGroup) {
      testGroup.classList.add('highlight');
      testGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
});

// 초기화: 저장된 상태가 있으면 렌더링
if (state.testResults && state.testResults.length > 0) {
  renderTestResults(state.testResults);
}
