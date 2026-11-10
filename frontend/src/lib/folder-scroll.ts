/**
 * 서열표 폴더에서 이웃 난이도로 옮긴 직후의 스크롤 위치 맞춤(D68).
 *
 * 이웃 이동은 router.replace(..., { scroll: false })라 Next가 맨 위로 올리지 않는다. 대신 이동 직전에 requestFolderScrollAdjust()로 표시를 남기고,
 * 새 난이도 화면이 그려진 직후(useLayoutEffect)에 takeFolderScrollAdjust()로 한 번만 꺼내 alignListHead()를 부른다.
 * 표시를 쓰는 이유: 폴더 화면은 난이도마다 새로 마운트되어서(주소의 key) "처음 열림"과 "이웃으로 옮겨 옴"을 이 표시로만 구분할 수 있다.
 * 서열표에서 처음 들어오거나 뒤로 가기로 돌아온 경우에는 표시가 없어서 스크롤을 건드리지 않는다.
 */
let pendingAdjust = false;

export function requestFolderScrollAdjust(): void {
  pendingAdjust = true;
}

/** 표시가 있었으면 true를 돌려주고 지운다 */
export function takeFolderScrollAdjust(): boolean {
  const had = pendingAdjust;
  pendingAdjust = false;
  return had;
}

/**
 * 화면 맨 위에 붙어 있는(sticky/fixed) 요소들이 가린 높이(px). 하드코딩하지 않고 지금 그려진 요소에서 잰다.
 * 대상은 header와 role="status"(오프라인 배너)이고, 위쪽 끝(top ≤ 1px)에 붙은 것의 아래 끝 중 가장 큰 값을 쓴다. 지금 사이트 헤더는 붙지 않는다(스크롤되면 사라진다).
 */
export function stickyTopOffset(): number {
  let offset = 0;
  document.querySelectorAll("header, [role='status']").forEach((el) => {
    const position = getComputedStyle(el).position;
    if (position !== "sticky" && position !== "fixed") return;
    const rect = el.getBoundingClientRect();
    if (rect.height > 0 && rect.top <= 1) offset = Math.max(offset, rect.bottom);
  });
  return offset;
}

/**
 * 목록 머리(난이도 제목 줄)가 화면 위로 지나가 있으면(= 보던 스크롤이 목록 머리보다 아래) 머리가 고정 헤더 바로 아래에 오도록 즉시 올린다.
 * 머리가 보이거나 그 아래에 있으면(헤더·검색이 보이는 상태) 아무것도 하지 않고 보던 위치를 그대로 둔다.
 * @returns 스크롤했으면 true
 */
export function alignListHead(head: Element): boolean {
  const offset = stickyTopOffset();
  const top = head.getBoundingClientRect().top;
  if (top >= offset) return false;
  window.scrollTo({ top: window.scrollY + top - offset, behavior: "instant" });
  return true;
}
