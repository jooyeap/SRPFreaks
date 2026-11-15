/**
 * 이미 불러온 재킷 주소를 브라우저 탭이 열려 있는 동안 기억한다(D82, 모션 PR 6). 재킷은 불러온 순간 한 번만 서서히 나타나야 한다.
 * 목록이 다시 그려지거나(필터·페이지 이동·스크롤로 줄이 다시 생김) 같은 재킷이 다른 화면에 또 나올 때는 이미 브라우저 캐시에 있으니 곧바로 보이게 한다.
 * 긴 목록에서도 메모리가 늘지 않게 JACKET_SEEN_LIMIT개까지만 두고 넘치면 가장 오래된 것부터 버린다(버려진 주소는 다시 한 번 서서히 나타날 뿐이다).
 * 서버 렌더에서는 효과가 돌지 않아 이 집합이 비어 있고 요청 사이에 공유되지 않는다.
 */
export const JACKET_SEEN_LIMIT = 300;

const seen = new Set<string>();

export function isJacketSeen(url: string): boolean {
  return seen.has(url);
}

export function markJacketSeen(url: string): void {
  if (seen.has(url)) return;
  if (seen.size >= JACKET_SEEN_LIMIT) {
    const oldest = seen.values().next().value;
    if (oldest !== undefined) seen.delete(oldest);
  }
  seen.add(url);
}

/** 테스트용: 기억을 비운다 */
export function resetJacketSeen(): void {
  seen.clear();
}
