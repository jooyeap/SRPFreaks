import { compactBookmarkletSource, encodeBookmarklet, senderSource } from "@/lib/import-bookmarklet";
import { BPM_TEXT_SOURCE, parseBpmText } from "@/lib/song-info";
import type { Translator } from "@/i18n/translator";

/**
 * RemyWiki GITADORA 곡 표에서 BPM 읽기 북마클릿 (D94, ROOT 전용). 설계는 docs/DESIGN.md D94.
 *
 * ROOT가 RemyWiki(remywiki.com)의 곡 표가 있는 페이지(예: AC_GD_EXCHAIN)를 연 상태에서 북마크를 누르면:
 *  1. 지금 열린 페이지의 표만 읽는다(추가 요청 없음). 머리글에서 `Song`(또는 `Song Title`)과 `BPM` 열을 이름으로 찾고, 못 찾는 표는 건너뛴다.
 *  2. 우리 사이트의 `/admin/song-import?remy=1` 창(이름 고정)을 열거나 이미 열려 있으면 그대로 쓰고, 곡명·BPM(·아티스트) 목록을 postMessage로 넘긴다.
 *     우리 창이 받았다는 답(ack)을 줄 때까지 1초마다 다시 보낸다(최대 60번). 새로 열린 창은 읽어 들이는 동안 메시지를 받지 못하기 때문이다.
 * 우리 창은 RemyWiki 출처의 메시지만 받고, 이 코드는 우리 사이트 출처의 답만 받는다. 서버는 RemyWiki와 통신하지 않는다.
 *
 * D47 로더(짧은 스텁 + 해시 고정 파일)는 최근 플레이 가져오기 전용이라 쓰지 않는다. 재킷(D54)·곡 목록(D42)·곡 정보(D90)처럼
 * ROOT 관리 화면에서 끌어다 놓는 일반 북마클릿이고, 새 `public/import-loader/` 파일은 만들지 않는다.
 *
 * 북마클릿은 한 줄짜리 글자로 배포되므로 소스에는 `//` 주석을 쓰지 않고 ES5 문법만 쓴다(다른 북마클릿과 같은 규칙).
 * BPM 모양 검사는 song-info.ts의 BPM_TEXT_SOURCE 한 곳을 쓴다(서버 SongInfoImportService와 같은 모양).
 */

export const REMY_ORIGIN = "https://remywiki.com";
export const REMY_HOST = "remywiki.com";
export const REMY_WINDOW = "srpfreaks-remy-bpm";
/** 우리 창 주소의 표시(이 값이 있어도 없어도 패널은 메시지를 받는다. 북마클릿이 새 창을 열 때 붙인다). */
export const REMY_QUERY = "remy=1";

/** 두 창이 주고받는 메시지 종류. */
export const MSG_REMY_ROWS = "srp-remy-rows";
export const MSG_REMY_ACK = "srp-remy-ack";

/** 한 번에 받는 곡 수(서버 SongInfoImportRequest의 4,000과 같다). */
export const REMY_MAX_ROWS = 4000;
const MAX_TITLE_LENGTH = 300;
const MAX_ARTIST_LENGTH = 500;
const MAX_ID_LENGTH = 64;
const MAX_SOURCE_LENGTH = 120;

export interface RemyBookmarkletMessages {
  title: string;
  open: string;
  ok: string;
  wrongPage: string;
  noTable: string;
  popupBlocked: string;
  sending: string;
  done: string;
  noReply: string;
}

/** 지금 화면 언어의 안내 문구. `{count}` 같은 자리는 북마클릿 안에서 채우므로 같은 글자로 되돌려 넣는다. */
export function remyBookmarkletMessages(t: Translator): RemyBookmarkletMessages {
  return {
    title: t("RemyBpm.bmTitle"),
    open: t("Import.bmOpen"),
    ok: t("Import.bmOk"),
    wrongPage: t("RemyBpm.bmWrongPage"),
    noTable: t("RemyBpm.bmNoTable", { invalid: "{invalid}" }),
    popupBlocked: t("RemyBpm.bmPopupBlocked"),
    sending: t("RemyBpm.bmSending", { count: "{count}" }),
    done: t("RemyBpm.bmDone", { count: "{count}" }),
    noReply: t("RemyBpm.bmNoReply"),
  };
}

