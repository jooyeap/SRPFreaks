/**
 * 최근 플레이 가져오기 북마클릿(D34, D40).
 *
 * 사용자가 공식 최근 플레이 페이지(stage_result)를 연 상태에서 북마크를 누르면, 그 페이지와 같은 목록의 1~4쪽(최대 20곡)을
 * 사용자 브라우저가 같은 사이트 안에서 불러와(같은 출처 fetch, 사용자의 로그인 상태 그대로) 값만 읽어
 * 우리 사이트의 /import 창으로 넘긴다(우리 서버는 공식 사이트와 통신하지 않는다). 쪽 사이에 0.4초씩 쉰다.
 * Konami 계정·쿠키·페이지 전체 HTML은 읽지도 보내지도 않는다. 읽는 값은 곡명, 난이도 클래스, 판정 수, 달성률, 옵션 클래스, 플레이 시각뿐이다.
 *
 * 읽기만 하고 해석하지 않는다: 옵션/난이도 판정과 풀콤보 판정은 서버가 한다. 그래서 이 코드는 읽는 위치(selector)만 안다.
 * 읽는 위치가 바뀌면 이 파일의 READER_SOURCE만 고치면 된다(docs/DESIGN.md 18.4.0의 읽는 위치 표와 같이 갱신).
 *
 * 북마클릿은 한 줄짜리 문자열로 배포되므로 소스에는 `//` 주석을 쓰지 않고 ES5 문법만 쓴다.
 * 테스트(import-bookmarklet.test.ts)는 실제로 배포되는 이 문자열을 그대로 실행해서 확인한다.
 */

import type { Translator } from "@/i18n/translator";

export const OFFICIAL_HOST = "p.eagate.573.jp";
export const OFFICIAL_PATH_PART = "/playdata/stage_result";

/**
 * 공식 페이지 위에 띄우는 안내 창의 문구. 북마클릿은 공식 사이트에서 실행되어 이 앱의 번역 함수를 쓸 수 없으므로,
 * 북마크를 만들 때(= 화면 언어가 정해진 때) 문구를 소스에 담아 둔다. `{count}` 같은 자리는 북마클릿 안에서 채운다.
 */
export interface BookmarkletMessages {
  title: string;
  open: string;
  ok: string;
  wrongPage: string;
  noPlays: string;
  unreadable: string;
  translated: string;
  openManually: string;
  sentFailed: string;
  loading: string;
}

/** 지금 화면 언어의 안내 문구. 자리 표시(`{n}` 등)는 번역 함수가 채우지 않도록 같은 글자로 되돌려 넣는다. */
export function bookmarkletMessages(t: Translator): BookmarkletMessages {
  return {
    title: t("Import.bmTitle"),
    open: t("Import.bmOpen"),
    ok: t("Import.bmOk"),
    wrongPage: t("Import.bmWrongPage"),
    noPlays: t("Import.bmNoPlays"),
    unreadable: t("Import.bmUnreadable", { n: "{n}" }),
    translated: t("Import.bmTranslated"),
    openManually: t("Import.bmOpenManually", { count: "{count}" }),
    sentFailed: t("Import.bmSentFailed", { count: "{count}", failed: "{failed}" }),
    loading: t("Import.bmLoading", { max: "{max}" }),
  };
}

/** 읽은 한 건. 서버 ImportPlayRequest와 같은 모양이다. */
export interface ReadPlay {
  playedAtMs: number;
  gameType: string;
  title: string;
  difficultyClass: string;
  rate: number;
  ok: number;
  miss: number;
  translated: boolean;
  options: string[];
}

export interface ReadResult {
  plays: ReadPlay[];
  /** 읽지 못해 보내지 않은 건수(값이 비었거나 숫자가 아님) */
  unreadable: number;
}

