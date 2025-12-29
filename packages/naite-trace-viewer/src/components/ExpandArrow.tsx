/**
 * 펼침/접힘 화살표 컴포넌트
 *
 * 모든 레벨(Suite, Test, Trace)에서 통일된 애니메이션을 사용합니다.
 * CSS transform으로 90도 회전 애니메이션이 적용됩니다.
 */
type ExpandArrowProps = {
  expanded: boolean;
  className?: string;
};

export function ExpandArrow({ expanded, className = "" }: ExpandArrowProps) {
  return (
    <span className={`arrow ${className} ${expanded ? "expanded" : ""}`}>
      ▶
    </span>
  );
}
