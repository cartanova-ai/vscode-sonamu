# extension 패키지

VSCode 익스텐션 본체. Naite 트레이스 시스템과 코드 네비게이션 기능 제공.

## 빌드

```bash
pnpm build
# 1. tsc --noEmit (타입 체크만)
# 2. pnpm --filter naite-trace-viewer build (웹뷰 빌드)
# 3. node esbuild.js --production (익스텐션 번들링)
```

## esbuild.js의 역할

`naite-trace-viewer/dist/`의 JS/CSS를 읽어서 하나의 HTML 문자열로 인라인.
이 HTML이 웹뷰의 컨텐츠가 됨.

### 주의사항
- `naite-trace-viewer`가 먼저 빌드되어야 함
- `dist/assets/main.js`, `dist/assets/index.css` 파일명 고정 (vite.config.ts에서 설정)

## 주요 파일 구조

```
src/
├── extension.ts                 # 진입점
└── naite/
    ├── features/
    │   ├── trace-viewer/        # 웹뷰 프로바이더
    │   ├── key-highlighting/    # 키 데코레이션
    │   ├── key-navigation/      # 정의/참조 이동
    │   ├── key-completion/      # 자동완성
    │   ├── key-hover-info-box/  # 호버 정보
    │   ├── key-symbol-search/   # 심볼 검색
    │   ├── key-undefined-warning/ # 미정의 키 경고
    │   └── inline-value-display/ # 인라인 값 표시
    └── lib/
        ├── code-parsing/        # 표현식 파싱 (NaiteExpressionExtractor, NaiteExpressionScanner)
        ├── messaging/           # 소켓 서버, 트레이스 저장소
        ├── tracking/            # Naite 키 추적 (tracker.ts, patterns.ts)
        └── utils/               # 에디터 네비게이션, 워크스페이스 등
```

## 워크스페이스 스캔 동작

`NaiteTracker.scanWorkspace()`는 다음 두 위치에서 Naite 호출(`Naite.t`, `Naite.get`)을 찾습니다:

1. **프로젝트 루트**: `sonamu.config.ts`가 있는 디렉토리 아래의 모든 `.ts` 파일
   - `node_modules/`, `build/`, `out/`, `dist/`, `*.d.ts` 제외
2. **sonamu 패키지 내부**: `node_modules/sonamu/src/**/*.ts` 파일들
   - Sonamu 프레임워크 자체에 정의된 Naite 키도 인덱싱하기 위함

이렇게 하면 사용자의 코드뿐만 아니라 Sonamu 내부에 정의된 키도 "정의로 이동", "참조 찾기" 등의 기능에서 사용할 수 있습니다.

## 웹뷰 통신

익스텐션 ↔ 웹뷰 메시지:
- `updateTestResults`: 트레이스 데이터 전송
- `openFile`: 파일 열기 요청 (웹뷰 → 익스텐션)
- `revealTrace`: 특정 트레이스로 스크롤 (익스텐션 → 웹뷰)

## 배포

```bash
pnpm install-extension
# → build → vsce package → code --install-extension
```

마켓플레이스 배포:
```bash
vsce publish
# package.json의 version 먼저 업데이트 필요
```
