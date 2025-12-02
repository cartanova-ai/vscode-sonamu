import vscode from "vscode";
import { getAllTraces, type NaiteTraceEntry, onTraceChange } from "./naite-socket-server";

const LOG_PREFIX = "[NaiteTraceTree]";

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

function logError(context: string, error: unknown) {
  console.error(LOG_PREFIX, `ERROR in ${context}:`, error);
  if (error instanceof Error) {
    console.error(LOG_PREFIX, "Stack:", error.stack);
  }
}

// ─────────────────────────────────────────────────────────
// TreeItem 클래스들 (프론트엔드스럽게 분리!)
// ─────────────────────────────────────────────────────────

type TraceTreeItem = SuiteItem | TestItem | TraceItem;

class SuiteItem extends vscode.TreeItem {
  readonly type = "suite" as const;

  constructor(
    public readonly suiteName: string,
    testCount: number,
  ) {
    super(suiteName || "(no suite)", vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = "suite";
    this.iconPath = new vscode.ThemeIcon("symbol-class");
    this.description = `${testCount} tests`;
    this.id = `suite:${suiteName}`;
  }
}

class TestItem extends vscode.TreeItem {
  readonly type = "test" as const;

  constructor(
    public readonly suiteName: string,
    public readonly testName: string,
    traceCount: number,
  ) {
    super(testName || "(no test)", vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = "test";
    this.iconPath = new vscode.ThemeIcon("symbol-method");
    this.description = `${traceCount} traces`;
    this.id = `test:${suiteName}::${testName}`;
  }
}

class TraceItem extends vscode.TreeItem {
  readonly type = "trace" as const;

  constructor(
    public readonly trace: NaiteTraceEntry,
    index: number,
  ) {
    super(trace.key || "(no key)", vscode.TreeItemCollapsibleState.None);
    this.contextValue = "trace";
    this.iconPath = new vscode.ThemeIcon("symbol-variable");
    this.description = formatValue(trace.value, 40);
    this.id = `trace:${trace.testSuite}::${trace.testName}::${index}`;

    if (trace.filePath) {
      this.command = {
        command: "naiteTrace.goToLocation",
        title: "Go to Location",
        arguments: [trace.filePath, trace.lineNumber],
      };

      this.tooltip = new vscode.MarkdownString();
      this.tooltip.appendCodeblock(JSON.stringify(trace.value, null, 2), "json");
      const fileName = trace.filePath.split("/").pop() || trace.filePath;
      this.tooltip.appendMarkdown(`\n\n📍 ${fileName}:${trace.lineNumber}`);
    }
  }
}

function formatValue(value: unknown, maxLength: number): string {
  try {
    const str = JSON.stringify(value);
    if (str.length > maxLength) {
      return str.substring(0, maxLength) + "...";
    }
    return str;
  } catch {
    return String(value);
  }
}

// ─────────────────────────────────────────────────────────
// TreeDataProvider
// ─────────────────────────────────────────────────────────

export class NaiteTraceTreeProvider implements vscode.TreeDataProvider<TraceTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TraceTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private disposable: vscode.Disposable;

  // 데이터 캐시: Suite > Test > Traces
  private suiteMap = new Map<string, Map<string, NaiteTraceEntry[]>>();

  constructor() {
    log("constructor");
    this.disposable = onTraceChange((traces) => {
      log(`onTraceChange: ${traces.length} traces`);
      this.refresh();
    });
  }

  refresh(): void {
    try {
      log("refresh");
      this.buildDataCache();
      this._onDidChangeTreeData.fire();
    } catch (e) {
      logError("refresh", e);
    }
  }

  private buildDataCache(): void {
    try {
      const traces = getAllTraces();
      log(`buildDataCache: ${traces.length} traces`);
      this.suiteMap.clear();

      for (const trace of traces) {
        const suiteName = trace.testSuite || "(no suite)";
        const testName = trace.testName || "(no test)";

        if (!this.suiteMap.has(suiteName)) {
          this.suiteMap.set(suiteName, new Map());
        }
        const testMap = this.suiteMap.get(suiteName)!;

        if (!testMap.has(testName)) {
          testMap.set(testName, []);
        }
        testMap.get(testName)!.push(trace);
      }

      log(`buildDataCache done: ${this.suiteMap.size} suites`);
    } catch (e) {
      logError("buildDataCache", e);
    }
  }

  getTreeItem(element: TraceTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TraceTreeItem): TraceTreeItem[] {
    try {
      // 처음 호출 시 캐시 빌드
      if (this.suiteMap.size === 0) {
        this.buildDataCache();
      }

      // 루트: Suite 목록
      if (!element) {
        log(`getChildren ROOT: ${this.suiteMap.size} suites`);
        return Array.from(this.suiteMap.entries()).map(
          ([suiteName, testMap]) => new SuiteItem(suiteName, testMap.size),
        );
      }

      // Suite 하위: Test 목록
      if (element.type === "suite") {
        const suiteItem = element as SuiteItem;
        const testMap = this.suiteMap.get(suiteItem.suiteName);
        if (!testMap) {
          log(`getChildren SUITE: no testMap for ${suiteItem.suiteName}`);
          return [];
        }
        log(`getChildren SUITE ${suiteItem.suiteName}: ${testMap.size} tests`);
        return Array.from(testMap.entries()).map(
          ([testName, traces]) => new TestItem(suiteItem.suiteName, testName, traces.length),
        );
      }

      // Test 하위: Trace 목록
      if (element.type === "test") {
        const testItem = element as TestItem;
        const testMap = this.suiteMap.get(testItem.suiteName);
        if (!testMap) {
          log(`getChildren TEST: no testMap for suite ${testItem.suiteName}`);
          return [];
        }
        const traces = testMap.get(testItem.testName);
        if (!traces) {
          log(`getChildren TEST: no traces for ${testItem.testName}`);
          return [];
        }
        log(`getChildren TEST ${testItem.testName}: ${traces.length} traces`);
        return traces.map((trace, index) => new TraceItem(trace, index));
      }

      return [];
    } catch (e) {
      logError("getChildren", e);
      return [];
    }
  }

  dispose(): void {
    log("dispose");
    this.disposable.dispose();
    this._onDidChangeTreeData.dispose();
  }
}
