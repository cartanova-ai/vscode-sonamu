# naite-types 패키지

익스텐션과 trace-viewer가 공유하는 타입 정의.

## 사용

```typescript
import { TestResult, TraceData } from "naite-types";
```

## 주요 타입

### TestResult
테스트 실행 결과 전체 구조:
- `suites`: SuiteResult[] (스위트 목록)
- `stats`: 통계 정보

### TraceData
개별 트레이스:
- `key`: 트레이스 키
- `value`: 기록된 값
- `location`: 파일 경로, 라인, 컬럼
- `timestamp`: 기록 시간

### 메시지 타입 (messaging-types.ts)
웹뷰 ↔ 익스텐션 통신용:
- `WebviewMessage`: 웹뷰 → 익스텐션
- `ExtensionMessage`: 익스텐션 → 웹뷰

## 빌드 불필요

`main`과 `exports`가 `./src/index.ts`를 직접 가리킴.
TypeScript 소스를 그대로 import하므로 별도 빌드 단계 없음.
