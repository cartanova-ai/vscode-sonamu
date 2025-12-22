import type { NaiteMessagingTypes } from "naite-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { vscode } from "./lib/vscode-api";

// ============================================================================
// 타입 정의
// ============================================================================

type AppState = {
  testResults: NaiteMessagingTypes.TestResult[];
  collapsedSuites: string[]; // 닫힌 suite 이름
  expandedTests: string[]; // 열린 "suite::testName" (기본 닫힘)
  expandedTraces: string[]; // 열린 trace key
  followEnabled: boolean; // 에디터 클릭 시 트레이스 따라가기 (기본 켜짐)
  searchQuery: string; // 검색어
  searchMode: boolean; // 검색 모드 활성화 여부
};

type MatchedTrace = {
  trace: NaiteMessagingTypes.NaiteTrace;
  traceIdx: number;
};

type SearchResultGroup = {
  suiteName: string;
  testName: string;
  result: NaiteMessagingTypes.TestResult;
  matchedTraces: MatchedTrace[];
};

// ============================================================================
// 유틸리티
// ============================================================================

function escapeId(str: string): string {
  return str.replace(/[^a-zA-Z0-9-_]/g, "_");
}

// ============================================================================
// JSON 렌더러
// ============================================================================

function JsonValue({ value }: { value: unknown }): JSX.Element {
  if (value === null) {
    return <span className="json-null">null</span>;
  }
  if (value === undefined) {
    return <span className="json-null">undefined</span>;
  }
  if (typeof value === "string") {
    return <span className="json-string">"{value}"</span>;
  }
  if (typeof value === "number") {
    return <span className="json-number">{value}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="json-boolean">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="json-bracket">[]</span>;
    }
    return (
      <>
        <span className="json-bracket">[</span>
        <div className="json-array">
          {value.map((v, i) => (
            <span key={i} className="json-item">
              <JsonValue value={v} />,
            </span>
          ))}
        </div>
        <span className="json-bracket">]</span>
      </>
    );
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return <span className="json-bracket">{"{}"}</span>;
    }
    return (
      <>
        <span className="json-bracket">{"{"}</span>
        <div className="json-object">
          {keys.map((k) => (
            <span key={k} className="json-item">
              <span className="json-key">"{k}"</span>:{" "}
              <JsonValue value={(value as Record<string, unknown>)[k]} />,
            </span>
          ))}
        </div>
        <span className="json-bracket">{"}"}</span>
      </>
    );
  }
  return <>{String(value)}</>;
}

// ============================================================================
// 메인 컴포넌트
// ============================================================================

