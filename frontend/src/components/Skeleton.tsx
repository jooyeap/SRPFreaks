/**
 * 불러오는 동안 들어갈 자리를 비슷한 높이의 회색 칸으로 잡아 둔다. 글자 한 줄 안내(`불러오는 중입니다.`)로 두면
 * 데이터가 도착할 때 아래 내용이 한꺼번에 밀려 내려가서 눈이 흔들린다.
 * label은 화면에는 보이지 않고 화면 읽기 프로그램용 안내다. 움직임을 줄이는 설정(prefers-reduced-motion)에서는 깜빡이지 않는다.
 */
export function Skeleton({ label, className = "h-28" }: { label: string; className?: string }) {
  return (
    <div aria-busy="true" className={`animate-pulse rounded-2xl bg-table-head motion-reduce:animate-none ${className}`}>
      <span className="sr-only">{label}</span>
    </div>
  );
}
