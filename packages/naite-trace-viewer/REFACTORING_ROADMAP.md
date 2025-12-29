# naite-trace-viewer 리팩토링 로드맵

> 목표: "Claude 없이도 아무나 보고 바로 수정할 수 있는" 직관적인 React 앱

---

## 아키텍처 개요

### 이 앱이 하는 일

Sonamu 프레임워크에서 테스트 실행 시 `Naite.t("key", value)`로 기록된 트레이스 데이터를 VSCode 웹뷰에 트리 형태로 표시합니다.

### 전체 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VSCode Extension (packages/extension)                                      │
│                                                                             │
│  ┌─────────────────┐     ┌──────────────────┐                              │
│  │ Sonamu 테스트    │────▶│ 소켓 서버        │                              │
│  │ Naite.t() 호출   │     │ (트레이스 수집)   │                              │
│  └─────────────────┘     └────────┬─────────┘                              │
│                                   │                                         │
│                          postMessage (JSON)                                 │
│                                   │                                         │
└───────────────────────────────────│─────────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  naite-trace-viewer (이 앱 - WebView)                                       │
│                                                                             │
│  ┌──────────────────┐                                                      │
│  │ useVSCodeSync    │  "testResults" 메시지 수신                            │
│  │                  │  "focusKey" 메시지 수신 (에디터에서 키 클릭 시)         │
│  └────────┬─────────┘                                                      │
│           │ dispatch                                                        │
│           ▼                                                                 │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │ useTraceViewerState (중앙 상태 관리)                          │          │
│  │                                                               │          │
│  │  state = {                                                    │          │
│  │    testResults: TestResult[],     // 테스트 결과 데이터        │          │
│  │    collapsedSuites: Set<string>,  // 접힌 Suite               │          │
│  │    expandedTests: Set<string>,    // 펼쳐진 Test              │          │
│  │    expandedTraces: Set<string>,   // 펼쳐진 Trace             │          │
│  │    searchMode: boolean,           // 검색 모드 여부            │          │
│  │    searchQuery: string,           // 검색어                   │          │
│  │    followEnabled: boolean,        // 에디터 따라가기 토글       │          │
│  │    pendingHighlight: {...}        // 하이라이트 요청 (일회성)   │          │
│  │  }                                                            │          │
│  └──────────────────────────────────┬───────────────────────────┘          │
│                                     │                                       │
│           ┌─────────────────────────┼─────────────────────────┐            │
│           │                         │                         │            │
│           ▼                         ▼                         ▼            │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │    Header       │     │   NormalView    │     │   SearchView    │       │
│  │                 │     │                 │     │                 │       │
│  │ - 검색 입력      │     │ - Suite 목록    │     │ - 검색 결과      │       │
│  │ - Follow 토글   │     │   └─ Test 목록  │     │   플랫 리스트    │       │
│  │ - 모두 접기     │     │      └─ Trace   │     │                 │       │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 데이터 계층 구조

```
TestResult[] (state.testResults)
│
├─ TestResult
│   ├─ suiteName: "UserService"           // Suite 이름
│   ├─ suiteFilePath: "src/user.spec.ts"  // 파일 경로
│   ├─ testName: "should create user"     // Test 이름
│   ├─ testLine: 42                       // 테스트 라인 번호
│   └─ traces: Trace[]
│       ├─ { key: "input", value: {...}, at: "src/user.ts:15" }
│       ├─ { key: "result", value: {...}, at: "src/user.ts:28" }
│       └─ ...
│
├─ TestResult (같은 Suite의 다른 Test)
│   ├─ suiteName: "UserService"
│   ├─ testName: "should delete user"
│   └─ traces: [...]
│
└─ TestResult (다른 Suite)
    ├─ suiteName: "OrderService"
    └─ ...
```

### 주요 기능별 위치

| 기능 | 위치 | 설명 |
|------|------|------|
| **검색** | `features/search/` | 퍼지 매칭, 검색 결과 뷰 |
| **트리 렌더링** | `features/trace-tree/` | Suite > Test > Trace 컴포넌트 |
| **스티키 헤더** | `features/sticky-headers/` | 3단계 스티키 + 그림자 효과 |
| **VSCode 통신** | `features/vscode-sync/` | 메시지 수신/발신, 상태 저장 |
| **상태 관리** | `hooks/useTraceViewerState.ts` | useReducer 기반 중앙 상태 |
| **하이라이트** | `hooks/useHighlight.ts` | 포커스 시 2초 하이라이트 |
| **공통 UI** | `components/` | Header, ExpandArrow, JsonValue |
| **스타일** | `index.css` | 모든 CSS (섹션별 주석으로 구분) |

