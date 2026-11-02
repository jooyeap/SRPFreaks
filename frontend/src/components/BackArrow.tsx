/**
 * 뒤로 버튼 모양 (2026-10-31): 화면마다 크기·여백이 달라 어긋나 보이던 것을 한 곳으로 모았다.
 * 정사각형(모바일 44px, 데스크톱 마우스 환경 36px — globals.css의 컨트롤 높이 규칙과 같은 기준)이고 화살표 아이콘이 가운데 온다.
 * 버튼·링크 어느 쪽에도 쓸 수 있게 클래스와 아이콘만 내보낸다. 뜻은 각 화면의 aria-label이 전한다.
 */
export const BACK_BUTTON_CLASS =
  "inline-flex size-11 shrink-0 items-center justify-center self-start rounded-lg border border-ctl text-fg-sub hover:text-fg compact:size-9";

export function BackArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
