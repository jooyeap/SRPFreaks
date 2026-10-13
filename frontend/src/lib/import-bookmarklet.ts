/**
 * 최근 플레이 가져오기 북마클릿(D34).
 *
 * 사용자가 공식 최근 플레이 페이지(stage_result)를 연 상태에서 북마크를 누르면, 그 페이지에 이미 보이는 값만 읽어
 * 우리 서버(/api/v1/imports/recent-plays)로 보낸다. 다른 페이지를 불러오지 않고(한 페이지 = 한 번 실행 = 최대 5곡),
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

const REASON_LABELS: Record<string, string> = {
  UNSUPPORTED_GAME_TYPE: "기타/베이스가 아닌 플레이",
  TRANSLATED_PAGE: "번역된 페이지에서 읽음",
  OPTION_NOT_SUPPORTED: "옵션이 S.RANDOM+/BUTTON OFF/AUTO OFF가 아님",
  UNKNOWN_DIFFICULTY: "지원하지 않는 난이도",
  SONG_NOT_FOUND: "곡 목록에 없음",
  AMBIGUOUS_SONG: "같은 이름의 곡이 여러 개",
  INVALID_VALUE: "값이 올바르지 않음",
  LOWER_THAN_BEST: "기존 기록보다 낮음",
  NOT_IMPROVED: "기존 기록과 같음",
};

/** 북마클릿 안에서 쓰는 결과 안내 함수 소스. 사유 이름 → 한글 표를 같이 넣는다. */
function senderSource(): string {
  return `
var SRP_REASONS=${JSON.stringify(REASON_LABELS)};
function srpSummary(res){
  var lines=['저장 '+res.saved+'곡, 건너뜀 '+res.skipped+'곡'];
  var keys=Object.keys(res.skippedByReason||{});
  for(var i=0;i<keys.length;i++){lines.push('- '+(SRP_REASONS[keys[i]]||keys[i])+': '+res.skippedByReason[keys[i]]+'곡');}
  if(res.excludedSongs&&res.excludedSongs.length){lines.push('');lines.push('곡 목록에 없어 제외한 곡:');for(var j=0;j<res.excludedSongs.length;j++){lines.push('· '+res.excludedSongs[j]);}}
  return lines.join('\\n');
}
`;
}

/**
 * 북마클릿 본문(함수 호출 형태의 JS)을 만든다.
 * @param apiBase 우리 서버 API 주소(예: https://example.com/api/v1). 이 값은 설정 화면을 연 사이트의 주소에서 만든다.
 * @param token 가져오기 토큰 원문(srpi_…). 북마크에 들어가므로 화면에서 주의를 안내한다.
 */
export function buildBookmarkletSource(apiBase: string, token: string): string {
  return `(function(){
${READER_SOURCE}
${senderSource()}
if(location.hostname!==${JSON.stringify(OFFICIAL_HOST)}||location.pathname.indexOf(${JSON.stringify(OFFICIAL_PATH_PART)})<0){alert('최근 플레이 페이지(stage_result)에서 실행해 주세요.');return;}
var read=srpReadPlays(document);
if(!read.plays.length){alert('읽을 수 있는 플레이가 없습니다.'+(read.unreadable?' (읽지 못한 항목 '+read.unreadable+'개)':''));return;}
fetch(${JSON.stringify(apiBase)}+'/imports/recent-plays',{method:'POST',headers:{'Authorization':'Bearer '+${JSON.stringify(token)},'Content-Type':'application/json'},body:JSON.stringify({plays:read.plays})})
.then(function(r){
  if(r.status===401){throw new Error('가져오기 토큰이 올바르지 않거나 폐기되었습니다. 설정에서 다시 발급해 주세요.');}
  if(r.status===429){throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');}
  if(!r.ok){throw new Error('가져오지 못했습니다. (오류 '+r.status+')');}
  return r.json();
})
.then(function(res){alert(srpSummary(res)+(read.unreadable?'\\n\\n읽지 못한 항목 '+read.unreadable+'개는 보내지 않았습니다.':''));})
.catch(function(e){alert(e&&e.message&&e.message.indexOf('Failed to fetch')<0?e.message:'서버에 연결하지 못했습니다. 공식 사이트가 외부 연결을 막았을 수 있습니다.');});
})();`;
}

/** 북마크 주소(`javascript:…`)로 만든다. */
export function buildBookmarkletHref(apiBase: string, token: string): string {
  return "javascript:" + encodeURIComponent(buildBookmarkletSource(apiBase, token));
}
