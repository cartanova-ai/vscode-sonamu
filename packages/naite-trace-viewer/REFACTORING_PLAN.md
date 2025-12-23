# naite-trace-viewer 리팩토링 계획

## 목표
- **동작 100% 동일 유지** (사용자가 차이를 느끼면 안 됨)
- 현대적이고 유지보수하기 쉬운 코드 구조
- 커스텀 훅으로 상태 관리 분리
- 현재 CSS 유지

---

## 현재 코드의 숨겨진 의도와 중요한 패턴

### 1. 스티키 오프셋 계산의 정밀한 조정 (매우 중요!)

```
header (40px) → suite (30px) → test (34px) → trace (28px)
```

각 레벨의 `top` 값에 **미세한 픽셀 보정**이 숨어있음:
- `suite.top = header + 6px` (6px 여백)
- `test.top = header + suite + 7px` (7px 여백)
- `trace.top = header + suite + test + 5px` (5px 여백)
- `searchBreadcrumb.top = header - 1px` (1px 겹침으로 틈 방지)
- `searchTrace.top = header + breadcrumb - 2px` (2px 조정)

**의도**: 스티키 헤더들이 겹치거나 틈이 생기지 않도록 정밀 조정. CSS와 JS의 값이 정확히 일치해야 함.

### 2. 토글 함수의 스티키 스크롤 보정

`toggleSuite`, `toggleTest`, `toggleTrace` 모두 동일한 패턴:
1. 접을 때(`willCollapse`) + 헤더 요소가 있을 때
2. 현재 헤더가 "stuck" 상태인지 확인 (top 위치 비교)
3. stuck 상태면: 상태 변경 → `requestAnimationFrame` → `scrollIntoView` → `scrollBy(-offset)`

**의도**: 스티키 상태에서 접으면 갑자기 스크롤이 점프하는 것을 방지. 부드럽게 헤더 위치로 조정.

### 3. 하이라이트의 비동기 처리

```tsx
// 상태 변경
setState(...)

// 100ms 후 하이라이트 적용 + 스크롤
setTimeout(() => {
  setHighlightedTraces(...)
  scrollIntoView()

  // 2000ms 후 하이라이트 제거
  setTimeout(() => {
    setHighlightedTraces(new Set())
  }, 2000)
}, 100)
```

**의도**:
- 100ms: DOM 업데이트(펼치기) 완료 대기
- 2000ms: 사용자가 하이라이트를 충분히 볼 시간

### 4. 검색의 디바운싱 (100ms)

```tsx
const [searchQuery, ...] = state  // 즉시 반영 (input value)
const [debouncedQuery, ...] = ...  // 100ms 후 반영 (실제 필터링)
```

**의도**: 타이핑 중 매 키 입력마다 필터링하면 버벅거림. 100ms 디바운스로 완충.

### 5. 검색 결과 그룹화의 메모이제이션

```tsx
const { searchResultGroups, matchCount } = useMemo(() => {
  // 비용이 큰 계산
}, [debouncedQuery, state.testResults])
```

**의도**: 테스트 결과가 많을 때 매 렌더마다 그룹핑하면 느림. 의존성이 변할 때만 재계산.

### 6. 이중 화살표 상태 (펼침/접힘)

- **Suite/Test**: `▼` (펼침) vs `▶` (접힘) - 텍스트로 표현
- **Trace**: `▶` + `.expanded` 클래스 (CSS `transform: rotate(90deg)`) - 애니메이션 적용

**불일치**: Suite/Test는 조건부 텍스트, Trace는 CSS 회전. 통일 필요.

### 7. ID 이스케이프 + 해시 패턴

```tsx
function escapeId(str) {
  let hash = djb2(str)  // 간단한 해시
  const safe = str.replace(/[^a-zA-Z0-9-_]/g, "_")
  return `${safe}_${hash.toString(36)}`
}
```

**의도**: 한글, 특수문자가 포함된 test/trace 이름도 안전한 DOM id로 변환. 해시로 충돌 방지.

### 8. VSCode 상태 저장 정책

저장하는 것:
- `testResults`, `collapsedSuites`, `expandedTests`, `expandedTraces`, `followEnabled`

저장하지 않는 것:
- `searchQuery`, `searchMode` (새로 열면 검색창 닫힌 상태로)

