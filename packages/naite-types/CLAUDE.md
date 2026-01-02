# naite-types 패키지

익스텐션과 Sonamu 프레임워크가 공유하는 Naite 메시징 관련 타입 정의.

## 사용

```typescript
import { NaiteMessagingTypes } from "naite-types";

// 개별 타입 접근
type Trace = NaiteMessagingTypes.NaiteTrace;
type Result = NaiteMessagingTypes.TestResult;
```

## 주요 타입 (NaiteMessagingTypes 네임스페이스)

### NaiteTrace
개별 트레이스 데이터:
- `key`: 트레이스 키 (string)
- `value`: 기록된 값 (any)
- `filePath`: 파일 경로 (string)
- `lineNumber`: 라인 번호 (number)
- `at`: 기록 시간 (string)

### TestError
테스트 실패 시 에러 정보:
- `message`: 에러 메시지 (string)
- `stack`: 스택 트레이스 (optional)

### TestResult
개별 테스트 실행 결과:
- `suiteName`: 스위트 이름
- `suiteFilePath`: 스위트 파일 경로 (optional)
- `testName`: 테스트 이름
- `testFilePath`: 테스트 파일 경로
- `testLine`: 테스트 라인 번호
- `status`: 테스트 상태
- `duration`: 실행 시간 (ms)
- `error`: TestError (optional, 테스트 실패 시 에러 정보)
- `traces`: NaiteTrace[] (트레이스 목록)
- `receivedAt`: 수신 시간

### 메시지 타입
Sonamu ↔ 익스텐션 소켓 통신용:
- `NaiteRunStartMessage`: 테스트 실행 시작
- `NaiteTestResultMessage`: 테스트 결과 전송
- `NaiteRunEndMessage`: 테스트 실행 종료
- `NaiteMessage`: 위 세 타입의 유니온

> **참고**: 웹뷰 ↔ 익스텐션 통신 타입은 `naite-trace-viewer/src/types/`에 별도 정의됨

## 빌드 불필요

`main`과 `exports`가 `./src/index.ts`를 직접 가리킴.
TypeScript 소스를 그대로 import하므로 별도 빌드 단계 없음.
