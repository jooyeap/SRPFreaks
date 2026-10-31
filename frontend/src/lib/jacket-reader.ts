import { compactBookmarkletSource, encodeBookmarklet, senderSource } from "@/lib/import-bookmarklet";
import type { Translator } from "@/i18n/translator";

/**
 * 재킷 가져오기 북마클릿 (D54 2단계, ROOT 전용). 설계는 docs/DESIGN.md 18.4.0-3.
 *
 * ROOT가 공식 `곡별 성적` 페이지(`/playdata/music.html`)를 연 상태에서 북마크를 누르면:
 *  1. 우리 사이트의 `/admin/song-import?jacket=1` 창을 연다.
 *  2. 곡명 분류 37쪽(`cat=0`~`36`)을 차례로 읽어(GET만, 쪽 사이 0.4초) 줄마다 재킷의 곡명(alt)과 주소만 모은다. 기록 칸은 읽지 않는다.
 *  3. 곡명 목록만 우리 창에 postMessage로 넘긴다. 우리 창이 마스터와 맞춰 "받을 곡명"을 돌려준다.
 *  4. 돌려받은 곡의 재킷만 받아(동시에 2개, 시작 사이 0.2초) 브라우저 Canvas에서 200×200 WebP(품질 0.8)로 줄여 넘긴다.
 *     다시 그리므로 EXIF 같은 메타데이터는 남지 않는다.
 * 양쪽 모두 상대 출처를 확인한다(이 코드는 우리 사이트 출처의 메시지만, 우리 창은 공식 사이트 출처의 메시지만 받는다).
 * 서버는 공식 사이트와 통신하지 않는다. 계정·쿠키·페이지 HTML은 우리 쪽으로 보내지 않는다.
 *
 * 왜 동시에 2개·간격을 두는가: 공식 사이트가 봇 차단(Imperva)을 쓴다. 짧은 시간에 요청이 몰리면 브라우저가 막힐 수 있어
 * 설계의 "동시에 4개"보다 낮췄다(2026-10-31, 약 480장에 2~3분).
 *
 * 북마클릿은 한 줄짜리 글자로 배포되므로 소스에는 `//` 주석을 쓰지 않고 ES5 문법만 쓴다(최근 플레이 가져오기와 같은 규칙).
 */

export const OFFICIAL_ORIGIN = "https://p.eagate.573.jp";
export const OFFICIAL_HOST = "p.eagate.573.jp";
export const JACKET_PAGE_PART = "/playdata/music.html";
export const JACKET_CATEGORIES = 37;
export const JACKET_SIZE = 200;
export const JACKET_QUALITY = 0.8;
/** 서버가 받는 1장 최대 크기(SongJacketAdminService와 같다). */
export const JACKET_MAX_BYTES = 50 * 1024;
export const JACKET_WINDOW = "srpfreaks-jacket-import";
/** 우리 창 주소의 표시. 이 값이 있으면 재킷 받기 패널이 공식 창에 준비 신호를 보낸다. */
export const JACKET_QUERY = "jacket=1";

/** 두 창이 주고받는 메시지 종류. */
export const MSG_READY = "srp-jacket-ready";
export const MSG_TITLES = "srp-jacket-titles";
export const MSG_WANT = "srp-jacket-want";
export const MSG_IMAGE = "srp-jacket-image";
export const MSG_DONE = "srp-jacket-done";

export interface JacketBookmarkletMessages {
  title: string;
  open: string;
  ok: string;
  wrongPage: string;
  popupBlocked: string;
  reading: string;
  noSongs: string;
  matching: string;
  converting: string;
  done: string;
}

/** 지금 화면 언어의 안내 문구. `{n}` 같은 자리는 북마클릿 안에서 채우므로 같은 글자로 되돌려 넣는다. */
export function jacketBookmarkletMessages(t: Translator): JacketBookmarkletMessages {
  return {
    title: t("JacketImport.bmTitle"),
    open: t("Import.bmOpen"),
    ok: t("Import.bmOk"),
    wrongPage: t("JacketImport.bmWrongPage"),
    popupBlocked: t("JacketImport.bmPopupBlocked"),
    reading: t("JacketImport.bmReading", { n: "{n}", total: "{total}" }),
    noSongs: t("JacketImport.bmNoSongs"),
    matching: t("JacketImport.bmMatching", { count: "{count}" }),
    converting: t("JacketImport.bmConverting", { n: "{n}", total: "{total}" }),
    done: t("JacketImport.bmDone", { count: "{count}", failed: "{failed}" }),
  };
}

