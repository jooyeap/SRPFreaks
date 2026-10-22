import { senderSource } from "@/lib/import-bookmarklet";
import type { Translator } from "@/i18n/translator";

/**
 * 공식 곡 목록 읽기 북마클릿 (D42, ROOT 전용). 이어뮤즈먼트의 곡 목록 페이지(`music/index.html`)를 ROOT가 연 상태에서
 * 북마크를 누르면, 그 페이지 한 장에서 (곡명, 아티스트, 파트, 채보별 레벨) 값만 읽어 사이트의 `/admin/song-import` 창으로 넘긴다.
 * 서버는 공식 사이트와 통신하지 않고 계정·쿠키·페이지 전체 HTML은 읽지도 보내지도 않는다. 요청도 추가로 보내지 않는다(연 페이지 한 장만 읽는다).
 *
 * 최근 플레이 가져오기(import-bookmarklet.ts)와 같은 틀이지만 주소 조각 이름을 `#srpsong=`으로 다르게 쓴다.
 * 전역 핸드오프(ImportHandoff)가 `#srp=`로 시작하는 조각을 지우기 때문에, 같은 이름을 쓰면 이 화면이 받기 전에 사라진다.
 *
 * 읽기만 하고 해석하지 않는다: 곡 매칭·레벨 해석·차이 계산은 서버가 한다. 이 코드는 읽는 위치만 안다.
 * 읽는 위치가 바뀌면 READER_SOURCE만 고친다(docs/DESIGN.md 18.4.0-2의 읽는 위치 표와 같이 갱신).
 * 북마클릿은 한 줄짜리 문자열로 배포되므로 소스에는 `//` 주석을 쓰지 않고 ES5 문법만 쓴다.
 */

export const OFFICIAL_HOST = "p.eagate.573.jp";
/** 곡 목록 페이지 주소의 일부. 기록 목록(`/playdata/music.html`)은 구조가 달라서 제외한다. */
export const SONG_LIST_PATH_PART = "/music/";
export const SONG_LIST_EXCLUDE_PART = "/playdata/";
/** 서버가 한 번에 받는 최대 곡 수와 같다. */
export const MAX_SONGS = 300;
export const FRAGMENT_PREFIX = "#srpsong=";
export const SONG_IMPORT_WINDOW = "srpfreaks-song-import";

export interface SongBookmarkletMessages {
  title: string;
  open: string;
  ok: string;
  wrongPage: string;
  noSongs: string;
  translated: string;
  openManually: string;
  tooMany: string;
}

/** 지금 화면 언어의 안내 문구. `{count}` 같은 자리는 북마클릿 안에서 채우므로 같은 글자로 되돌려 넣는다. */
export function songBookmarkletMessages(t: Translator): SongBookmarkletMessages {
  return {
    title: t("SongImport.bmTitle"),
    open: t("Import.bmOpen"),
    ok: t("Import.bmOk"),
    wrongPage: t("SongImport.bmWrongPage"),
    noSongs: t("SongImport.bmNoSongs"),
    translated: t("Import.bmTranslated"),
    openManually: t("SongImport.bmOpenManually", { count: "{count}" }),
    tooMany: t("SongImport.bmTooMany", { max: "{max}", count: "{count}" }),
  };
}

/** 읽은 곡 한 줄. 서버 OfficialSongImportRequest.OfficialSong과 같은 모양이다. */
export interface ReadSong {
  title: string;
  artist: string;
  charts: { part: string; levels: string[] }[];
}

export interface ReadSongsResult {
  songs: ReadSong[];
  /** 읽지 못해 건너뛴 줄 수(파트 칸을 알 수 없거나 곡명 없이 시작한 줄) */
  unreadable: number;
  /** 번역된 페이지(곡명이 번역돼 있을 수 있음) */
  translated: boolean;
}

/**
 * 페이지에서 값을 읽는 함수. `srpReadSongs(document)`가 ReadSongsResult를 돌려준다.
 * 줄의 칸 수로 종류를 가른다: 8칸 = 곡의 첫 줄(재킷, 곡명, 아티스트, 파트, 레벨 4개), 5칸 = 같은 곡의 둘째 줄(파트, 레벨 4개).
 * 그 밖의 줄(이벤트 구분 1칸, 머리글 6칸)은 건너뛴다.
 */
