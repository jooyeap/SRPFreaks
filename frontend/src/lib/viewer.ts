/**
 * 로그인 없이 보는 방문자(D43)의 "보는 사람 id". 사용자 id는 1부터 시작하므로 0은 실제 계정과 겹치지 않는다.
 * 화면들은 userId를 쿼리 키에만 쓴다(로그아웃 후 다른 계정으로 들어와도 이전 사용자의 기록이 섞이지 않게).
 * 그래서 비로그인에게는 이 값을 넣어 두고, 로그인하면 키가 바뀌어 내 기록이 담긴 응답을 새로 받는다.
 */
export const ANONYMOUS_VIEWER_ID = 0;

export function isLoggedInViewer(viewerId: number): boolean {
  return viewerId !== ANONYMOUS_VIEWER_ID;
}
