import type { NaiteMessagingTypes } from "naite-types";

type TestListener = () => void;

class TraceStoreClass {
  private currentTestResults: NaiteMessagingTypes.TestResult[] = [];
  private testResultAddedListeners: TestListener[] = [];
  private testResultChangeListeners: TestListener[] = [];
  private testResultAddedDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly TEST_RESULT_ADDED_DEBOUNCE_DELAY = 100;

  addRunStart(): void {
    this.currentTestResults = [];
  }

  addTestResult(testResult: NaiteMessagingTypes.TestResult): void {
    this.currentTestResults.push(testResult);

    if (this.testResultAddedDebounceTimer) {
      clearTimeout(this.testResultAddedDebounceTimer);
    }
    this.testResultAddedDebounceTimer = setTimeout(() => {
      this.notifyTestResultAdded();
    }, this.TEST_RESULT_ADDED_DEBOUNCE_DELAY);
  }

  addRunEnd(): void {
    // 현재는 처리할 작업 없음
  }

  getAllTestResults(): NaiteMessagingTypes.TestResult[] {
    return this.currentTestResults;
  }

  getAllTraces(): NaiteMessagingTypes.NaiteTrace[] {
    return this.currentTestResults.flatMap((r) => r.traces);
  }

  getTracesForLine(filePath: string, lineNumber: number): NaiteMessagingTypes.NaiteTrace[] {
    return this.getAllTraces().filter(
      (t) => t.filePath === filePath && t.lineNumber === lineNumber,
    );
  }

  onTestResultAdded(listener: TestListener): { dispose: () => void } {
    this.testResultAddedListeners.push(listener);
    return {
      dispose: () => {
        const index = this.testResultAddedListeners.indexOf(listener);
        if (index >= 0) {
          this.testResultAddedListeners.splice(index, 1);
        }
      },
    };
  }

  onTestResultChange(listener: TestListener): { dispose: () => void } {
    this.testResultChangeListeners.push(listener);
    return {
      dispose: () => {
        const index = this.testResultChangeListeners.indexOf(listener);
        if (index >= 0) {
          this.testResultChangeListeners.splice(index, 1);
        }
      },
    };
  }

  private notifyTestResultAdded(): void {
    for (const listener of this.testResultAddedListeners) {
      listener();
    }
  }

  private notifyTestResultChange(): void {
    for (const listener of this.testResultChangeListeners) {
      listener();
    }
  }

  updateTraceLineNumbers(
    filePath: string,
    keyLineEntries: Array<{ key: string; lineNumber: number }>,
  ): void {
    let updated = false;

    for (const testResult of this.currentTestResults) {
      for (const trace of testResult.traces) {
        if (trace.filePath !== filePath) {
          continue;
        }

        const matchingEntries = keyLineEntries.filter((e) => e.key === trace.key);
        if (matchingEntries.length === 0) {
          continue;
        }

        const closest = matchingEntries.reduce((prev, curr) =>
          Math.abs(curr.lineNumber - trace.lineNumber) <
          Math.abs(prev.lineNumber - trace.lineNumber)
            ? curr
            : prev,
        );

        if (trace.lineNumber !== closest.lineNumber) {
          trace.lineNumber = closest.lineNumber;
          updated = true;
        }
      }
    }

    if (updated) {
      this.notifyTestResultChange();
    }
  }
}

export const TraceStore = new TraceStoreClass();
