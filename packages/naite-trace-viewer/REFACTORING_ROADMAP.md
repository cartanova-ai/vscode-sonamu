# naite-trace-viewer 리팩토링 로드맵

> 목표: "Claude 없이도 아무나 보고 바로 수정할 수 있는" 직관적인 React 앱

## 현재 폴더 구조 (기능 기반으로 변경 완료 ✅)

```
src/
├── features/
│   ├── trace-tree/       # Suite > Test > Trace 계층
│   ├── search/           # 검색 기능
│   ├── sticky-headers/   # 스티키 헤더 시스템
│   └── vscode-sync/      # VSCode 동기화
├── shared/
│   ├── ui/               # 재사용 UI
│   ├── hooks/            # 앱 전반 훅
│   └── utils/            # 공용 유틸
├── types/
├── lib/
├── App.tsx
└── main.tsx
```

**효과:** "기능 X를 수정하려면?" → `features/X/` 폴더만 보면 됨

---

## 남은 개선 과제

### 2. 메시지 처리 로직 통합 ✅ 완료

**해결:**
- useTraceViewerState.ts의 FOCUS_KEY/FOCUS_TEST 액션에서 `pendingHighlight` 설정
- App.tsx는 `pendingHighlight` 감지 → 하이라이트 적용 → 초기화
- 기존 App.tsx의 중복 메시지 핸들러 제거

**효과:** "포커스 기능을 수정하려면?" → useTraceViewerState.ts만 보면 됨

---

### 3. ResizeObserver 훅 추출

**현재 문제:**
- SuiteItem.tsx (L46-64)와 SearchView.tsx (L83-101)에 동일한 ResizeObserver 패턴 100% 중복

**목표:**
- `shared/hooks/useResizeObserverCSSVar.ts`로 추출
- 사용: `useResizeObserverCSSVar(sourceRef, targetRef, "suite-header-height")`

---

### 4. 상수 파일 통합

**현재 문제:**
- Magic numbers가 여기저기 흩어져 있음
  - HIGHLIGHT_DURATION_MS = 2000 (useHighlight.ts)
  - SCROLL_DELAY_MS = 100 (useHighlight.ts)
  - DEBOUNCE_MS = 100 (useSearch.ts)
  - 스티키 오프셋 7, 6 등 (stickyOffsets.ts, useStickyState.ts)

**목표:**
- `shared/constants.ts`에 모두 모음
- CSS와 동기화 필요한 값들은 주석으로 명시

---

### 5. App.tsx 책임 분리 (신규)

**현재 문제:**
- App.tsx가 188줄로 너무 많은 책임을 가짐
  - 상태 초기화
  - 메시지 핸들링 (L45-75)
  - 스크롤 타겟 처리 (L77-89)
  - 토글 핸들러들 (L94-126)
  - 통계 계산

**목표:**
- 메시지 핸들링 + 스크롤 로직을 별도 훅으로 분리
- App.tsx는 컴포넌트 조합에만 집중

---

## 진행 상황

- [x] 1. 폴더 구조 기능 기반 변경
- [x] 2. 메시지 처리 통합
- [ ] 3. ResizeObserver 훅 추출 ← **다음 작업**
- [ ] 4. 상수 파일 통합
- [ ] 5. App.tsx 책임 분리 (2번 완료로 대부분 해결됨)

---

## 권장 진행 순서

1. ~~메시지 처리 통합~~ ✅
2. **상수 파일 통합** (쉬움, quick win)
3. **ResizeObserver 훅 추출** (중복 제거)
