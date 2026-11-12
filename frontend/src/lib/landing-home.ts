/**
 * 로그인 전 홈(E2, 2026-11-12)에 덧붙인 카드들의 값을 한 곳에 둔다.
 *  - 공개 유저 상위 5명, 최근 공지 3개: **이미 로그인 없이 읽을 수 있는 목록 API**(GET /players, GET /notices)를 size만 줄여 쓴다.
 *    새 공개 경로를 만들지 않는다(backend PublicReadPaths 참고).
 *  - 서열표 바로가기: 데이터를 부르지 않는 고정 링크다. 숫자는 폴더 주소 규칙(folderHref)에 그대로 넘긴다.
 */
export const LANDING_PLAYERS_SIZE = 5;
export const LANDING_NOTICES_SIZE = 3;

/**
 * 바로가기에 두는 기준 난이도. null은 기준 난이도가 없는 `미정` 묶음이다.
 * 서열표 화면과 달리 서버 데이터를 보지 않으므로, 그 난이도 폴더가 비어 있을 수도 있다(그 경우 폴더 화면이 안내를 보여 준다).
 */
export const LANDING_TIER_SHORTCUTS: readonly (number | null)[] = [5.4, 5.6, 5.8, 6.0, null];

/**
 * 비로그인용 쿼리 키에 넣는 보는 사람 값. 로그인한 사용자 id는 1 이상이라 겹치지 않는다
 * (로그인하면 키가 달라져 이전에 받은 공개 목록 캐시가 로그인 홈에 섞이지 않는다).
 */
export const ANONYMOUS_VIEWER_ID = 0;