/** 페이지에서 값을 읽는 함수. `srpReadPlays(document)`가 ReadResult를 돌려준다. */
export const READER_SOURCE = `
function srpText(el){return el?(el.textContent||'').replace(/\\s+/g,' ').trim():'';}
function srpInt(text){var d=String(text).replace(/[^0-9]/g,'');return d===''?NaN:parseInt(d,10);}
function srpRate(text){
  var t=String(text).trim();
  if(/MAX/i.test(t)){return 10000;}
  var m=t.match(/^([0-9]+(?:\\.[0-9]+)?)\\s*%?$/);
  return m?Math.round(parseFloat(m[1])*100):NaN;
}
function srpReadPlays(doc){
  var blocks=doc.querySelectorAll('.sr_list_tb');
  var root=doc.documentElement;
  var pageTranslated=/translated/.test(root.className||'');
  var plays=[];var unreadable=0;
  for(var i=0;i<blocks.length;i++){
    var b=blocks[i];
    var title=srpText(b.querySelector('.sr_data_music_info_tb .title'));
    var diffCell=b.querySelector('td.score_data_diff');
    var diffClass='';
    if(diffCell){var cls=diffCell.className.split(/\\s+/);for(var c=0;c<cls.length;c++){if(cls[c]&&cls[c]!=='score_data_diff'){diffClass=cls[c];break;}}}
    var rows=b.querySelectorAll('.sr_data_score_tb tr');
    var ok=NaN;var miss=NaN;
    if(rows.length>5){ok=srpInt(srpText(rows[4].querySelector('td.score_data')));miss=srpInt(srpText(rows[5].querySelector('td.score_data')));}
    var heads=b.querySelectorAll('.sr_data_score_tb th.score_data');
    var rate=heads.length?srpRate(srpText(heads[heads.length-1])):NaN;
    var gt=b.querySelector('input[name=gtype]');
    var dm=b.querySelector('input[name=date_ms]');
    var gameType=gt?gt.value:'';
    var playedAtMs=dm?parseInt(dm.value,10):NaN;
    var options=[];
    var icons=b.querySelectorAll('.cc_box li');
    for(var k=0;k<icons.length;k++){
      var oc=icons[k].className.split(/\\s+/);
      for(var q=0;q<oc.length;q++){if(oc[q]&&oc[q]!=='cc_icon'){options.push(oc[q]);}}
    }
    var translated=pageTranslated||!!b.querySelector('font[dir=auto]');
    if(!title||!diffClass||!gameType||isNaN(playedAtMs)||isNaN(rate)||isNaN(ok)||isNaN(miss)){unreadable++;continue;}
    plays.push({playedAtMs:playedAtMs,gameType:gameType,title:title,difficultyClass:diffClass,rate:rate,ok:ok,miss:miss,translated:translated,options:options});
  }
  return {plays:plays,unreadable:unreadable};
}
`;


/**
 * 북마클릿 안에서 쓰는 안내 함수 소스: 공식 페이지 위에 띄우는 안내 창(srpModal).
 * 안내 창은 alert 대신 쓴다: 안내 문장과 사이트 열기 링크를 한 화면에 담을 수 있다.
 * 글자는 textContent로만 넣고(글자가 HTML로 해석되지 않는다), 모양은 element.style로 지정한다
 * (style 속성 문자열은 공식 페이지의 CSP에 막힐 수 있어서 쓰지 않는다).
 * 창에는 translate="no"를 단다: 번역된 페이지에 끼워 넣은 글을 브라우저가 다시 번역해 안내 문장이 잘려 나왔다.
 */
export function senderSource(): string {
  return `
function srpFmt(s,o){for(var k in o){if(Object.prototype.hasOwnProperty.call(o,k)){s=s.split('{'+k+'}').join(String(o[k]));}}return s;}
function srpStyle(el,css){for(var k in css){if(Object.prototype.hasOwnProperty.call(css,k)){el.style[k]=css[k];}}}
function srpModal(title,body,link){
  var old=document.getElementById('srp-import-modal');
  if(old&&old.parentNode){old.parentNode.removeChild(old);}
  var overlay=document.createElement('div');
  overlay.id='srp-import-modal';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('translate','no');
  overlay.className='notranslate';
  overlay.setAttribute('aria-label',MSG.title);
  srpStyle(overlay,{position:'fixed',left:'0',top:'0',right:'0',bottom:'0',zIndex:'2147483647',background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center'});
  var box=document.createElement('div');
  srpStyle(box,{background:'#1b1f2a',color:'#f2f4f8',padding:'20px',borderRadius:'12px',width:'calc(100% - 32px)',maxWidth:'420px',maxHeight:'80vh',overflowY:'auto',fontSize:'14px',lineHeight:'1.6',fontFamily:'sans-serif',boxSizing:'border-box',textAlign:'left'});
  var h=document.createElement('div');
  h.textContent=title;
  srpStyle(h,{fontSize:'16px',fontWeight:'bold',marginBottom:'10px'});
  var p=document.createElement('div');
  p.textContent=body;
  srpStyle(p,{whiteSpace:'pre-line',marginBottom:'16px'});
  var row=document.createElement('div');
  srpStyle(row,{display:'flex',gap:'8px',justifyContent:'flex-end',flexWrap:'wrap'});
  if(link){
    var a=document.createElement('a');
    a.textContent=MSG.open;
    a.href=link;
    a.target='_blank';
    a.rel='noopener noreferrer';
    srpStyle(a,{padding:'8px 14px',borderRadius:'8px',border:'1px solid #4b5368',color:'#f2f4f8',textDecoration:'none',fontSize:'14px'});
    row.appendChild(a);
  }
  var close=document.createElement('button');
  close.type='button';
  close.textContent=MSG.ok;
  srpStyle(close,{padding:'8px 18px',borderRadius:'8px',border:'0',background:'#f2f4f8',color:'#111827',fontSize:'14px',fontWeight:'bold',cursor:'pointer'});
  close.onclick=function(){if(overlay.parentNode){overlay.parentNode.removeChild(overlay);}};
  row.appendChild(close);
  box.appendChild(h);box.appendChild(p);box.appendChild(row);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  close.focus();
}
`;
}