export default function App() {
  // 상태 복원 (VSCode가 보관 중인 상태)
  const [state, setState] = useState<AppState>(() => {
    const savedState = vscode.getState() as Partial<AppState> | null;
    return {
      testResults: savedState?.testResults ?? [],
      collapsedSuites: savedState?.collapsedSuites ?? [],
      expandedTests: savedState?.expandedTests ?? [],
      expandedTraces: savedState?.expandedTraces ?? [],
      followEnabled: savedState?.followEnabled ?? true,
      searchQuery: "", // 검색어는 저장하지 않음
      searchMode: false, // 검색 모드도 저장하지 않음
    };
  });

  // 하이라이트된 trace/test 추적
  const [highlightedTraces, setHighlightedTraces] = useState<Set<string>>(new Set());
  const [highlightedTest, setHighlightedTest] = useState<string | null>(null);

  // 검색 관련 상태
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // ref로 DOM 접근
  const tracesContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 상태 저장
  const saveState = useCallback((newState: AppState) => {
    vscode.setState(newState);
  }, []);

  // 상태 변경 시 저장
  useEffect(() => {
    saveState(state);
  }, [state, saveState]);

  // ============================================================================
  // 메시지 핸들러
  // ============================================================================

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === "updateTestResults") {
        setState((prev) => {
          const newState = { ...prev, testResults: message.testResults || [] };
          saveState(newState);
          return newState;
        });
      }

      if (message.type === "focusKey") {
        focusTracesByKey(message.key);
      }

      if (message.type === "focusTest") {
        focusTest(message.suiteName, message.testName);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [saveState]);

  // ============================================================================
  // Toggle 함수들
  // ============================================================================

  const toggleSuite = (name: string) => {
    setState((prev) => {
      const isExpanded = !prev.collapsedSuites.includes(name);
      let newCollapsedSuites: string[];

      if (isExpanded) {
        newCollapsedSuites = [...prev.collapsedSuites, name];
      } else {
        newCollapsedSuites = prev.collapsedSuites.filter((s) => s !== name);
      }

      return { ...prev, collapsedSuites: newCollapsedSuites };
    });
  };

  const toggleTest = (suite: string, testName: string) => {
    const key = `${suite}::${testName}`;

    setState((prev) => {
      const isExpanded = prev.expandedTests.includes(key);
      let newExpandedTests: string[];

      if (isExpanded) {
        newExpandedTests = prev.expandedTests.filter((t) => t !== key);
      } else {
        newExpandedTests = [...prev.expandedTests, key];
      }

      return { ...prev, expandedTests: newExpandedTests };
    });
  };

  const toggleTrace = (
    suite: string,
    testName: string,
    traceKey: string,
    traceAt: string,
    traceIdx: number,
  ) => {
    const stateKey = `${suite}::${testName}::${traceKey}::${traceAt}::${traceIdx}`;

    setState((prev) => {
      const isExpanded = prev.expandedTraces.includes(stateKey);
      let newExpandedTraces: string[];

      if (isExpanded) {
        newExpandedTraces = prev.expandedTraces.filter((t) => t !== stateKey);
      } else {
        newExpandedTraces = [...prev.expandedTraces, stateKey];
      }

      return { ...prev, expandedTraces: newExpandedTraces };
    });
  };

  const goToLocation = (filePath: string, lineNumber: number) => {
    vscode.postMessage({ type: "goToLocation", filePath, lineNumber });
  };

  // ============================================================================
  // Follow 버튼
  // ============================================================================

  const toggleFollow = () => {
    setState((prev) => {
      const newFollowEnabled = !prev.followEnabled;
      vscode.postMessage({ type: "followStateChanged", enabled: newFollowEnabled });
      return { ...prev, followEnabled: newFollowEnabled };
    });
  };

  // ============================================================================
  // 검색 기능
  // ============================================================================

  const openSearch = () => {
    setState((prev) => ({ ...prev, searchMode: true }));
    setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select(); // 이전 검색어가 있으면 전체 선택
    }, 50);
  };

  const closeSearch = () => {
    setState((prev) => ({ ...prev, searchMode: false }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setState((prev) => ({ ...prev, searchQuery: value }));

    // 디바운싱
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, 100);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      closeSearch();
    }
  };

  // 전역 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F: 검색창 열기 또는 검색어 전체 선택
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        if (state.searchMode) {
          searchInputRef.current?.select();
        } else {
          openSearch();
        }
      }
      // Escape: 검색창 닫기 (검색창에 포커스 없어도)
      if (e.key === "Escape" && state.searchMode) {
        closeSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.searchMode]);

  // 스티키 상태 감지 - trace-header가 스티키일 때 그림자 표시
  useEffect(() => {
    let ticking = false;

    const updateStickyState = () => {
      const style = getComputedStyle(document.documentElement);
      const headerHeight = Number.parseInt(style.getPropertyValue("--header-height")) || 40;
      const suiteHeaderHeight =
        Number.parseInt(style.getPropertyValue("--suite-header-height")) || 34;
      const testHeaderHeight =
        Number.parseInt(style.getPropertyValue("--test-header-height")) || 34;
      const breadcrumbHeight = Number.parseInt(style.getPropertyValue("--breadcrumb-height")) || 28;

      const normalViewStickyTop = headerHeight + suiteHeaderHeight + testHeaderHeight - 3;
      const searchViewStickyTop = headerHeight + breadcrumbHeight - 2;

      const headers = document.querySelectorAll(".trace-header");
      for (const header of headers) {
        const rect = header.getBoundingClientRect();
        const isSearchResult = header.closest(".search-result-trace") !== null;
        const stickyTop = isSearchResult ? searchViewStickyTop : normalViewStickyTop;

        // 약간의 여유를 두고 판단 (1px)
        const isStuck = rect.top <= stickyTop + 1;
        header.classList.toggle("stuck", isStuck);
      }

      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateStickyState);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // 초기 상태 및 DOM 변경 후 업데이트
    requestAnimationFrame(updateStickyState);

    return () => window.removeEventListener("scroll", onScroll);
  }, [state.testResults, state.expandedTests, state.searchMode, debouncedQuery]);

  // ============================================================================
  // Collapse All
  // ============================================================================

  const collapseAll = () => {
    setState((prev) => {
      // 모든 suite 이름 수집
      const allSuites: string[] = [];
      for (const result of prev.testResults) {
        if (!allSuites.includes(result.suiteName)) {
          allSuites.push(result.suiteName);
        }
      }

      return {
        ...prev,
        collapsedSuites: allSuites,
        expandedTests: [],
        expandedTraces: [],
      };
    });
  };

  // ============================================================================
  // Focus 기능
  // ============================================================================

  const focusTracesByKey = (key: string) => {
    // 기존 하이라이트 제거
    setHighlightedTraces(new Set());
    setHighlightedTest(null);

    const matchingTraces: string[] = [];
    let firstMatchElement: Element | null = null;

    setState((prev) => {
      const newCollapsedSuites = [...prev.collapsedSuites];
      const newExpandedTests = [...prev.expandedTests];
      const newExpandedTraces = [...prev.expandedTraces];

      for (const result of prev.testResults) {
        for (let i = 0; i < result.traces.length; i++) {
          const trace = result.traces[i];
          if (trace.key === key) {
            const traceStateKey = `${result.suiteName}::${result.testName}::${trace.key}::${trace.at}::${i}`;
            const testKey = `${result.suiteName}::${result.testName}`;

            matchingTraces.push(traceStateKey);

            // 부모 suite 열기
            const suiteIdx = newCollapsedSuites.indexOf(result.suiteName);
            if (suiteIdx !== -1) {
              newCollapsedSuites.splice(suiteIdx, 1);
            }

            // 부모 test 열기
            if (!newExpandedTests.includes(testKey)) {
              newExpandedTests.push(testKey);
            }

            // trace 열기
            if (!newExpandedTraces.includes(traceStateKey)) {
              newExpandedTraces.push(traceStateKey);
            }
          }
        }
      }

      return {
        ...prev,
        collapsedSuites: newCollapsedSuites,
        expandedTests: newExpandedTests,
        expandedTraces: newExpandedTraces,
        searchMode: false, // 검색 모드 끄기 (검색어는 유지)
      };
    });

    // 하이라이트 적용 및 스크롤
    setTimeout(() => {
      setHighlightedTraces(new Set(matchingTraces));

      // 첫 번째 매칭 요소로 스크롤
      if (matchingTraces.length > 0) {
        const firstId = `item-${escapeId(matchingTraces[0])}`;
        firstMatchElement = document.getElementById(firstId);
        if (firstMatchElement) {
          firstMatchElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }

      // 2초 후 하이라이트 제거
      setTimeout(() => {
        setHighlightedTraces(new Set());
      }, 2000);
    }, 100);
  };

  const focusTest = (suiteName: string, testName: string) => {
    const testKey = `${suiteName}::${testName}`;

    // 기존 하이라이트 제거
    setHighlightedTraces(new Set());
    setHighlightedTest(null);

    setState((prev) => {
      const newCollapsedSuites = [...prev.collapsedSuites];
      const newExpandedTests = [...prev.expandedTests];

      // 부모 suite 열기
      const suiteIdx = newCollapsedSuites.indexOf(suiteName);
      if (suiteIdx !== -1) {
        newCollapsedSuites.splice(suiteIdx, 1);
      }

      // test 펼치기
      if (!newExpandedTests.includes(testKey)) {
        newExpandedTests.push(testKey);
      }

      return {
        ...prev,
        collapsedSuites: newCollapsedSuites,
        expandedTests: newExpandedTests,
        searchMode: false, // 검색 모드 끄기 (검색어는 유지)
      };
    });

    // 하이라이트 적용 및 스크롤
    setTimeout(() => {
      setHighlightedTest(testKey);

      const testId = `test-${escapeId(testKey)}`;
      const testElement = document.getElementById(testId);
      if (testElement) {
        testElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      // 2초 후 하이라이트 제거
      setTimeout(() => {
        setHighlightedTest(null);
      }, 2000);
    }, 100);
  };

  // ============================================================================
  // 검색 필터링 (퍼지 서치)
  // ============================================================================

  // 퍼지 매칭: 각 문자가 순서대로 존재하는지 확인하고 매칭 인덱스 반환
  type FuzzyMatch = { matched: boolean; indices: number[]; score: number };

  const fuzzyMatch = (text: string, query: string): FuzzyMatch => {
    if (!query) return { matched: true, indices: [], score: 0 };

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const indices: number[] = [];
    let queryIdx = 0;
    let consecutiveBonus = 0;
    let lastMatchIdx = -1;

    for (let i = 0; i < lowerText.length && queryIdx < lowerQuery.length; i++) {
      if (lowerText[i] === lowerQuery[queryIdx]) {
        indices.push(i);
        if (lastMatchIdx === i - 1) {
          consecutiveBonus += 10;
        }
        lastMatchIdx = i;
        queryIdx++;
      }
    }

    const matched = queryIdx === lowerQuery.length;
    const score = matched ? 100 + consecutiveBonus : 0;

    return { matched, indices, score };
  };

  // trace가 검색어와 매칭되는지 확인 (key만 검색)
  const traceMatchesQuery = (trace: NaiteMessagingTypes.NaiteTrace, query: string): boolean => {
    if (!query) return true;
    return fuzzyMatch(trace.key, query).matched;
  };

  // 퍼지 매칭 결과로 하이라이트된 텍스트 생성
  const renderHighlightedText = (text: string, query: string): JSX.Element => {
    if (!query) return <>{text}</>;

    const { matched, indices } = fuzzyMatch(text, query);
    if (!matched || indices.length === 0) return <>{text}</>;

    const result: JSX.Element[] = [];
    let lastIdx = 0;

    for (const idx of indices) {
      if (idx > lastIdx) {
        result.push(<span key={`t-${lastIdx}`}>{text.slice(lastIdx, idx)}</span>);
      }
      result.push(
        <span key={`h-${idx}`} className="fuzzy-match">
          {text[idx]}
        </span>,
      );
      lastIdx = idx + 1;
    }

    if (lastIdx < text.length) {
      result.push(<span key={`t-${lastIdx}`}>{text.slice(lastIdx)}</span>);
    }

    return <>{result}</>;
  };

  // ============================================================================
  // 렌더링 데이터 준비
  // ============================================================================

  // Suite > Test 구조로 그룹화
  const suiteMap = new Map<
    string,
    { testMap: Map<string, NaiteMessagingTypes.TestResult>; suiteFilePath?: string }
  >();
  let totalTests = 0;
  let totalTraces = 0;

  for (const result of state.testResults) {
    const suiteName = result.suiteName || "(no suite)";
    const testName = result.testName || "(no test)";

    if (!suiteMap.has(suiteName)) {
      suiteMap.set(suiteName, { testMap: new Map(), suiteFilePath: result.suiteFilePath });
    }
    const suiteData = suiteMap.get(suiteName)!;
    suiteData.testMap.set(testName, result);
    totalTraces += result.traces.length;
  }

  for (const suiteData of suiteMap.values()) {
    totalTests += suiteData.testMap.size;
  }

  // 검색 결과를 테스트 케이스별로 그룹핑 (useMemo로 캐싱)
  const { searchResultGroups, matchCount } = useMemo(() => {
    const groups: SearchResultGroup[] = [];
    let count = 0;

    if (debouncedQuery) {
      for (const result of state.testResults) {
        const suiteName = result.suiteName || "(no suite)";
        const testName = result.testName || "(no test)";
        const matchedTraces: MatchedTrace[] = [];

        result.traces.forEach((trace, traceIdx) => {
          if (traceMatchesQuery(trace, debouncedQuery)) {
            matchedTraces.push({ trace, traceIdx });
            count++;
          }
        });

        if (matchedTraces.length > 0) {
          groups.push({ suiteName, testName, result, matchedTraces });
        }
      }
    }

    return { searchResultGroups: groups, matchCount: count };
  }, [debouncedQuery, state.testResults]);

  // ============================================================================
  // 렌더링
  // ============================================================================

  return (
    <>
      <div className="header">
        {state.searchMode ? (
          // 검색 모드
          <>
            <div className="search-container">
              <svg
                className="search-icon"
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="7" cy="7" r="4.5" />
                <line x1="10.5" y1="10.5" x2="14" y2="14" strokeLinecap="round" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder="key 또는 value 검색..."
                value={state.searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
              />
              {state.searchQuery && <span className="search-count">{matchCount} matches</span>}
              <button
                type="button"
                className="search-close"
                onClick={closeSearch}
                title="검색 닫기"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                </svg>
              </button>
            </div>
            <div className="header-right">
              <button
                type="button"
                id="follow-btn"
                className={`header-btn icon-btn ${state.followEnabled ? "active" : ""}`}
                onClick={toggleFollow}
                title="에디터 클릭 시 트레이스 따라가기"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                >
                  <rect x="5.5" y="1.5" width="5" height="3" rx="0.5" />
                  <rect x="1.5" y="9.5" width="4" height="4" rx="0.5" />
                  <rect x="10.5" y="9.5" width="4" height="4" rx="0.5" />
                  <path d="M8 4.5v3.5M3.5 9.5V8h9v1.5" strokeLinecap="round" />
                </svg>
              </button>
              <button type="button" className="header-btn" onClick={collapseAll} title="모두 접기">
                접기
              </button>
            </div>
          </>
        ) : (
          // 일반 모드
          <>
            <div className="header-left">
              <span className="title">Traces</span>
              <span id="stats" className="stats">
                {suiteMap.size} suites · {totalTests} tests · {totalTraces} traces
              </span>
            </div>
            <div className="header-right">
              <button
                type="button"
                className="header-btn icon-btn"
                onClick={openSearch}
                title="검색 (key 또는 value)"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="7" cy="7" r="4.5" />
                  <line x1="10.5" y1="10.5" x2="14" y2="14" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                id="follow-btn"
                className={`header-btn icon-btn ${state.followEnabled ? "active" : ""}`}
                onClick={toggleFollow}
                title="에디터 클릭 시 트레이스 따라가기"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                >
                  <rect x="5.5" y="1.5" width="5" height="3" rx="0.5" />
                  <rect x="1.5" y="9.5" width="4" height="4" rx="0.5" />
                  <rect x="10.5" y="9.5" width="4" height="4" rx="0.5" />
                  <path d="M8 4.5v3.5M3.5 9.5V8h9v1.5" strokeLinecap="round" />
                </svg>
              </button>
              <button type="button" className="header-btn" onClick={collapseAll} title="모두 접기">
                접기
              </button>
            </div>
          </>
        )}
      </div>

      <div id="traces-container" ref={tracesContainerRef}>
        {state.testResults.length === 0 ? (
          <div className="empty">테스트를 실행하면 trace가 여기에 표시됩니다.</div>
        ) : state.searchMode && state.searchQuery ? (
          // 검색 모드: 테스트 케이스별 그룹
          <div className="search-results">
            {searchResultGroups.length === 0 ? (
              <div className="empty">검색 결과가 없습니다.</div>
            ) : (
              <>
                {searchResultGroups.map(({ suiteName, testName, result, matchedTraces }) => {
                  const groupKey = `${suiteName}::${testName}`;
                  return (
                    <div key={groupKey} className="search-result-item">
                      <div className="search-result-breadcrumb">
                        <span className="breadcrumb-title">
                          <span className="breadcrumb-suite">{suiteName}</span>
                          <span className="breadcrumb-separator">›</span>
                          <span className="breadcrumb-test">{testName}</span>
                        </span>
                        <span
                          className="breadcrumb-location"
                          onClick={() => goToLocation(result.testFilePath, result.testLine)}
                        >
                          {result.testFilePath.split("/").pop()}:{result.testLine}
                        </span>
                        <span className="breadcrumb-count">{matchedTraces.length}</span>
                      </div>
                      <div className="search-result-traces">
                        {matchedTraces.map(({ trace, traceIdx }) => {
                          const traceStateKey = `${suiteName}::${testName}::${trace.key}::${trace.at}::${traceIdx}`;
                          const traceExpanded = state.expandedTraces.includes(traceStateKey);
                          const traceId = escapeId(traceStateKey);
                          const fileName = trace.filePath.split("/").pop() || trace.filePath;
                          const time = new Date(trace.at).toLocaleTimeString("ko-KR", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false,
                          });

                          return (
                            <div key={traceStateKey} className="search-result-trace">
                              <div
                                className="trace-header"
                                onClick={() =>
                                  toggleTrace(suiteName, testName, trace.key, trace.at, traceIdx)
                                }
                              >
                                <span
                                  className={`arrow trace-arrow ${traceExpanded ? "expanded" : ""}`}
                                >
                                  ▶
                                </span>
                                <span className="key">
                                  {renderHighlightedText(trace.key, state.searchQuery)}
                                </span>
                                <span
                                  className="location-link"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    goToLocation(trace.filePath, trace.lineNumber);
                                  }}
                                >
                                  {fileName}:{trace.lineNumber}
                                </span>
                                <span className="time">{time}</span>
                              </div>
                              {traceExpanded && (
                                <div className="trace-content" id={`trace-content-${traceId}`}>
                                  <div className="json-viewer">
                                    <JsonValue value={trace.value} />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ) : (
          // 일반 모드: 계층 구조
          <div className="traces">
            {Array.from(suiteMap.entries()).map(([suiteName, suiteData]) => {
              const { testMap, suiteFilePath } = suiteData;
              const suiteTestCount = testMap.size;
              let suiteTraceCount = 0;
              for (const result of testMap.values()) {
                suiteTraceCount += result.traces.length;
              }

              const suiteExpanded = !state.collapsedSuites.includes(suiteName);
              const suiteId = escapeId(suiteName);
              const testFileName = suiteFilePath ? suiteFilePath.split("/").pop() : null;

              // 검색 모드에서 이 suite의 trace 중 매칭되는 것이 있는지 확인
              const hasSuiteMatchingTrace = state.searchQuery
                ? Array.from(testMap.values()).some((result) =>
                    result.traces.some((t) => traceMatchesQuery(t, state.searchQuery)),
                  )
                : true;

              return (
                <div
                  key={suiteName}
                  className={`suite-group ${state.searchQuery && !hasSuiteMatchingTrace ? "search-hidden" : ""}`}
                  data-suite={suiteName}
                >
                  <div className="suite-header" onClick={() => toggleSuite(suiteName)}>
                    <span className="arrow suite-arrow" id={`suite-arrow-${suiteId}`}>
                      {suiteExpanded ? "▼" : "▶"}
                    </span>
                    <span className="suite-name">{suiteName}</span>
                    {testFileName && suiteFilePath && (
                      <span
                        className="suite-file"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToLocation(suiteFilePath, 1);
                        }}
                      >
                        {testFileName}
                      </span>
                    )}
                    <span className="suite-count">
                      {suiteTestCount} tests · {suiteTraceCount} traces
                    </span>
                  </div>

                  <div
                    className={`suite-content ${suiteExpanded ? "" : "collapsed"}`}
                    id={`suite-content-${suiteId}`}
                  >
                    {Array.from(testMap.entries()).map(([testName, result]) => {
                      const testKey = `${suiteName}::${testName}`;
                      const testExpanded = state.expandedTests.includes(testKey);
                      const testId = escapeId(testKey);
                      const testTraces = result.traces;
                      const isTestHighlighted = highlightedTest === testKey;
                      // 검색 모드에서 이 테스트의 trace 중 매칭되는 것이 있는지 확인
                      const hasMatchingTrace = state.searchQuery
                        ? testTraces.some((t) => traceMatchesQuery(t, state.searchQuery))
                        : true;

                      return (
                        <div
                          key={testKey}
                          id={`test-${testId}`}
                          className={`test-group ${isTestHighlighted ? "highlight" : ""} ${state.searchQuery && !hasMatchingTrace ? "search-hidden" : ""}`}
                          data-suite={suiteName}
                          data-test-name={testName}
                        >
                          <div
                            className="test-header"
                            onClick={() => toggleTest(suiteName, testName)}
                          >
                            <span className="arrow test-arrow" id={`test-arrow-${testId}`}>
                              {testExpanded ? "▼" : "▶"}
                            </span>
                            <span className="test-name">{testName}</span>
                            {result.testFilePath && result.testLine && (
                              <span
                                className="test-line"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  goToLocation(result.testFilePath!, result.testLine!);
                                }}
                              >
                                :{result.testLine}
                              </span>
                            )}
                            <span className="test-count">{testTraces.length}</span>
                          </div>

                          <div
                            className={`test-content ${testExpanded ? "" : "collapsed"}`}
                            id={`test-content-${testId}`}
                          >
                            {testTraces.map((trace, traceIdx) => {
                              const time = new Date(trace.at).toLocaleTimeString("ko-KR", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                hour12: false,
                              });
                              const fileName = trace.filePath.split("/").pop() || trace.filePath;
                              const traceStateKey = `${suiteName}::${testName}::${trace.key}::${trace.at}::${traceIdx}`;
                              const traceExpanded = state.expandedTraces.includes(traceStateKey);
                              const traceId = escapeId(traceStateKey);
                              const isTraceHighlighted = highlightedTraces.has(traceStateKey);
                              const isSearchMatch = state.searchQuery
                                ? traceMatchesQuery(trace, state.searchQuery)
                                : true;

                              return (
                                <div
                                  key={traceStateKey}
                                  id={`item-${traceId}`}
                                  className={`trace-item ${isTraceHighlighted ? "highlight" : ""} ${state.searchQuery && isSearchMatch ? "search-match" : ""} ${state.searchQuery && !isSearchMatch ? "search-hidden" : ""}`}
                                  data-suite={suiteName}
                                  data-test-name={testName}
                                  data-trace-key={trace.key}
                                  data-trace-at={trace.at}
                                  data-trace-idx={traceIdx}
                                  data-filepath={trace.filePath}
                                  data-line={trace.lineNumber}
                                >
                                  <div
                                    className="trace-header"
                                    onClick={() =>
                                      toggleTrace(
                                        suiteName,
                                        testName,
                                        trace.key,
                                        trace.at,
                                        traceIdx,
                                      )
                                    }
                                  >
                                    <span
                                      className={`arrow trace-arrow ${traceExpanded ? "expanded" : ""}`}
                                      id={`trace-arrow-${traceId}`}
                                    >
                                      ▶
                                    </span>
                                    <span className="key">
                                      {state.searchQuery && isSearchMatch
                                        ? renderHighlightedText(trace.key, state.searchQuery)
                                        : trace.key}
                                    </span>
                                    <span
                                      className="location-link"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        goToLocation(trace.filePath, trace.lineNumber);
                                      }}
                                    >
                                      {fileName}:{trace.lineNumber}
                                    </span>
                                    <span className="time">{time}</span>
                                  </div>

                                  {traceExpanded && (
                                    <div className="trace-content" id={`trace-content-${traceId}`}>
                                      <div className="json-viewer">
                                        <JsonValue value={trace.value} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
