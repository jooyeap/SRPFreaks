import type { ReactNode } from "react";

/**
 * 화면(주소)이 바뀔 때마다 새로 만들어지는 래퍼(Next.js template). 새 화면이 투명에서 180ms로 나타난다(`motion-page`, D82 모션 PR 2).
 * layout과 달리 template은 이동할 때마다 다시 그려지기 때문에 애니메이션이 매번 재생된다. 같은 화면 안의 쿼리 변경(필터·탭 주소)에서는 다시 그려지지 않는다.
 * 투명도만 움직이므로 배치·스크롤 위치 복원·클릭에는 영향이 없다. 움직임 줄이기에서는 꺼진다(globals.css).
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="motion-page">{children}</div>;
}
