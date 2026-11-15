"use client";

import { useState } from "react";

/**
 * 값이 "바뀐" 횟수. 처음 값, 그리고 비어 있던(null·undefined) 값이 채워지는 것(불러오는 중 → 불러옴)은 바뀐 것으로 세지 않는다.
 * 숫자 바뀜 모션(D82, 모션 PR 5)이 이 횟수를 key로 써서, 이미 있던 값이 다른 값으로 바뀔 때만 한 번 재생한다. 같은 값으로 리렌더·refetch되면 늘지 않는다.
 * 렌더 중에 이전 값과 비교해 상태를 고치는 React 공식 방식("props로 상태 조정")이라 ref를 렌더 중에 읽지 않는다.
 */
export function useValueChangeCount(value: string | number | null | undefined): number {
  const [state, setState] = useState({ value, count: 0 });
  if (state.value === value) return state.count;
  const had = state.value !== null && state.value !== undefined;
  const has = value !== null && value !== undefined;
  const next = { value, count: had && has ? state.count + 1 : state.count };
  setState(next);
  return next.count;
}