---

## 현재 폴더 구조 (기능 기반으로 변경 완료 ✅)

```
src/
├── features/
│   ├── trace-tree/       # Suite > Test > Trace 계층
│   ├── search/           # 검색 기능
│   ├── sticky-headers/   # 스티키 헤더 시스템
│   └── vscode-sync/      # VSCode 동기화
├── components/           # 재사용 UI (Header, ExpandArrow, JsonValue)
├── hooks/                # 앱 전반 훅 (useTraceViewerState, useHighlight, ...)
├── utils/                # 공용 유틸 (keys, formatters, escapeId)
├── types/
├── lib/
├── App.tsx
└── main.tsx
```

**효과:** "기능 X를 수정하려면?" → `features/X/` 폴더만 보면 됨

---

## 완료된 개선 과제

### 1. 폴더 구조 기능 기반 변경 ✅

### 2. 메시지 처리 로직 통합 ✅

**해결:**
- useTraceViewerState.ts의 FOCUS_KEY/FOCUS_TEST 액션에서 `pendingHighlight` 설정
- App.tsx는 `pendingHighlight` 감지 → 하이라이트 적용 → 초기화
- 기존 App.tsx의 중복 메시지 핸들러 제거

**효과:** "포커스 기능을 수정하려면?" → useTraceViewerState.ts만 보면 됨

### 3. ResizeObserver → 고정 높이 + ellipsis 방식으로 대체 ✅

**변경 내용:**
- useResizeObserverCSSVar 훅 삭제 (비일반적인 CSS-JS 통신 패턴)
- 모든 헤더에 고정 height + ellipsis 적용
- CSS 변수에 계산 방식 주석 추가

**효과:** 일반적인 CSS 패턴으로 단순화, 유지보수 용이

### 4. 상수 파일 통합 → 불필요 (스킵) ✅

**분석 결과:**
- 각 상수가 한 곳에서만 사용됨 (공유 안 함)
- 해당 로직 근처에 있는 게 더 직관적

### 5. 죽은 코드 제거 ✅

- stickyOffsets.ts 삭제 (미사용)
- StickyOffsets 타입 삭제

---

## 남은 개선 과제

### 6. App.tsx 책임 분리 ← **다음 작업**

**현재 상태 (167줄):**

| 구간 | 역할 | 줄 수 |
|------|------|-------|
| L11-41 | 훅 호출 (상태, 검색, 하이라이트, 키보드, 스티키) | 31 |
| L43-68 | 사이드이펙트 (pendingHighlight, scrollTarget) | 26 |
| L70-106 | 핸들러 정의 (토글, 검색) | 37 |
| L108-151 | JSX 렌더링 | 44 |
| L154-166 | calculateStats 함수 | 13 |

**분석:**
- 이미 많이 개선됨 (188줄 → 167줄)
- 훅들이 로직을 잘 분리하고 있음
- 핸들러들은 단순 dispatch 래퍼라 분리 가치 낮음

**결론:** 현재 상태로 충분. 추가 분리 불필요.

> 원칙: util 분리는 (1) 두 군데 이상에서 사용되거나, (2) 의미상 명확히 구분되거나, (3) 정말 클 때만.
> 직관이 엔지니어링보다 우선한다.

---

## 진행 상황

- [x] 1. 폴더 구조 기능 기반 변경
- [x] 2. 메시지 처리 통합
- [x] 3. ResizeObserver → 고정 높이 + ellipsis
- [x] 4. 상수 파일 통합 → 불필요 (스킵)
- [x] 5. 죽은 코드 제거
- [x] 6. App.tsx 책임 분리 → 현재 상태로 충분 (완료)

---

## 최종 평가

**목표 달성도:** ✅ 달성

"기능 X를 수정하려면?" 질문에 대한 답:
- 검색 기능 → `features/search/`
- 트레이스 트리 → `features/trace-tree/`
- 스티키 헤더 → `features/sticky-headers/`
- VSCode 동기화 → `features/vscode-sync/`
- 상태 관리 → `hooks/useTraceViewerState.ts`
- 하이라이트 → `hooks/useHighlight.ts`
