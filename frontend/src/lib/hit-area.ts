/**
 * 누르는 영역(44px)을 보이는 크기와 분리해 넓히는 공통 방식 (DESIGN-UI 「누르는 영역 44px 규칙」, 2026-11-09).
 *
 * 글자·알약의 보이는 크기와 간격은 그대로 두고, 링크·버튼에 `relative`를 주고 투명한 `::after`를 `absolute`로 펼쳐서 눌리는 영역만 넓힌다
 * (서열표 `+` 버튼 `RecordButton`이 먼저 쓰던 방식을 한 곳에 모은 것). 링크마다 따로 만들지 않고 아래 상수만 쓴다.
 *
 * 지킬 점:
 *  - 줄 전체를 하나의 링크로 바꾸지 않는다. 링크 구조(href, 접근성 이름)는 그대로다.
 *  - 옆의 다른 링크·버튼과 누르는 영역이 겹치면 안 된다. 겹칠 것 같으면 그 방향 확장 폭을 줄여 맞닿는 곳에서 멈춘다
 *    (44px보다 작아져도 겹치는 것보다 낫다). 그래서 상수가 쓰임새별로 나뉘어 있다.
 *  - `truncate`(overflow: hidden)가 걸린 요소에는 `::after`가 잘리므로 바깥 링크에 상수를 주고 안쪽 `<span className="block truncate">`에 말줄임을 건다.
 *  - Tailwind는 완성된 클래스 글자를 소스에서 찾아 쓰므로 클래스 이름을 조각내 이어 붙이지 않는다(아래 상수 그대로 쓴다).
 */

/** 모든 변형의 공통 부분: 위치 기준 + 투명 ::after */
export const HIT_BASE = "relative after:absolute after:content-['']";

/** 곡 줄의 곡명 링크(글자 한 줄 18px): 위아래 13px씩 → 44px. 좌우는 링크(왼쪽 열) 폭 그대로라 오른쪽 열·재킷을 침범하지 않는다 */
export const HIT_TITLE = `${HIT_BASE} after:inset-x-0 after:-inset-y-[13px]`;

/** 점수 칩(`기록 수정`, 높이 18px): 위아래 13px씩 → 44px, 왼쪽 6px, 오른쪽 4px(오른쪽 `+` 버튼 영역이 왼쪽으로 6px 나오고 둘 사이 간격이 10px이라 4px에서 멈춘다) */
export const HIT_CHIP = `${HIT_BASE} after:-left-1.5 after:-right-1 after:-inset-y-[13px]`;

/**
 * 머리 오른쪽의 작은 글자 링크(`전체 보기`·`서열표 보기`·`묶음 전체 보기`, 글자 16px): 위 20px·좌우 8px, 아래는 6px에서 멈춘다 → 42px.
 * 아래 목록과는 8px 간격 안이고, 위쪽은 이웃 구역과의 간격(16px) 안에서 끝난다(링크는 머리 줄 위에서 약 6px 내려와 있다).
 */
export const HIT_HEAD = `${HIT_BASE} after:-inset-x-2 after:-top-5 after:-bottom-1.5`;

/** 줄이 촘촘히 이어지는 목록 안의 링크(줄 간격 37px, 글자 20px): 위아래 8px씩 → 36px. 이웃 줄의 영역과 닿기 직전에 멈춘다 */
export const HIT_ROW = `${HIT_BASE} after:inset-x-0 after:-inset-y-2`;

/** 사방에 여유가 있는 단독 글자 링크(`내 페이지로`, `◂ 설정` 같은 돌아가기·이동 링크, 글자 20px): 위아래 12px·좌우 8px → 44px */
export const HIT_STANDALONE = `${HIT_BASE} after:-inset-x-2 after:-inset-y-3`;

/** 접힘 줄(`<summary>`, 높이 20px, 카드 안쪽 여백 12px): 위 12px, 아래 12px(닫혀 있을 때) / 8px(열렸을 때 아래 목록과 닿기 전에 멈춤), 좌우는 카드 안쪽 여백만큼 */
export const HIT_SUMMARY = `${HIT_BASE} after:-inset-x-4 after:-top-3 after:-bottom-3 [details[open]>&]:after:-bottom-2`;

/** 푸터의 줄 링크: 줄 간격이 좁아 ::after를 펼치면 서로 겹치므로, 링크 자체가 높이 44px 줄이 된다(푸터에서만 레이아웃이 달라지는 부분) */
export const FOOTER_LINE_LINK = "inline-flex min-h-11 items-center";
