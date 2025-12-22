declare const acquireVsCodeApi: (() => VsCodeApi) | undefined;

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

export const vscode: VsCodeApi =
  typeof acquireVsCodeApi !== "undefined"
    ? acquireVsCodeApi()
    : {
        // 개발용 Mock
        postMessage: (msg) => console.log("[vscode mock] postMessage:", msg),
        getState: () => null,
        setState: (state) => console.log("[vscode mock] setState:", state),
      };
