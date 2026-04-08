/**
 * JSON 값을 타입별로 색상 구분하여 렌더링하는 컴포넌트
 *
 * - null/undefined: json-null
 * - string: json-string
 * - number: json-number
 * - bigint: json-number (n 접미사 포함)
 * - boolean: json-boolean
 * - symbol: json-special
 * - function: json-special
 * - array: 재귀적 렌더링
 * - object: 재귀적 렌더링
 */
type JsonValueProps = {
  value: unknown;
};

export function JsonValue({ value }: JsonValueProps): JSX.Element {
  if (value === null) {
    return <span className="json-null">null</span>;
  }

  if (value === undefined) {
    return <span className="json-null">undefined</span>;
  }

  if (typeof value === "string") {
    return <span className="json-string">"{value}"</span>;
  }

  if (typeof value === "number") {
    return <span className="json-number">{value}</span>;
  }

  if (typeof value === "bigint") {
    return <span className="json-number">{String(value)}n</span>;
  }

  if (typeof value === "boolean") {
    return <span className="json-boolean">{String(value)}</span>;
  }

  if (typeof value === "symbol") {
    return <span className="json-special">{String(value)}</span>;
  }

  if (typeof value === "function") {
    return <span className="json-special">[Function: {value.name || "anonymous"}]</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="json-bracket">[]</span>;
    }
    return (
      <>
        <span className="json-bracket">[</span>
        <div className="json-array">
          {value.map((v, i) => (
            <span key={i} className="json-item">
              <JsonValue value={v} />,
            </span>
          ))}
        </div>
        <span className="json-bracket">]</span>
      </>
    );
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return <span className="json-bracket">{"{}"}</span>;
    }
    return (
      <>
        <span className="json-bracket">{"{"}</span>
        <div className="json-object">
          {keys.map((k) => (
            <span key={k} className="json-item">
              <span className="json-key">"{k}"</span>:{" "}
              <JsonValue value={(value as Record<string, unknown>)[k]} />,
            </span>
          ))}
        </div>
        <span className="json-bracket">{"}"}</span>
      </>
    );
  }

  return <>{String(value)}</>;
}