/**
 * 한 쪽(문서)에서 재킷의 곡명과 주소를 읽는다. `srpReadJackets(doc, pageUrl)`가 [{title, src}]를 돌려준다.
 * 곡명은 앞뒤 공백만 뗀다(정규화·매칭은 서버가 한다). 곡명이나 주소가 비면 건너뛴다.
 */
export const READER_SOURCE = `
function srpReadJackets(doc,pageUrl){
  var imgs=doc.querySelectorAll('img.jacket');
  var out=[];
  for(var i=0;i<imgs.length;i++){
    var title=(imgs[i].getAttribute('alt')||'').replace(/\\s+/g,' ').trim();
    var src=imgs[i].getAttribute('src')||'';
    if(!title||!src){continue;}
    out.push({title:title,src:new URL(src,pageUrl).href});
  }
  return out;
}
`;

/** 북마클릿 본문. @param siteBase 사이트 주소(예: https://srpfreaks.com). 화면을 연 사이트의 origin에서 만든다. */
export function buildJacketBookmarkletSource(siteBase: string, messages: JacketBookmarkletMessages): string {
  const base = siteBase.replace(/\/+$/, "");
  return `(function(){
var MSG=${JSON.stringify(messages)};
${READER_SOURCE}
${senderSource()}
var TITLE=MSG.title;
var BASE=${JSON.stringify(base)};
if(location.hostname!==${JSON.stringify(OFFICIAL_HOST)}||(location.pathname||'').indexOf(${JSON.stringify(JACKET_PAGE_PART)})<0){srpModal(TITLE,MSG.wrongPage);return;}
var w=null;
try{w=window.open(BASE+'/admin/song-import?${JACKET_QUERY}',${JSON.stringify(JACKET_WINDOW)});}catch(e){w=null;}
if(!w){srpModal(TITLE,MSG.popupBlocked);return;}
var found={};var titles=[];var failedPages=0;var readDone=false;var ready=false;var sent=false;var started=false;
function send(m,t){try{w.postMessage(m,BASE,t||[]);}catch(e){}}
function trySendTitles(){
  if(!ready||!readDone||sent){return;}
  sent=true;
  if(!titles.length){srpModal(TITLE,MSG.noSongs);return;}
  srpModal(TITLE,srpFmt(MSG.matching,{count:titles.length}));
  send({type:'${MSG_TITLES}',titles:titles,failedPages:failedPages});
}
function readCat(i){
  if(i>=${JACKET_CATEGORIES}){readDone=true;trySendTitles();return;}
  srpModal(TITLE,srpFmt(MSG.reading,{n:i+1,total:${JACKET_CATEGORIES}}));
  var url=location.pathname+'?gtype=gf&cat='+i;
  var x=new XMLHttpRequest();
  x.open('GET',url,true);
  x.withCredentials=true;
  x.onload=function(){
    if(x.status===200){
      var doc=new DOMParser().parseFromString(x.responseText,'text/html');
      var rows=srpReadJackets(doc,location.href);
      for(var k=0;k<rows.length;k++){
        if(!Object.prototype.hasOwnProperty.call(found,rows[k].title)){found[rows[k].title]=rows[k].src;titles.push(rows[k].title);}
      }
    }else{failedPages++;}
    setTimeout(function(){readCat(i+1);},400);
  };
  x.onerror=function(){failedPages++;setTimeout(function(){readCat(i+1);},400);};
  x.send();
}
function convert(title,done){
  var src=found[title];
  if(!src){done(false);return;}
  var img=new Image();
  img.onload=function(){
    try{
      var c=document.createElement('canvas');c.width=${JACKET_SIZE};c.height=${JACKET_SIZE};
      var g=c.getContext('2d');
      var s=Math.min(img.naturalWidth,img.naturalHeight);
      g.drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,${JACKET_SIZE},${JACKET_SIZE});
      c.toBlob(function(b){
        if(!b||b.type!=='image/webp'||b.size>${JACKET_MAX_BYTES}){done(false);return;}
        b.arrayBuffer().then(function(buf){send({type:'${MSG_IMAGE}',title:title,data:buf},[buf]);done(true);},function(){done(false);});
      },'image/webp',${JACKET_QUALITY});
    }catch(e){done(false);}
  };
  img.onerror=function(){done(false);};
  img.src=src;
}
function fetchAll(list){
  var next=0;var finished=0;var ok=0;var total=list.length;var active=0;
  if(!total){send({type:'${MSG_DONE}',sent:0,failed:0});srpModal(TITLE,srpFmt(MSG.done,{count:0,failed:0}));return;}
  function pump(){
    while(active<2&&next<total){
      var t=list[next++];active++;
      (function(title,delay){setTimeout(function(){convert(title,function(good){
        active--;finished++;if(good){ok++;}
        srpModal(TITLE,srpFmt(MSG.converting,{n:finished,total:total}));
        if(finished===total){send({type:'${MSG_DONE}',sent:ok,failed:total-ok});srpModal(TITLE,srpFmt(MSG.done,{count:ok,failed:total-ok}));}
        else{pump();}
      });},delay);})(t,200);
    }
  }
  pump();
}
window.addEventListener('message',function(e){
  if(e.origin!==BASE||e.source!==w){return;}
  var m=e.data;
  if(!m||typeof m!=='object'){return;}
  if(m.type==='${MSG_READY}'){ready=true;trySendTitles();return;}
  if(m.type==='${MSG_WANT}'&&!started&&Object.prototype.toString.call(m.titles)==='[object Array]'){
    started=true;
    var list=[];
    for(var i=0;i<m.titles.length;i++){if(typeof m.titles[i]==='string'&&Object.prototype.hasOwnProperty.call(found,m.titles[i])){list.push(m.titles[i]);}}
    fetchAll(list);
  }
});
readCat(0);
})();`;
}