**의도**: 검색은 임시적, 트리 상태는 유지해야 사용성 좋음.

### 9. 메시지 핸들러의 상태 이중 저장

```tsx
if (message.type === "updateTestResults") {
  setState(prev => {
    const newState = { ...prev, testResults: message.testResults || [] }
    saveState(newState)  // 여기서도 저장
    return newState
  })
}
```

그런데 이미 `useEffect`에서도 저장함:
```tsx
useEffect(() => {
  saveState(state)
}, [state, saveState])
```

**이중 저장**: 의도적인지 불분명. useEffect만으로 충분할 것으로 보임.

### 10. Focus 기능의 부모 펼치기 로직

```tsx
// focusTracesByKey
for (const result of prev.testResults) {
  for (const trace of result.traces) {
    if (trace.key === key) {
      // 1. Suite 열기 (collapsedSuites에서 제거)
      // 2. Test 열기 (expandedTests에 추가)
      // 3. Trace 열기 (expandedTraces에 추가)
    }
  }
}
```

**의도**: 에디터에서 특정 키로 포커스할 때, 해당 트레이스까지 가는 모든 경로를 펼쳐야 보임.

### 11. CSS의 flex-shrink 우선순위

```css
.suite-name { flex-shrink: 1; }   /* 나중에 축소 */
.suite-file { flex-shrink: 10; }  /* 빨리 축소 */
.suite-count { flex-shrink: 999; } /* 가장 먼저 축소/사라짐 */
```

**의도**: 화면이 좁아질 때 덜 중요한 것부터 사라지게. UX 최적화.

### 12. 스티키 상태 감지 (scroll 이벤트)

```tsx
useEffect(() => {
  const onScroll = () => {
    requestAnimationFrame(() => {
      headers.forEach(h => h.classList.toggle("stuck", isStuck))
    })
  }
  window.addEventListener("scroll", onScroll, { passive: true })
}, [dependencies])
```

**의도**:
- `requestAnimationFrame`: 프레임당 한 번만 실행
- `passive: true`: 스크롤 성능 저하 방지
- `.stuck` 클래스: 스티키 상태일 때 그림자 표시

---

## 리팩토링 시 통일할 불일치 패턴

### 1. 화살표 렌더링 방식 통일
**현재**: Suite/Test는 조건부 텍스트(`▼`/`▶`), Trace는 CSS 회전
**통일안**: 모두 CSS 회전 방식으로 (애니메이션 일관성)

### 2. 토글 함수 패턴 통일
**현재**: `toggleSuite`, `toggleTest`, `toggleTrace` 각각 비슷한 스티키 보정 로직 중복
**통일안**: 공통 `createStickyToggle` 헬퍼 또는 커스텀 훅으로 추출

### 3. 시간 포맷팅 중복 제거
**현재**: trace 렌더링마다 `new Date(trace.at).toLocaleTimeString(...)` 호출
**통일안**: `formatTime(at: string)` 유틸 함수로 추출

### 4. 파일명 추출 중복 제거
**현재**: `filePath.split("/").pop()` 패턴 여러 곳에서 반복
**통일안**: `getFileName(filePath: string)` 유틸 함수로 추출

### 5. 상태 키 생성 패턴 통일
**현재**: 여러 곳에서 `${suite}::${test}::${key}::${at}::${idx}` 조합
**통일안**: `createTraceKey`, `createTestKey` 헬퍼 함수로 추출

### 6. 메시지 핸들러 이중 저장 정리
**현재**: `updateTestResults`에서 수동 저장 + useEffect 자동 저장
**통일안**: useEffect만 사용 (불필요한 수동 저장 제거)

---

## 날코딩 유산 → React스러운 구조로 전환

### 1. 펼침/접힘 상태 자료구조: 현재 방식 유지 + Set으로 개선

**현재 구조의 장점 (유지):**
```tsx
{
  collapsedSuites: string[];   // 닫힌 suite만 (기본 펼침)
  expandedTests: string[];     // 열린 test만 (기본 접힘)
  expandedTraces: string[];    // 열린 trace만 (기본 접힘)
}
```

이 구조가 좋은 이유:
- **저장 효율성**: 100개 suite 중 3개만 접혀있으면 3개만 저장
- **기본값이 도메인에 맞음**: Suite는 펼침, Test/Trace는 접힘이 자연스러움
- **VSCode 상태 직렬화에 유리**: 작은 데이터