/**
 * 페이지(문서)의 표에서 곡명·아티스트·BPM을 읽는 함수들. `srpReadRemy(doc)`가
 * `{rows:[{title,artist,bpm}], tables, invalid, truncated}`를 돌려준다. (document에만 기대는 순수 함수라 HTML 샘플로 테스트한다)
 *
 * 읽는 규칙(RemyWiki 표 모양 확인: docs/DESIGN.md D94):
 *  - 표마다 앞 4줄 안에서 머리글 칸 글자가 `Song`/`Song Title`/`Title`인 열과 `BPM`인 열을 찾는다. 둘 다 없으면 그 표는 건너뛴다.
 *    `Artist` 열은 있으면 읽는다. 열 위치는 colspan·rowspan을 펼친 격자로 계산한다(두 줄 머리글, `Drive Flare` 같은 앞 열 대응).
 *  - 머리글 아래 줄 중 곡 칸이 머리글 칸 그대로(rowspan), 또는 곡 칸과 BPM 칸이 같은 칸(구분 줄 `Default`, `Hidden Songs`)이면 건너뛴다.
 *  - 곡명: 칸 글자에서 <br>·블록을 줄바꿈으로 보고, 첫 줄을 곡명으로 쓴다. 다음 줄이 `from ○○`(원작 표시)이면 버리되 줄 끝의 `(Long Version)` 같은 괄호는 곡명에 붙인다.
 *    같은 줄 안의 ` from <BEMANI 시리즈>`도 같은 규칙으로 떼고(알려진 시리즈 이름일 때만), `[1]` 각주와 끝의 `new song` 표시를 지운다. 이미지·위첨자·각주는 읽지 않는다.
 *  - BPM: NFKC 정규화 후 정수 1~2000의 `172` 또는 `최소-최대`(하이픈·물결표·긴 줄표)만 `172` / `120-180`으로 돌려준다. 비어 있거나 맞지 않으면 그 곡은 건너뛰고
 *    (구분 줄처럼 비어 있는 것은 세지 않고, 글자가 있는데 맞지 않는 것만 invalid로 센다) 값을 추측하지 않는다.
 *  - 같은 페이지에서 곡명(대소문자·공백 무시)이 겹치면 먼저 나온 줄만 쓴다.
 */
