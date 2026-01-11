declare const acquireVsCodeApi: (() => VsCodeApi) | undefined;

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

/**
 * 개발 환경에서 Mock API 로깅 활성화 여부
 * 개발 중 디버깅이 필요할 때만 true로 설정
 */
const ENABLE_MOCK_LOGGING = false;

export const vscode: VsCodeApi =
  typeof acquireVsCodeApi !== "undefined"
    ? acquireVsCodeApi()
    : {
        // 개발용 Mock (silent by default)
        postMessage: (msg) => {
          if (ENABLE_MOCK_LOGGING) {
            console.log("[vscode mock] postMessage:", msg);
          }
        },
        getState: () => null,
        setState: (state) => {
          if (ENABLE_MOCK_LOGGING) {
            console.log("[vscode mock] setState:", state);
          }
        },
      };