export const READER_SOURCE = `
function srpText(el){return el?(el.textContent||'').replace(/\\s+/g,' ').trim():'';}
function srpPartOf(cell){
  var cls=(cell.className||'');
  if(/td_g/.test(cls)){return 'G';}
  if(/td_b/.test(cls)){return 'B';}
  var t=srpText(cell).charAt(0).toUpperCase();
  return (t==='G'||t==='B')?t:'';
}
function srpReadSongs(doc){
  var root=doc.documentElement;
  var translated=/translated/.test(root.className||'')||!!doc.querySelector('font[dir=auto]');
  var rows=doc.querySelectorAll('table tr');
  var songs=[];var cur=null;var unreadable=0;
  for(var i=0;i<rows.length;i++){
    var cells=[];var kids=rows[i].children;
    for(var c=0;c<kids.length;c++){var tn=kids[c].tagName;if(tn==='TD'||tn==='TH'){cells.push(kids[c]);}}
    var n=cells.length;
    if(n!==8&&n!==5){continue;}
    var base=n===8?3:0;
    var part=srpPartOf(cells[base]);
    var levels=['','','',''];
    for(var k=1;k<=4;k++){
      var cell=cells[base+k];
      var m=(cell.className||'').match(/td_c([1-4])/);
      var idx=m?parseInt(m[1],10)-1:k-1;
      levels[idx]=srpText(cell);
    }
    if(n===8){
      var title=srpText(cells[1]);
      if(!title){cur=null;unreadable++;continue;}
      cur={title:title,artist:srpText(cells[2]),charts:[]};
      songs.push(cur);
    }
    if(!cur||!part){unreadable++;continue;}
    cur.charts.push({part:part,levels:levels});
  }
  return {songs:songs,unreadable:unreadable,translated:translated};
}
`;

/**
 * 북마클릿 본문. 읽은 값을 사이트의 `/admin/song-import#srpsong=<JSON>`으로 넘기기만 한다(서버 호출·토큰 없음).
 * 같은 이름의 창을 재사용해서 다음 쪽을 보낼 때도 같은 탭에 이어서 쌓인다. 창을 막으면 안내 창에 같은 주소의 링크를 둔다.
 * @param siteBase 사이트 주소(예: https://srpfreaks.com). 화면을 연 사이트의 origin에서 만든다.
 */
export function buildSongBookmarkletSource(siteBase: string, messages: SongBookmarkletMessages): string {
  const base = siteBase.replace(/\/+$/, "");
  return `(function(){
var MSG=${JSON.stringify(messages)};
${READER_SOURCE}
${senderSource()}
var TITLE=MSG.title;
var path=location.pathname||'';
if(location.hostname!==${JSON.stringify(OFFICIAL_HOST)}||path.indexOf(${JSON.stringify(SONG_LIST_PATH_PART)})<0||path.indexOf(${JSON.stringify(SONG_LIST_EXCLUDE_PART)})>=0){srpModal(TITLE,MSG.wrongPage);return;}
var read=srpReadSongs(document);
if(!read.songs.length){srpModal(TITLE,MSG.noSongs);return;}
if(read.translated){srpModal(TITLE,MSG.translated);return;}
var total=read.songs.length;
var songs=read.songs.slice(0,${MAX_SONGS});
var url=${JSON.stringify(base)}+'/admin/song-import${FRAGMENT_PREFIX}'+encodeURIComponent(JSON.stringify({songs:songs}));
var w=null;
try{w=window.open(url,${JSON.stringify(SONG_IMPORT_WINDOW)});}catch(e){w=null;}
if(!w){srpModal(TITLE,srpFmt(MSG.openManually,{count:songs.length}),url);return;}
if(total>songs.length){srpModal(TITLE,srpFmt(MSG.tooMany,{max:songs.length,count:total}));}
})();`;
}

/** 북마크 주소(`javascript:…`). */
export function buildSongBookmarkletHref(siteBase: string, messages: SongBookmarkletMessages): string {
  return "javascript:" + encodeURIComponent(buildSongBookmarkletSource(siteBase, messages));
}