export const READER_SOURCE = `
var SRP_BPM_RE=new RegExp(${JSON.stringify(BPM_TEXT_SOURCE)});
var SRP_FROM_RE=/^(.*?\\S)\\s+from\\s+(?:GUITARFREAKS|GuitarFreaks|drummania|DrumMania|beatmania|jubeat|pop'n|REFLEC|SOUND VOLTEX|DanceDanceRevolution|DANCERUSH|Keyboardmania|NOSTALGIA|\\u30CE\\u30B9\\u30BF\\u30EB\\u30B8\\u30A2|GITADORA)(.*)$/i;
var SRP_TAIL_RE=/((?:\\s*\\([^()]*\\))+)\\s*$/;
function srpNorm(s){
  s=String(s==null?'':s);
  try{if(s.normalize){s=s.normalize('NFKC');}}catch(e){}
  return s;
}
function srpCellText(node){
  var out='';
  var kids=node.childNodes;
  for(var i=0;i<kids.length;i++){
    var k=kids[i];
    if(k.nodeType===3){out+=k.nodeValue;continue;}
    if(k.nodeType!==1){continue;}
    var tag=String(k.nodeName).toUpperCase();
    if(tag==='BR'){out+='\\n';continue;}
    if(tag==='SUP'||tag==='SCRIPT'||tag==='STYLE'||tag==='IMG'){continue;}
    var cls=k.getAttribute('class')||'';
    if(/(^|\\s)(reference|mw-editsection|noprint)(\\s|$)/.test(cls)){continue;}
    var block=(tag==='DIV'||tag==='P'||tag==='LI'||tag==='UL'||tag==='OL');
    out+=(block?'\\n':'')+srpCellText(k)+(block?'\\n':'');
  }
  return out;
}
function srpLines(cell){
  var parts=srpNorm(srpCellText(cell)).split('\\n');
  var out=[];
  for(var i=0;i<parts.length;i++){
    var t=parts[i].replace(/[\\s\\u00A0]+/g,' ').replace(/^ | $/g,'');
    if(t){out.push(t);}
  }
  return out;
}
function srpHeadText(cell){
  return srpNorm(cell.textContent||'').replace(/[\\s\\u00A0]+/g,' ').replace(/^ | $/g,'').toLowerCase();
}
function srpGrid(table){
  var trs=table.rows;
  var grid=[];var pending=[];
  for(var r=0;r<trs.length;r++){
    var row=[];var cells=trs[r].cells;var c=0;
    for(var i=0;i<cells.length;i++){
      while(pending[c]&&pending[c].left>0){row[c]=pending[c].cell;pending[c].left--;c++;}
      var cell=cells[i];
      var cs=parseInt(cell.getAttribute('colspan')||'1',10);
      var rs=parseInt(cell.getAttribute('rowspan')||'1',10);
      if(!(cs>0)){cs=1;}if(cs>60){cs=60;}
      if(!(rs>0)){rs=1;}if(rs>60){rs=60;}
      for(var q=0;q<cs;q++){row[c]=cell;pending[c]=rs>1?{cell:cell,left:rs-1}:null;c++;}
    }
    while(pending[c]&&pending[c].left>0){row[c]=pending[c].cell;pending[c].left--;c++;}
    grid.push(row);
  }
  return grid;
}
function srpFindCols(grid){
  var limit=Math.min(4,grid.length);
  for(var r=0;r<limit;r++){
    var song=-1;var bpm=-1;var artist=-1;
    for(var c=0;c<grid[r].length;c++){
      var cell=grid[r][c];
      if(!cell){continue;}
      var t=srpHeadText(cell);
      if(song<0&&/^(song|song title|title)$/.test(t)){song=c;}
      else if(bpm<0&&t==='bpm'){bpm=c;}
      else if(artist<0&&t==='artist'){artist=c;}
    }
    if(song>=0&&bpm>=0){return {header:r,song:song,bpm:bpm,artist:artist,songCell:grid[r][song]};}
  }
  return null;
}
function srpTail(text){
  var m=text.match(SRP_TAIL_RE);
  return m?m[1]:'';
}
function srpTitle(lines){
  if(!lines.length){return '';}
  var title=lines[0];
  for(var i=1;i<lines.length;i++){
    if(/^from\\s/i.test(lines[i])){title+=srpTail(lines[i]);}
    else{title+=' '+lines[i];}
  }
  var m=title.match(SRP_FROM_RE);
  if(m){title=m[1]+srpTail(m[2]);}
  title=title.replace(/\\[\\d+\\]/g,'').replace(/\\s+new\\s+song\\s*$/i,'').replace(/\\s+/g,' ').replace(/^ | $/g,'');
  return title;
}
function srpBpm(text){
  var t=srpNorm(text).replace(/\\[\\d+\\]/g,'').replace(/[*\\u2020\\u2021]+\\s*$/,'').replace(/[\\s\\u00A0]+/g,' ').replace(/^ | $/g,'');
  var m=t.match(SRP_BPM_RE);
  if(!m){return '';}
  var min=parseInt(m[1],10);
  var max=m[2]?parseInt(m[2],10):min;
  if(!(min>=1)||!(max<=2000)||min>max){return '';}
  return min===max?String(min):min+'-'+max;
}
function srpReadRemy(doc){
  var tables=doc.querySelectorAll('table');
  var rows=[];var seen={};var used=0;var invalid=0;var truncated=false;
  for(var ti=0;ti<tables.length;ti++){
    var grid=srpGrid(tables[ti]);
    var cols=srpFindCols(grid);
    if(!cols){continue;}
    used++;
    for(var r=cols.header+1;r<grid.length;r++){
      var sc=grid[r][cols.song];var bc=grid[r][cols.bpm];
      if(!sc||!bc||sc===bc||sc===cols.songCell){continue;}
      var title=srpTitle(srpLines(sc));
      if(!title||title.length>${MAX_TITLE_LENGTH}){continue;}
      var rawBpm=srpNorm(bc.textContent||'').replace(/[\\s\\u00A0]+/g,'');
      if(!rawBpm){continue;}
      var bpm=srpBpm(bc.textContent||'');
      if(!bpm){invalid++;continue;}
      var key=title.replace(/\\s+/g,'').toLowerCase();
      if(Object.prototype.hasOwnProperty.call(seen,key)){continue;}
      var artist='';
      if(cols.artist>=0&&grid[r][cols.artist]&&grid[r][cols.artist]!==sc){artist=srpLines(grid[r][cols.artist]).join(' ');}
      if(artist.length>${MAX_ARTIST_LENGTH}){artist='';}
      if(rows.length>=${REMY_MAX_ROWS}){truncated=true;continue;}
      seen[key]=true;
      rows.push({title:title,artist:artist,bpm:bpm});
    }
  }
  return {rows:rows,tables:used,invalid:invalid,truncated:truncated};
}
`;

