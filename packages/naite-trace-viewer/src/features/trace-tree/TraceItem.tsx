import type { NaiteMessagingTypes } from "naite-types";

import { ExpandArrow, JsonValue } from "../../components";
import { createTraceKey, escapeId, formatTime, getFileName } from "../../utils";
import { HighlightedText } from "../search/HighlightedText";
import { handleStickyToggle } from "../sticky-headers";
import { goToLocation } from "../vscode-sync";

type TraceItemProps = {
  trace: NaiteMessagingTypes.NaiteTrace;
  traceIdx: number;
  suiteName: string;
  testName: string;
  expanded: boolean;
  highlighted: boolean;
  searchQuery: string;
  isSearchResult?: boolean;
  onToggle: () => void;
};

export function TraceItem({
  trace,
  traceIdx,
  suiteName,
  testName,
  expanded,
  highlighted,
  searchQuery,
  isSearchResult = false,
  onToggle,
}: TraceItemProps) {
  const traceStateKey = createTraceKey(suiteName, testName, trace.key, trace.at, traceIdx);
  const traceId = escapeId(traceStateKey);
  const fileName = getFileName(trace.filePath);
  const time = formatTime(trace.at);
  const isSearchMatch = !!searchQuery; // 검색 모드에서 이 컴포넌트가 렌더되면 매칭된 것

  const handleHeaderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    handleStickyToggle(e.currentTarget, expanded, onToggle);
  };

  const handleLocationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    goToLocation(trace.filePath, trace.lineNumber);
  };

  const wrapperClassName = isSearchResult
    ? "search-result-trace"
    : `trace-item ${highlighted ? "highlight" : ""} ${searchQuery && isSearchMatch ? "search-match" : ""}`;

  return (
    <div
      id={`item-${traceId}`}
      className={wrapperClassName}
      data-suite={suiteName}
      data-test-name={testName}
      data-trace-key={trace.key}
      data-trace-at={trace.at}
      data-trace-idx={traceIdx}
      data-filepath={trace.filePath}
      data-line={trace.lineNumber}
    >
      <div className="trace-header" onClick={handleHeaderClick}>
        <ExpandArrow expanded={expanded} className="trace-arrow" id={`trace-arrow-${traceId}`} />
        <span className="key">
          {searchQuery ? <HighlightedText text={trace.key} query={searchQuery} /> : trace.key}
        </span>
        <span className="location-link" onClick={handleLocationClick}>
          {fileName}:{trace.lineNumber}
        </span>
        <span className="time">{time}</span>
      </div>

      {expanded && (
        <div className="trace-content" id={`trace-content-${traceId}`}>
          <div className="json-viewer">
            <JsonValue value={trace.value} />
          </div>
        </div>
      )}
    </div>
  );
}
