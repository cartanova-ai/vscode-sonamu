import type vscode from "vscode";

/**
 * Document와 위치가 주어졌을 때, 해당 위치에서 Naite 호출문의 key를 추출합니다.
 *
 * 주어진 문서를 AST 분석하여 모든 Naite key를 추출하는 {@link NaiteExpressionScanner}와 달리,
 * 주어진 문서 속 특정 위치에 어떤 Naite key가 등장하는지 정규식으로 파싱하여 추출합니다.
 * 
 * 왜 이미 스캔해둔 NaiteKey들 중에서 찾지 않고 정규식으로 직접 추출하는가?
 * 그게 더 직접적이고 확실하기 때문입니다.
 * 이 친구는 정의/사용 참조처를 띄워줄 때에 사용되는데({@link NaiteDefinitionProvider}, {@link NaiteUsageProvider}),
 * 이 시점에서 아직 해당 파일의 Naite key가 정확하게 스캔되지 않았을 수 있습니다.
 * 반면 이미 문서와 위치가 주어졌기에 텍스트가 특정된 상황이므로, 정규식으로 직접 추출하는 것이 더 낫습니다.
 *    
 * 그렇다면 왜 AST 파싱으로 주어진 location에 도달할 때까지 visit하는 방식으로 Naite 호출문을 찾지 않는가?
 * 느리고 비효율적이기 때문입니다.
 * 주어진 위치의 텍스트가 이미 제공되는 상황에서, 해당 위치의 노드를 구하려 선형적으로 접근하는 것 보다는,
 * 주어진 텍스트에 정규식을 적용하여 Naite key를 직접 추출하는 것이 더 효율적입니다.
 */
export default class NaiteExpressionExtractor {
  constructor(private readonly document: vscode.TextDocument) {}

  extractKeyAtPosition(position: vscode.Position, patterns: string[]): string | null {
    const line = this.document.lineAt(position.line).text;

    for (const patternStr of patterns) {
      const [obj, method] = patternStr.split(".");
      if (!obj || !method) continue;

      const regex = new RegExp(`${obj}\\.${method}\\s*\\(\\s*["'\`]([^"'\`]+)["'\`]`, "g");

      let match = regex.exec(line);
      while (match) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;

        if (position.character >= matchStart && position.character <= matchEnd) {
          return match[1];
        }

        match = regex.exec(line);
      }
    }

    return null;
  }
}
