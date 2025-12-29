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
