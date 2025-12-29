import type { Ref } from "react";

type HeaderProps = {
  searchMode: boolean;
  searchQuery: string;
  matchCount: number;
  followEnabled: boolean;
  stats: { suites: number; tests: number; traces: number };
  searchInputRef: Ref<HTMLInputElement>;
  onSearchChange: (value: string) => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onToggleFollow: () => void;
  onCollapseAll: () => void;
};

export function Header({
  searchMode,
  searchQuery,
  matchCount,
  followEnabled,
  stats,
  searchInputRef,
  onSearchChange,
  onOpenSearch,
  onCloseSearch,
  onToggleFollow,
  onCollapseAll,
}: HeaderProps) {
  return (
    <div className="header">
      {searchMode ? (
        <SearchModeHeader
          searchQuery={searchQuery}
          matchCount={matchCount}
          followEnabled={followEnabled}
          searchInputRef={searchInputRef}
          onSearchChange={onSearchChange}
          onCloseSearch={onCloseSearch}
          onToggleFollow={onToggleFollow}
          onCollapseAll={onCollapseAll}
        />
      ) : (
        <NormalModeHeader
          stats={stats}
          followEnabled={followEnabled}
          onOpenSearch={onOpenSearch}
          onToggleFollow={onToggleFollow}
          onCollapseAll={onCollapseAll}
        />
      )}
    </div>
  );
}

// 검색 아이콘
function SearchIcon() {
  return (
    <svg
      className="search-icon"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" strokeLinecap="round" />
    </svg>
  );
}

// Follow 아이콘
function FollowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <rect x="5.5" y="1.5" width="5" height="3" rx="0.5" />
      <rect x="1.5" y="9.5" width="4" height="4" rx="0.5" />
      <rect x="10.5" y="9.5" width="4" height="4" rx="0.5" />
      <path d="M8 4.5v3.5M3.5 9.5V8h9v1.5" strokeLinecap="round" />
    </svg>
  );
}

// 닫기 아이콘
function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
    </svg>
  );
}

// 검색 모드 헤더
type SearchModeHeaderProps = {
  searchQuery: string;
  matchCount: number;
  followEnabled: boolean;
  searchInputRef: Ref<HTMLInputElement>;
  onSearchChange: (value: string) => void;
  onCloseSearch: () => void;
  onToggleFollow: () => void;
  onCollapseAll: () => void;
};

function SearchModeHeader({
  searchQuery,
  matchCount,
  followEnabled,
  searchInputRef,
  onSearchChange,
  onCloseSearch,
  onToggleFollow,
  onCollapseAll,
}: SearchModeHeaderProps) {
  return (
    <>
      <div className="search-container">
        <SearchIcon />
        <input
          ref={searchInputRef}
          type="text"
          className="search-input"
          placeholder="key 또는 value 검색..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && <span className="search-count">{matchCount} matches</span>}
        <button type="button" className="search-close" onClick={onCloseSearch} title="검색 닫기">
          <CloseIcon />
        </button>
      </div>
      <div className="header-right">
        <button
          type="button"
          id="follow-btn"
          className={`header-btn icon-btn ${followEnabled ? "active" : ""}`}
          onClick={onToggleFollow}
          title="에디터 클릭 시 트레이스 따라가기"
        >
          <FollowIcon />
        </button>
        <button type="button" className="header-btn" onClick={onCollapseAll} title="모두 접기">
          접기
        </button>
      </div>
    </>
  );
}

// 일반 모드 헤더
type NormalModeHeaderProps = {
  stats: { suites: number; tests: number; traces: number };
  followEnabled: boolean;
  onOpenSearch: () => void;
  onToggleFollow: () => void;
  onCollapseAll: () => void;
};

function NormalModeHeader({
  stats,
  followEnabled,
  onOpenSearch,
  onToggleFollow,
  onCollapseAll,
}: NormalModeHeaderProps) {
  return (
    <>
      <div className="header-left">
        <span className="title">Traces</span>
        <span id="stats" className="stats">
          {stats.suites} suites · {stats.tests} tests · {stats.traces} traces
        </span>
      </div>
      <div className="header-right">
        <button
          type="button"
          className="header-btn icon-btn"
          onClick={onOpenSearch}
          title="검색 (key 또는 value)"
        >
          <SearchIcon />
        </button>
        <button
          type="button"
          id="follow-btn"
          className={`header-btn icon-btn ${followEnabled ? "active" : ""}`}
          onClick={onToggleFollow}
          title="에디터 클릭 시 트레이스 따라가기"
        >
          <FollowIcon />
        </button>
        <button type="button" className="header-btn" onClick={onCollapseAll} title="모두 접기">
          접기
        </button>
      </div>
    </>
  );
}
