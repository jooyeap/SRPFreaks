"use client";

import type { ReactNode } from "react";
import { useCollapse } from "@/lib/use-collapse";

/**
 * 접기/펼치기 영역(D82, 모션 PR 3). 높이는 `grid-template-rows: 0fr ↔ 1fr`로 전환하고(globals.css `.motion-collapse`), 닫는 동안은 내용을 남겼다가 모션이 끝나면 지운다(lib/use-collapse.ts).
 * 접힌 동안은 `hidden`이라 화면에도 접근성 트리에도 없고, 접히는 중에는 `inert`라 포커스를 받지 않는다.
 * `children`은 함수로 받아 내용이 필요할 때만 만든다(접힌 큰 목록을 미리 만들지 않는다).
 * `alwaysOnWide`: 넓은 화면(md, 48rem 이상)에서는 접히지 않고 늘 보이는 영역(곡 목록 필터 패널). 이때는 hidden 속성 대신 data-closed(CSS가 좁은 화면에서만 숨김)를 쓰고 inert도 쓰지 않으며, 내용을 접혀 있어도 그려 둔다(넓은 화면에서 바로 보여야 하므로).
 */
export function Collapse({
  open,
  id,
  alwaysOnWide = false,
  children,
}: {
  open: boolean;
  id?: string;
  alwaysOnWide?: boolean;
  children: () => ReactNode;
}) {
  const { rendered, expanded, clip } = useCollapse(open);
  return (
    <div
      id={id}
      hidden={alwaysOnWide ? undefined : !rendered}
      data-closed={alwaysOnWide && !rendered ? true : undefined}
      inert={alwaysOnWide ? undefined : !expanded}
      data-expanded={expanded}
      data-clip={clip}
      className={alwaysOnWide ? "motion-collapse motion-collapse-wide" : "motion-collapse"}
    >
      <div className="motion-collapse-inner">{rendered || alwaysOnWide ? children() : null}</div>
    </div>
  );
}
