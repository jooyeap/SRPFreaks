/**
 * 곡 상세 이전/다음 곡 안내 말풍선을 이미 닫았는지(이 기기에서 처음 한 번만 보인다).
 * localStorage는 사용자별 편의로만 쓴다: 읽기·쓰기가 막혀도(사생활 보호 창 등) 화면은 정상이고,
 * 그때는 메모리에 닫음을 기억해서 이번 방문 동안은 다시 뜨지 않는다.
 */
const KEY = "srp.detailNavHintSeen";
let dismissedInMemory = false;

export function isDetailNavHintDismissed(): boolean {
  if (dismissedInMemory) return true;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissDetailNavHint(): void {
  dismissedInMemory = true;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // 저장하지 못해도 메모리 값으로 이번 방문 동안은 다시 뜨지 않는다
  }
}

/** 테스트용 */
export function resetDetailNavHintForTest(): void {
  dismissedInMemory = false;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}