/**
 * 북마클릿 소스에서 줄바꿈과 들여쓰기를 없애 짧게 만든다(동작은 같다).
 *
 * 왜 하는가: 사용자는 모바일에서 이 글자를 통째로 복사해 공식 사이트 주소창에 붙여넣는다. 길수록 붙여넣기가 오래 걸린다.
 * 어떻게: 줄 앞의 공백과 줄바꿈만 지운다. 글자열 안의 공백은 건드리지 않는다(소스에 여러 줄짜리 글자열이 없다).
 * 앞 줄이 `; { } ( , [ ...`로 끝나면 바로 붙이고, 그렇지 않으면(예: `else` 다음 줄 `if`) 공백 하나를 둬서 낱말이 붙지 않게 한다.
 * 줄바꿈에 기대는 자동 세미콜론 삽입(ASI)이 없다는 가정이다: 테스트가 이 짧아진 글자를 그대로 실행해서 확인한다.
 */
export function compactBookmarkletSource(source: string): string {
  const lines = source.split("\n").map((line) => line.replace(/^[ \t]+/, "").replace(/[ \t]+$/, "")).filter((line) => line !== "");
  let out = "";
  for (const line of lines) {
    if (out !== "" && !/[;{}(,\[:=+\-*/&|?!]$/.test(out)) {
      out += " ";
    }
    out += line;
  }
  return out;
}

/**
 * 북마크 주소와 붙여넣기용 본문에 쓰는 인코딩.
 * encodeURIComponent는 한글(3바이트)을 `%XX%XX%XX`(9글자)로 바꾸고 `{ } ; = : ,` 같은 기호도 바꿔서 글자가 6할 가까이 늘었다.
 * 여기서는 주소로 쓰기에 꼭 필요한 글자만 바꾼다: `%`(바꾸지 않으면 뒤 글자가 해석된다), `#`(주소의 조각 시작),
 * 줄바꿈·탭(주소에서 지워진다), `" < > \``와 `\`. 한글·일본어와 나머지 기호는 그대로 둔다.
 * 브라우저는 `javascript:` 주소를 실행하기 전에 `%XX`를 되돌리므로 실행되는 코드는 같다(decodeURIComponent로 되돌려도 같다).
 */
export function encodeBookmarklet(source: string): string {
  return source.replace(/[%#\r\n\t"<>`\\]/g, (ch) => "%" + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"));
}

/**
 * 토큰 없는 북마클릿 본문 (D40). 공식 페이지에서 값을 읽어 사이트의 `/import#srp=<JSON>`으로 넘기기만 한다.
 * 서버와 직접 통신하지 않으므로 토큰이 필요 없고, 북마크에는 사이트 주소만 들어 있다(비밀값 없음).
 * 같은 이름(srpfreaks-import)의 창을 재사용해서 다음 쪽을 보낼 때도 같은 탭에 이어서 쌓인다.
 * 창을 막으면(팝업 차단) 안내 창에 같은 주소의 링크를 둔다.
 * @param siteBase 사이트 주소(예: https://srpfreaks.com). 설정 화면을 연 사이트의 origin에서 만든다.
 */
export function buildHandoffBookmarkletSource(siteBase: string, messages: BookmarkletMessages): string {
  const base = siteBase.replace(/\/+$/, "");
  return buildHandoffFlow(JSON.stringify(base), "", messages);
}

/**
 * 로더가 불러오는 스크립트 파일의 소스(import-loader.ts, public/import-loader/<버전>.<언어>.js).
 * 본문은 위와 같고, 사이트 주소만 다르다: 파일 안에 주소를 굳히지 않고 **이 파일을 불러온 주소의 origin**을 쓴다
 * (`document.currentScript.src`). 그래서 같은 파일을 어느 사이트(운영·로컬)에서 내려받든 그 사이트로 보낸다.
 */
export function buildLoaderFileSource(messages: BookmarkletMessages): string {
  return buildHandoffFlow("BASE", "var cs=document.currentScript;var BASE=cs&&cs.src?new URL(cs.src).origin:'';", messages);
}

/** 가져오기 본문. baseExpr는 사이트 주소를 가리키는 JS 식(글자열 또는 변수), preface는 MSG 바로 뒤에 둘 준비 코드. */
function buildHandoffFlow(baseExpr: string, preface: string, messages: BookmarkletMessages): string {
  return compactBookmarkletSource(`(function(){
var MSG=${JSON.stringify(messages)};
${preface}
${READER_SOURCE}
${senderSource()}
var TITLE=MSG.title;
if(location.hostname!==${JSON.stringify(OFFICIAL_HOST)}||location.pathname.indexOf(${JSON.stringify(OFFICIAL_PATH_PART)})<0){srpModal(TITLE,MSG.wrongPage);return;}
var read=srpReadPlays(document);
if(!read.plays.length){srpModal(TITLE,MSG.noPlays+(read.unreadable?' '+srpFmt(MSG.unreadable,{n:read.unreadable}):''));return;}
var translated=false;
for(var t=0;t<read.plays.length;t++){if(read.plays[t].translated){translated=true;}}
if(translated){srpModal(TITLE,MSG.translated);return;}
var MAXP=4;
var search=location.search||'';
var cur=1;var pm=search.match(/[?&]page=([0-9]+)/);if(pm){cur=parseInt(pm[1],10)||1;}
var kept=[];var qs=search.replace(/^\\?/,'').split('&');
for(var qi=0;qi<qs.length;qi++){if(qs[qi]&&qs[qi].indexOf('page=')!==0){kept.push(qs[qi]);}}
if(!kept.length){kept=['stype=','gtype='];}
var pages={};var failed=0;
function srpSend(){
  var plays=[];var unreadable=0;
  for(var n=1;n<=MAXP;n++){if(pages[n]){plays=plays.concat(pages[n].plays);unreadable+=pages[n].unreadable;}}
  var prev=document.getElementById('srp-import-modal');
  if(prev&&prev.parentNode){prev.parentNode.removeChild(prev);}
  var url=${baseExpr}+'/import#srp='+encodeURIComponent(JSON.stringify({plays:plays,unreadable:unreadable}));
  var w=null;
  try{w=window.open(url,'srpfreaks-import');}catch(e){w=null;}
  if(!w){srpModal(TITLE,srpFmt(MSG.openManually,{count:plays.length}),url);return;}
  if(failed){srpModal(TITLE,srpFmt(MSG.sentFailed,{count:plays.length,failed:failed}));}
}
function srpLoad(n){
  if(n>MAXP){srpSend();return;}
  if(n===cur){pages[n]=read;srpLoad(n+1);return;}
  var u=location.pathname+'?'+kept.join('&')+'&page='+n;
  window.fetch(u,{credentials:'same-origin'}).then(function(r){if(!r.ok){throw new Error('http');}return r.text();}).then(function(txt){
    pages[n]=srpReadPlays(new window.DOMParser().parseFromString(txt,'text/html'));
  },function(){failed++;}).then(function(){setTimeout(function(){srpLoad(n+1);},400);},function(){failed++;setTimeout(function(){srpLoad(n+1);},400);});
}
if(typeof window.fetch==='function'&&typeof window.DOMParser==='function'){
  srpModal(TITLE,srpFmt(MSG.loading,{max:MAXP}));
  srpLoad(1);
}else{
  pages[cur]=read;srpSend();
}
})();`);
}

/** 토큰 없는 북마크 주소(`javascript:…`). */
export function buildHandoffBookmarkletHref(siteBase: string, messages: BookmarkletMessages): string {
  return "javascript:" + encodeBookmarklet(buildHandoffBookmarkletSource(siteBase, messages));
}
