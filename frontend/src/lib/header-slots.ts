/**
 * 헤더에 화면별 버튼을 끼워 넣는 자리(포털 대상)의 id. 서버 컴포넌트(SiteHeader)와 클라이언트 컴포넌트가 같이 쓰므로
 * "use client"가 없는 이 파일에 둔다.
 * - HEADER_SEARCH_SLOT_ID: lg 미만에서 곡 검색 아이콘이 들어가는 자리(SearchFocusButton이 채운다, 2026-10-27)
 * - HEADER_HOME_SEARCH_SLOT_ID: 홈의 곡 검색 돋보기가 들어가는 자리(HomeSongSearch가 채운다, D100). 곡 목록·서열표의 자리와 달리 lg 이상에서도 보인다
 */
export const HEADER_SEARCH_SLOT_ID = "header-search-slot";
export const HEADER_HOME_SEARCH_SLOT_ID = "header-home-search-slot";
