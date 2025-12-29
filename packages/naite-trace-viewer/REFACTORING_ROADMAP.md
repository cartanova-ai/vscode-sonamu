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

## 남은 개선 과제

### 2. 메시지 처리 로직 통합 ✅ 완료

**해결:**
- useTraceViewerState.ts의 FOCUS_KEY/FOCUS_TEST 액션에서 `pendingHighlight` 설정
- App.tsx는 `pendingHighlight` 감지 → 하이라이트 적용 → 초기화
- 기존 App.tsx의 중복 메시지 핸들러 제거

**효과:** "포커스 기능을 수정하려면?" → useTraceViewerState.ts만 보면 됨

---

### 3. ResizeObserver 훅 추출 ✅ 완료

**해결:**
- `hooks/useResizeObserverCSSVar.ts` 생성
- SuiteItem.tsx, SearchView.tsx의 19줄 중복 코드 → 1줄로 단순화

**효과:** 동일 패턴 중복 제거, 유지보수 용이

---

### 4. 상수 파일 통합 → 불필요 (스킵)

**분석 결과:**
- 각 상수가 한 곳에서만 사용됨 (공유 안 함)
- 해당 로직 근처에 있는 게 더 직관적
- 주석으로 용도 설명 충분

**현재 상태:**
- `HIGHLIGHT_DURATION_MS`, `SCROLL_DELAY_MS` → useHighlight.ts (하이라이트 전용)
- `DEBOUNCE_MS` → useSearch.ts (검색 전용)
- 스티키 오프셋 → sticky-headers/ 내부 (CSS와 동기화 주석 있음)

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
- [x] 3. ResizeObserver 훅 추출
- [x] 4. 상수 파일 통합 → 불필요 (스킵)
- [ ] 5. App.tsx 책임 분리 ← **다음 작업** (2번 완료로 대부분 해결됨)

---

## 권장 진행 순서

1. ~~메시지 처리 통합~~ ✅
2. ~~ResizeObserver 훅 추출~~ ✅
3. ~~상수 파일 통합~~ → 불필요 (스킵)
4. **App.tsx 책임 분리** (이미 많이 개선됨)