/** 북마크 주소(`javascript:…`). 최근 플레이 북마클릿과 같이 줄여서 필요한 글자만 바꾼다. */
export function buildJacketBookmarkletHref(siteBase: string, messages: JacketBookmarkletMessages): string {
  return "javascript:" + encodeBookmarklet(compactBookmarkletSource(buildJacketBookmarkletSource(siteBase, messages)));
}

/* ---------- 우리 창 쪽: 받은 메시지 검사 ---------- */

export type JacketMessage =
  | { type: typeof MSG_TITLES; titles: string[]; failedPages: number }
  | { type: typeof MSG_IMAGE; title: string; data: ArrayBuffer }
  | { type: typeof MSG_DONE; sent: number; failed: number };

const MAX_TITLES = 4000;
const MAX_TITLE_LENGTH = 300;

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100_000;
}

/**
 * 공식 창이 보낸 메시지를 검사한다. 모양이 틀리면 null(무시). 출처·보낸 창 확인은 부르는 쪽이 먼저 한다.
 * 곡명은 서버 한도(4,000개, 1~300자)와 같게, 이미지는 50KB 이하 ArrayBuffer만 받는다.
 */
export function parseJacketMessage(data: unknown): JacketMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const m = data as Record<string, unknown>;
  if (m.type === MSG_TITLES) {
    if (!Array.isArray(m.titles) || m.titles.length > MAX_TITLES) return null;
    const titles = m.titles.filter((t): t is string => typeof t === "string" && t.length >= 1 && t.length <= MAX_TITLE_LENGTH);
    if (titles.length !== m.titles.length) return null;
    return { type: MSG_TITLES, titles, failedPages: isCount(m.failedPages) ? m.failedPages : 0 };
  }
  if (m.type === MSG_IMAGE) {
    if (typeof m.title !== "string" || !(m.data instanceof ArrayBuffer)) return null;
    if (m.data.byteLength === 0 || m.data.byteLength > JACKET_MAX_BYTES) return null;
    return { type: MSG_IMAGE, title: m.title, data: m.data };
  }
  if (m.type === MSG_DONE) {
    if (!isCount(m.sent) || !isCount(m.failed)) return null;
    return { type: MSG_DONE, sent: m.sent, failed: m.failed };
  }
  return null;
}

/** 저장은 서버 한도(한 번에 10장)에 맞춰 나눈다. */
export const SAVE_BATCH = 10;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
