/**
 * 곡 줄·카드 왼쪽의 달성 단계 막대 (stage-bar). 서열표 줄(EntryRow), 한 줄 행(ChartLine), 곡 목록 줄(ChartRow)이 같은 코드를 쓴다.
 *
 * 막대는 줄(li)의 안쪽 왼쪽 끝에 `absolute inset-y-0 left-0 w-1`(4px)로 붙는다. 이 막대는 네모라서, 줄이 둥근 카드(rounded-2xl border)일 때
 * 모서리를 따라가지 않고 곧게 튀어나온다. 그래서 막대를 쓰는 줄은 반드시 `STAGE_EDGE_CLIP`(overflow-hidden)을 함께 준다:
 * 줄이 자기 둥근 모서리(안쪽 테두리 곡선)에서 막대를 잘라 주고, 막대가 있든 없든 줄의 바깥 크기와 왼쪽 끝, 안쪽 내용 위치는 같다.
 * (막대는 absolute라 흐름에 영향을 주지 않는다. 모서리가 네모인 줄에서는 잘라도 보이는 것이 없다.)
 * 색은 CSS 변수(stage-bar, globals.css)만 쓰고 두께·색은 바꾸지 않는다.
 *
 * overflow-hidden은 줄 안의 그림자·툴팁·드롭다운을 자른다. 이 줄들 안에는 그런 것이 없다: 곡명 링크의 누르는 영역(::after, HIT_TITLE)은
 * 줄 높이 안에서 끝나고, EntryRow의 포커스 링은 줄 안쪽(-outline-offset-2)에 그린다.
 */
export const STAGE_EDGE_CLIP = "overflow-hidden";

export function StageEdgeBar() {
  return <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" />;
}