/** 북마클릿 본문. @param siteBase 사이트 주소(예: https://srpfreaks.com). 화면을 연 사이트의 origin에서 만든다. */
export function buildRemyBookmarkletSource(siteBase: string, messages: RemyBookmarkletMessages): string {
  const base = siteBase.replace(/\/+$/, "");
  return compactBookmarkletSource(`(function(){
var MSG=${JSON.stringify(messages)};
${READER_SOURCE}
${senderSource()}
var TITLE=MSG.title;
var BASE=${JSON.stringify(base)};
if(location.hostname!==${JSON.stringify(REMY_HOST)}){srpModal(TITLE,MSG.wrongPage);return;}
var read=srpReadRemy(document);
if(!read.rows.length){srpModal(TITLE,srpFmt(MSG.noTable,{invalid:read.invalid}));return;}
var w=null;
try{w=window.open('',${JSON.stringify(REMY_WINDOW)});}catch(e){w=null;}
if(!w){srpModal(TITLE,MSG.popupBlocked);return;}
try{if(w.location.href==='about:blank'){w.location.href=BASE+'/admin/song-import?${REMY_QUERY}';}}catch(e){}
var id=String(new Date().getTime())+'-'+String(Math.floor(Math.random()*1000000));
var source=decodeURIComponent((location.pathname||'').replace(/^\\//,'')).slice(0,${MAX_SOURCE_LENGTH});
var tries=0;var acked=false;var timer=null;
function send(){
  try{w.postMessage({type:'${MSG_REMY_ROWS}',id:id,source:source,rows:read.rows,invalid:read.invalid},BASE);}catch(e){}
}
window.addEventListener('message',function(e){
  if(e.origin!==BASE||e.source!==w){return;}
  var m=e.data;
  if(!m||typeof m!=='object'||m.type!=='${MSG_REMY_ACK}'||m.id!==id){return;}
  acked=true;
  if(timer){clearInterval(timer);}
  srpModal(TITLE,srpFmt(MSG.done,{count:read.rows.length}));
});
srpModal(TITLE,srpFmt(MSG.sending,{count:read.rows.length}));
send();
timer=setInterval(function(){
  if(acked){clearInterval(timer);return;}
  tries++;
  if(tries>60){clearInterval(timer);srpModal(TITLE,MSG.noReply);return;}
  send();
},1000);
})();`);
}

/** 북마크 주소(`javascript:…`). */
export function buildRemyBookmarkletHref(siteBase: string, messages: RemyBookmarkletMessages): string {
  return "javascript:" + encodeBookmarklet(buildRemyBookmarkletSource(siteBase, messages));
}

/* ---------- 우리 창 쪽: 받은 메시지 검사 ---------- */

/** 읽은 곡 한 줄. bpm은 `172` 또는 `120-180`(검증을 통과한 글자)이다. */
export interface RemyRow {
  title: string;
  artist: string;
  bpm: string;
}

export interface RemyMessage {
  type: typeof MSG_REMY_ROWS;
  id: string;
  /** 읽은 페이지 이름(주소의 경로, 예: AC_GD_EXCHAIN). 화면 표시용. */
  source: string;
  rows: RemyRow[];
  /** 북마클릿이 BPM 모양이 맞지 않아 건너뛴 건수 + 이 쪽에서 다시 걸러낸 건수 */
  invalid: number;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1_000_000;
}

/**
 * RemyWiki 창이 보낸 메시지를 검사한다. 모양이 틀리면 null(무시). 출처 확인은 부르는 쪽이 먼저 한다.
 * 줄 하나가 틀리면 그 줄만 버린다: 곡명이 1~300자 문자열이 아니거나, BPM이 song-info.ts의 규칙(정수 1~2000, 범위는 최소<=최대)에 맞지 않으면
 * 버리고 invalid로 센다. 아티스트는 500자를 넘으면 빈 글자로 둔다. 줄 수가 4,000을 넘으면 통째로 버린다.
 * BPM은 `172`·`120-180` 모양으로 다시 써서 돌려준다(서버가 받는 모양).
 */
export function parseRemyMessage(data: unknown): RemyMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const m = data as Record<string, unknown>;
  if (m.type !== MSG_REMY_ROWS) return null;
  if (typeof m.id !== "string" || m.id.length < 1 || m.id.length > MAX_ID_LENGTH) return null;
  if (!Array.isArray(m.rows) || m.rows.length > REMY_MAX_ROWS) return null;
  const rows: RemyRow[] = [];
  let invalid = isCount(m.invalid) ? m.invalid : 0;
  for (const item of m.rows) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.title !== "string" || r.title.length < 1 || r.title.length > MAX_TITLE_LENGTH) continue;
    const bpm = typeof r.bpm === "string" ? parseBpmText(r.bpm) : null;
    if (!bpm) {
      invalid += 1;
      continue;
    }
    const artist = typeof r.artist === "string" && r.artist.length <= MAX_ARTIST_LENGTH ? r.artist : "";
    rows.push({ title: r.title, artist, bpm: bpm.min === bpm.max ? String(bpm.min) : `${bpm.min}-${bpm.max}` });
  }
  const source = typeof m.source === "string" ? m.source.slice(0, MAX_SOURCE_LENGTH) : "";
  return { type: MSG_REMY_ROWS, id: m.id, source, rows, invalid };
}
