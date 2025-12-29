import { fuzzyMatch } from "./fuzzyMatch";

/**
 * 퍼지 매칭 결과로 매칭된 문자를 하이라이트하여 렌더링
 */
type HighlightedTextProps = {
  text: string;
  query: string;
};

export function HighlightedText({ text, query }: HighlightedTextProps): JSX.Element {
  if (!query) {
    return <>{text}</>;
  }

  const { matched, indices } = fuzzyMatch(text, query);
  if (!matched || indices.length === 0) {
    return <>{text}</>;
  }

  const result: JSX.Element[] = [];
  let lastIdx = 0;

  for (const idx of indices) {
    if (idx > lastIdx) {
      result.push(<span key={`t-${lastIdx}`}>{text.slice(lastIdx, idx)}</span>);
    }
    result.push(
      <span key={`h-${idx}`} className="fuzzy-match">
        {text[idx]}
      </span>,
    );
    lastIdx = idx + 1;
  }

  if (lastIdx < text.length) {
    result.push(<span key={`t-${lastIdx}`}>{text.slice(lastIdx)}</span>);
  }

  return <>{result}</>;
}
