/**
 * 최근 플레이 가져오기 북마클릿(D34, D40).
 *
 * 사용자가 공식 최근 플레이 페이지(stage_result)를 연 상태에서 북마크를 누르면, 그 페이지에 이미 보이는 값만 읽어
 * 우리 사이트의 /import 창으로 넘긴다(서버와 직접 통신하지 않는다). 다른 페이지를 불러오지 않고(한 페이지 = 한 번 실행 = 최대 5곡),
 * Konami 계정·쿠키·페이지 전체 HTML은 읽지도 보내지도 않는다. 읽는 값은 곡명, 난이도 클래스, 판정 수, 달성률, 옵션 클래스, 플레이 시각뿐이다.
 *
 * 읽기만 하고 해석하지 않는다: 옵션/난이도 판정과 풀콤보 판정은 서버가 한다. 그래서 이 코드는 읽는 위치(selector)만 안다.
 * 읽는 위치가 바뀌면 이 파일의 READER_SOURCE만 고치면 된다(docs/DESIGN.md 18.4.0의 읽는 위치 표와 같이 갱신).
 *
 * 북마클릿은 한 줄짜리 문자열로 배포되므로 소스에는 `//` 주석을 쓰지 않고 ES5 문법만 쓴다.
 * 테스트(import-bookmarklet.test.ts)는 실제로 배포되는 이 문자열을 그대로 실행해서 확인한다.
 */

export const OFFICIAL_HOST = "p.eagate.573.jp";
export const OFFICIAL_PATH_PART = "/playdata/stage_result";

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
function senderSource(): string {
  return `
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
  overlay.setAttribute('aria-label','SRPFreaks 최근 플레이 가져오기');
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
    a.textContent='SRPFreaks 열기';
    a.href=link;
    a.target='_blank';
    a.rel='noopener noreferrer';
    srpStyle(a,{padding:'8px 14px',borderRadius:'8px',border:'1px solid #4b5368',color:'#f2f4f8',textDecoration:'none',fontSize:'14px'});
    row.appendChild(a);
  }
  var close=document.createElement('button');
  close.type='button';
  close.textContent='확인';
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
 * 토큰 없는 북마클릿 본문 (D40). 공식 페이지에서 값을 읽어 사이트의 `/import#srp=<JSON>`으로 넘기기만 한다.
 * 서버와 직접 통신하지 않으므로 토큰이 필요 없고, 북마크에는 사이트 주소만 들어 있다(비밀값 없음).
 * 같은 이름(srpfreaks-import)의 창을 재사용해서 다음 쪽을 보낼 때도 같은 탭에 이어서 쌓인다.
 * 창을 막으면(팝업 차단) 안내 창에 같은 주소의 링크를 둔다.
 * @param siteBase 사이트 주소(예: https://srpfreaks.com). 설정 화면을 연 사이트의 origin에서 만든다.
 */
export function buildHandoffBookmarkletSource(siteBase: string): string {
  const base = siteBase.replace(/\/+$/, "");
  return `(function(){
${READER_SOURCE}
${senderSource()}
var TITLE='SRPFreaks 최근 플레이 가져오기';
if(location.hostname!==${JSON.stringify(OFFICIAL_HOST)}||location.pathname.indexOf(${JSON.stringify(OFFICIAL_PATH_PART)})<0){srpModal(TITLE,'최근 플레이 페이지(stage_result)에서 실행해 주세요.');return;}
var read=srpReadPlays(document);
if(!read.plays.length){srpModal(TITLE,'읽을 수 있는 플레이가 없습니다.'+(read.unreadable?' (읽지 못한 항목 '+read.unreadable+'개)':''));return;}
var translated=false;
for(var t=0;t<read.plays.length;t++){if(read.plays[t].translated){translated=true;}}
if(translated){srpModal(TITLE,'이 페이지가 번역된 상태라 곡명을 정확히 읽을 수 없어 아무것도 보내지 않았습니다.\\n\\n주소창 오른쪽의 번역 아이콘에서 "원본 보기"를 누르고(또는 일본어는 번역하지 않기를 선택하고) 페이지를 새로고침한 뒤 다시 눌러 주세요.');return;}
var url=${JSON.stringify(base)}+'/import#srp='+encodeURIComponent(JSON.stringify({plays:read.plays,unreadable:read.unreadable}));
var w=null;
try{w=window.open(url,'srpfreaks-import');}catch(e){w=null;}
if(!w){srpModal(TITLE,'플레이 '+read.plays.length+'곡을 읽었습니다. 아래 버튼으로 SRPFreaks를 열어 이어서 처리해 주세요.',url);}
})();`;
}

/** 토큰 없는 북마크 주소(`javascript:…`). */
export function buildHandoffBookmarkletHref(siteBase: string): string {
  return "javascript:" + encodeURIComponent(buildHandoffBookmarkletSource(siteBase));
}
