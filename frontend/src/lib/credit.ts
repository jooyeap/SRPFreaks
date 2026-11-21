/**
 * 서열표(기준 난이도) 정보를 제공하고 설계한 분의 표기. 푸터와 서열표 화면이 같은 값을 쓰도록 한 곳에 둔다.
 * 안내 문구(`서열표(레이팅 상수 난이도) 정보 제공·설계:`)는 사용자가 직접 정한 것이라 임의로 바꾸지 않는다. messages의 Footer.tableCredit에 있다.
 */
export const TABLE_CREDIT = {
  name: "イズニャン",
  handle: "@trist_is",
  url: "https://x.com/trist_is",
} as const;

/** 곡 정보(BPM·아티스트) 일부 출처 표기(D94). 사실 데이터만 쓰고 서술 텍스트·이미지는 쓰지 않는다. 문구는 messages의 Footer.songInfoCredit. */
export const SONG_INFO_CREDIT = {
  name: "RemyWiki",
  url: "https://remywiki.com",
} as const;