**개선점: Array → Set (런타임에서만)**
```tsx
// 런타임 상태 (O(1) 조회)
type ExpansionState = {
  collapsedSuites: Set<string>;
  expandedTests: Set<string>;
  expandedTraces: Set<string>;
};

// 조회
const isSuiteExpanded = !state.collapsedSuites.has(name);
const isTestExpanded = state.expandedTests.has(key);

// 토글
const newSet = new Set(prev);
newSet.has(key) ? newSet.delete(key) : newSet.add(key);

// VSCode 저장 시 Array로 직렬화
vscode.setState({
  collapsedSuites: [...state.collapsedSuites],
  expandedTests: [...state.expandedTests],
  // ...
});

// 복원 시 Set으로 변환
collapsedSuites: new Set(saved?.collapsedSuites ?? [])
```

### 2. DOM ID 기반 로직 제거

**현재 (날코딩 유산):**
```tsx
// focusTracesByKey에서
const firstId = `item-${escapeId(matchingTraces[0])}`;
firstMatchElement = document.getElementById(firstId);
```

**새로운 구조:**
React ref를 사용하거나, 스크롤 타겟을 상태로 관리:
```tsx
const [scrollTarget, setScrollTarget] = useState<string | null>(null);

// 컴포넌트에서
useEffect(() => {
  if (scrollTarget && elementRef.current) {
    elementRef.current.scrollIntoView({ behavior: 'smooth' });
    setScrollTarget(null);
  }
}, [scrollTarget]);
```

### 3. Lazy Rendering 제거

**현재 (날코딩 유산):**
날코딩에서는 `renderTraceContentIfNeeded()`로 DOM을 나중에 채웠음.
React에서는 그냥 조건부 렌더링으로 해결됨:
```tsx
{expanded && <TraceContent value={trace.value} />}
```

React가 알아서 DOM을 만들고 제거함. 별도 lazy 로직 불필요.

### 4. 이벤트 핸들러에서 DOM 쿼리 제거

**현재:**
```tsx
const handleMessage = (event: MessageEvent) => {
  // ...
  focusTracesByKey(message.key);  // 내부에서 document.getElementById 사용
};
```

**새로운 구조:**
상태만 변경하고, 렌더링은 React에 맡김:
```tsx
const handleMessage = (event: MessageEvent) => {
  if (message.type === 'focusKey') {
    dispatch({ type: 'FOCUS_KEY', key: message.key });
  }
};
```

### 5. 클래스 토글 제거

**현재 (날코딩 유산):**
```tsx
header.classList.toggle("stuck", isStuck);
```

**새로운 구조:**
상태 기반 className:
```tsx
<div className={`trace-header ${isStuck ? 'stuck' : ''}`}>
```

단, 스크롤 기반 stuck 감지는 성능상 DOM API 사용이 불가피할 수 있음.
이 부분은 커스텀 훅으로 깔끔하게 분리.

---

## 리팩토링 후 디렉토리 구조

```
src/
├── main.tsx                      # 진입점 (변경 없음)
├── App.tsx                       # 루트 컴포넌트: 상태 초기화 + 뷰 선택
├── index.css                     # 전역 스타일 (변경 없음)
│
├── components/
│   ├── Header.tsx                # 헤더 (일반/검색 모드 공통)
│   ├── NormalView.tsx            # 일반 모드: Suite > Test > Trace 계층
│   ├── SearchView.tsx            # 검색 모드: 플랫 결과 리스트
│   ├── SuiteItem.tsx             # Suite 한 개 (헤더 + 접이식 내용)
│   ├── TestItem.tsx              # Test 한 개 (헤더 + 접이식 trace들)
│   ├── TraceItem.tsx             # Trace 한 개 (헤더 + JSON 내용)
│   ├── JsonValue.tsx             # JSON 값 재귀 렌더러
│   └── ExpandArrow.tsx           # 펼침/접힘 화살표 (통일된 애니메이션)
│
├── hooks/
│   ├── useTraceViewerState.ts    # 통합 상태 관리 (useReducer)
│   ├── useVSCodeSync.ts          # VSCode 상태 저장/복원 + 메시지
│   ├── useSearch.ts              # 검색어 + 디바운싱 + 퍼지 매칭
│   ├── useHighlight.ts           # 하이라이트 (2초 후 자동 제거)
│   ├── useKeyboardShortcuts.ts   # 전역 키보드 단축키
│   ├── useStickyState.ts         # 스크롤 기반 스티키 감지
│   └── useScrollIntoView.ts      # 스크롤 타겟 관리
│
├── utils/
│   ├── escapeId.ts               # DOM ID 안전 변환
│   ├── fuzzyMatch.ts             # 퍼지 매칭 알고리즘
│   ├── formatters.ts             # formatTime, getFileName 등
│   ├── keys.ts                   # createTestKey, createTraceKey
│   └── stickyOffsets.ts          # CSS 변수 기반 오프셋 계산
│
├── types/
│   └── index.ts                  # 모든 타입 정의
│
└── lib/
    ├── vscode-api.ts             # VSCode API (변경 없음)
    └── mock-data.ts              # 모의 데이터 (변경 없음)
```

