import vscode from "vscode";
import { NaiteCallPatterns } from "../../lib/tracking/patterns";
import { NaiteTracker } from "../../lib/tracking/tracker";

/**
 * 패턴 매칭용 정규식을 캐싱합니다.
 * NaiteCallPatterns가 정적이므로 정규식을 한 번만 생성합니다.
 */
function buildPatternRegexes(): RegExp[] {
  const allPatterns = NaiteCallPatterns.all();
  const methodsByObject = new Map<string, string[]>();

  for (const pattern of allPatterns) {
    const [obj, method] = pattern.split(".");
    if (!obj || !method) {
      continue;
    }
    if (!methodsByObject.has(obj)) {
      methodsByObject.set(obj, []);
    }
    methodsByObject.get(obj)?.push(method);
  }

  const regexes: RegExp[] = [];
  for (const [obj, methods] of methodsByObject) {
    regexes.push(new RegExp(`${obj}\\.(${methods.join("|")})\\(["'\`]$`));
  }

  return regexes;
}

// 모듈 로드 시 한 번만 정규식 생성
const patternRegexes = buildPatternRegexes();

/**
 * Naite 호출에서 자동완성을 제공합니다
 */
export class NaiteCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    // 캐싱된 정규식으로 패턴 매칭
    const matched = patternRegexes.some((regex) => regex.test(linePrefix));

    if (!matched) {
      return undefined;
    }

    // 모든 Naite 키를 자동완성 항목으로 변환
    const keys = NaiteTracker.getAllKeys();
    const completionItems = keys.map((key) => {
      const setLocs = NaiteTracker.getKeyLocations(key, "set");
      const getLocs = NaiteTracker.getKeyLocations(key, "get");

      // 정의된 파일명 (첫 번째 set 위치)
      const definedIn =
        setLocs.length > 0 ? setLocs[0].uri.path.split("/").pop() || "(정의 없음)" : "(정의 없음)";

      const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Constant);
      item.detail = definedIn;

      // 상세 정보
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**정의**: ${setLocs.length}개\n\n`);
      for (const loc of setLocs.slice(0, 3)) {
        md.appendMarkdown(
          `- ${vscode.workspace.asRelativePath(loc.uri)}:${loc.range.start.line + 1}\n`,
        );
      }
      if (setLocs.length > 3) {
        md.appendMarkdown(`- ... 외 ${setLocs.length - 3}개\n`);
      }

      md.appendMarkdown(`\n**사용**: ${getLocs.length}개\n\n`);
      for (const loc of getLocs.slice(0, 3)) {
        md.appendMarkdown(
          `- ${vscode.workspace.asRelativePath(loc.uri)}:${loc.range.start.line + 1}\n`,
        );
      }
      if (getLocs.length > 3) {
        md.appendMarkdown(`- ... 외 ${getLocs.length - 3}개\n`);
      }

      item.documentation = md;

      return item;
    });

    return completionItems;
  }
}
