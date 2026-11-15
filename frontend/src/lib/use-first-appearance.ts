"use client";

import { useEffect, useState } from "react";

/**
 * "이 요소를 이미 보여 줬는가"를 브라우저 탭이 열려 있는 동안 기억한다(새로고침하면 비워진다).
 * 막대 채움·도넛 그리기(D82, 모션 PR 5)는 처음 나타날 때 한 번만 재생해야 한다. 같은 요소가 탭 전환·폴더 접었다 펴기·다시 방문으로
 * 다시 그려질 때(마운트)마다 재생하면 시끄럽기 때문이다. 서버 렌더에서는 효과가 돌지 않아 이 집합이 항상 비어 있어 요청 사이에 공유되지 않는다.
 */
const seen = new Set<string>();

/**
 * 처음 나타나는 요소면 true. 키는 요소를 구분하는 글자(예: `stage:rate:R95`)다. 키가 없으면 false(모션 없음: 값을 아직 모르는 자리 등).
 * 첫 렌더에서 한 번 정하고(useState) 효과에서 "봤음"으로 적는다. 렌더 중에는 집합을 바꾸지 않아 StrictMode가 렌더를 두 번 불러도 같은 답이다.
 * 같은 마운트 안의 리렌더·refetch는 상태가 그대로라 값이 바뀌지 않고, 다시 마운트되면 집합에 있어 false다.
 */
export function useFirstAppearance(key: string | null | undefined): boolean {
  const [first] = useState(() => (key ? !seen.has(key) : false));
  useEffect(() => {
    if (key) seen.add(key);
  }, [key]);
  return first;
}

/** 테스트용: 기억을 비운다 */
export function resetFirstAppearance(): void {
  seen.clear();
}