---

## 단계별 작업 계획

### Phase 1: 기반 작업
1. **Vitest 설정** - `vitest.config.ts`, package.json 스크립트
2. **타입 정의** - `types/index.ts`에 타입 구조 정의
   ```tsx
   // 런타임 상태 (Set 사용)
   type TraceViewerState = {
     testResults: TestResult[];
     collapsedSuites: Set<string>;   // 닫힌 suite (기본 펼침)
     expandedTests: Set<string>;     // 열린 test (기본 접힘)
     expandedTraces: Set<string>;    // 열린 trace (기본 접힘)
     followEnabled: boolean;
     searchQuery: string;
     searchMode: boolean;
   };

   // VSCode 저장용 (Array로 직렬화)
   type PersistedState = {
     testResults: TestResult[];
     collapsedSuites: string[];
     expandedTests: string[];
     expandedTraces: string[];
     followEnabled: boolean;
   };
   ```

### Phase 2: 유틸리티 함수 (테스트 포함)
1. `utils/escapeId.ts` + `escapeId.test.ts`
2. `utils/fuzzyMatch.ts` + `fuzzyMatch.test.ts`
   - `fuzzyMatch(text, query)` → `{ matched, indices, score }`
   - `renderHighlightedText(text, query)` → JSX
3. `utils/formatters.ts`
   - `formatTime(isoString)` → "HH:mm:ss"
   - `getFileName(filePath)` → "file.ts"
4. `utils/keys.ts`
   - `createTestKey(suite, test)` → "suite::test"
   - `createTraceKey(suite, test, key, at, idx)` → 상태 키
5. `utils/stickyOffsets.ts`
   - CSS 변수 읽기 + 오프셋 계산 로직

### Phase 3: 커스텀 훅
1. **useTraceViewerState** (useReducer 기반)
   - 상태: `TraceViewerState`
   - 액션: `TOGGLE_SUITE`, `TOGGLE_TEST`, `TOGGLE_TRACE`, `COLLAPSE_ALL`
   - 액션: `SET_TEST_RESULTS`, `SET_FOLLOW`, `FOCUS_KEY`, `FOCUS_TEST`

2. **useVSCodeSync**
   - 초기 상태 복원 (`vscode.getState()`)
   - 상태 변경 시 자동 저장 (`vscode.setState()`)
   - 메시지 수신 → dispatch 연결
   - `goToLocation(file, line)` 발신

3. **useSearch**
   - `query`, `debouncedQuery`, `mode`
   - `openSearch()`, `closeSearch()`, `setQuery()`
   - 100ms 디바운싱

4. **useHighlight**
   - `highlightedTraces`, `highlightedTest`
   - `highlightTraces(keys)`, `highlightTest(key)`
   - 2초 후 자동 제거

5. **useKeyboardShortcuts**
   - Cmd/Ctrl+F → 검색 열기
   - ESC → 검색 닫기

6. **useStickyState**
   - 스크롤 이벤트 → `.stuck` 클래스 관리
   - `requestAnimationFrame` + passive listener

7. **useScrollIntoView**
   - `scrollTarget` 상태
   - 타겟 변경 시 자동 스크롤

### Phase 4: 컴포넌트 분리
1. **ExpandArrow** - 통일된 펼침/접힘 화살표
   ```tsx
   <ExpandArrow expanded={isExpanded} />
   // 항상 ▶ + CSS transform rotate
   ```

