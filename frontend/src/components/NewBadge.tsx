/** 레이팅 목록에 새로 들어온 곡에 붙이는 `NEW` 표시. 색만으로 구분하지 않고 글자를 쓴다. */
export function NewBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded bg-chip-on-bg px-1.5 py-px text-[10px] font-extrabold leading-4 text-chip-on-fg">
      NEW
    </span>
  );
}