2. **JsonValue** - 현재 로직 그대로, 별도 파일

3. **TraceItem** - Trace 한 개
   - `expanded`, `onToggle`, `highlighted`, `searchQuery`
   - 스티키 헤더 + 조건부 JSON 내용

4. **TestItem** - Test 한 개 + 자식 Trace들
   - `expanded`, `onToggle`, `highlighted`

5. **SuiteItem** - Suite 한 개 + 자식 Test들
   - `expanded`, `onToggle`

6. **Header** - 일반/검색 모드 공통
   - 검색 입력, Follow 버튼, 접기 버튼
   - `mode`, `onSearch`, `onToggleFollow`, `onCollapseAll`

7. **NormalView** - Suite > Test > Trace 계층
8. **SearchView** - 플랫 검색 결과 리스트

### Phase 5: App.tsx 재구성
1. 훅들 조합 (useTraceViewerState → useVSCodeSync → ...)
2. Context Provider로 상태 공유 (prop drilling 최소화)
3. NormalView / SearchView 조건부 렌더링

### Phase 6: 검증 및 정리
1. `pnpm dev` 실행하여 시각적 확인
2. 모든 상호작용 테스트:
   - Suite/Test/Trace 토글
   - 스티키 상태에서 접기 → 스크롤 보정
   - 검색 (퍼지 매칭, 하이라이트)
   - Cmd+F, ESC
   - 위치 클릭 → goToLocation
   - focusKey, focusTest 동작
   - 하이라이트 2초 후 사라짐
   - 스티키 헤더 그림자
3. `pnpm test` 유틸 테스트 통과
4. 기존 App.tsx 삭제

---

## 테스트 (Vitest)

### 설정
- `vitest` 개발 의존성 추가
- `vitest.config.ts` 생성
- `package.json`에 `test` 스크립트 추가

### 테스트 대상 (유틸리티 함수)
```
src/utils/
├── escapeId.ts
│   └── escapeId.test.ts     # ID 이스케이프 테스트
├── fuzzyMatch.ts
│   └── fuzzyMatch.test.ts   # 퍼지 매칭 테스트
└── constants.ts             # 상수이므로 테스트 불필요
```

### 테스트 케이스 예시

**escapeId.test.ts**
- 영문/숫자만 있는 문자열 → 그대로 + 해시
- 특수문자 포함 → 제거 후 + 해시
- 동일 입력 → 동일 출력 (결정적)
- 빈 문자열 처리

**fuzzyMatch.test.ts**
- 완전 일치 → matched: true, 높은 score
- 부분 일치 → matched: true, indices 정확
- 연속 문자 보너스 → 높은 score
- 불일치 → matched: false
- 대소문자 무시 확인
- 빈 쿼리 처리

---

## 변경하지 않는 것들
- `index.css` - 모든 스타일 유지
- `vscode-api.ts` - VSCode 통신 로직
- `mock-data.ts` - 개발용 데이터
- `main.tsx` - 진입점
- `vite.config.ts` - 빌드 설정
- **모든 동작과 UI** - 100% 동일

---

## 코드 작성 원칙

### 컴포넌트
```tsx
// 간결한 함수형 컴포넌트
export function ComponentName({ prop1, prop2 }: Props) {
  // 훅 호출
  // 이벤트 핸들러 (필요시)
  // JSX 반환
}
```

### 훅
```tsx
// 단일 책임, 명확한 반환 타입
export function useHookName(params: Params): ReturnType {
  // 상태 선언
  // 효과 등록
  // 핸들러 정의
  // 반환
}
```

### 유틸리티
```tsx
// 순수 함수, 명확한 타입
export function utilName(input: InputType): OutputType {
  // 로직
}
```

---

## 예상 파일 개수
- **컴포넌트**: 7개
- **훅**: 6개
- **유틸리티**: 3개
- **테스트**: 2개 (escapeId.test.ts, fuzzyMatch.test.ts)
- **타입**: 1개
- **설정**: 1개 (vitest.config.ts)
- **기존 유지**: 4개 (main.tsx, index.css, vscode-api.ts, mock-data.ts)

**총**: 약 24개 파일 (현재 5개 → 24개)
