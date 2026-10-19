import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildHandoffBookmarkletHref,
  buildHandoffBookmarkletSource,
  READER_SOURCE,
  type ReadResult,
} from "@/lib/import-bookmarklet";

/** 공식 최근 플레이 한 건(.sr_list_tb)의 구조를 본뜬 테스트용 HTML. 실제 샘플(Stargazer, Bass MASTER)의 위치와 클래스를 따른다. */
function block(opts: {
  title?: string;
  diff?: string;
  ok?: string;
  miss?: string;
  rate?: string;
  options?: string[];
  gtype?: string;
  dateMs?: string | null;
  translated?: boolean;
}): string {
  const o = { title: "Stargazer", diff: "bass_mst", ok: "12", miss: "110", rate: "73.87%", options: ["gf_random_5", "gf_button_1", "gf_auto_1"], gtype: "gf", dateMs: "1791796344469", translated: false, ...opts };
  const wrap = (t: string) => (o.translated ? `<font dir="auto"><font dir="auto">${t}</font></font>` : t);
  const row = (name: string, value: string) =>
    `<tr><td class="score_title">${wrap(name)}</td><td class="score_data">${wrap(value)}</td><td class="score_data_perc">1%</td></tr>`;
  return `<div class="sr_list_tb">
    <table class="sr_data_music_info_tb"><tbody><tr><td><div class="title">${wrap(`\n ${o.title}\n `)}</div></td></tr></tbody></table>
    <table class="sr_data_score_tb"><tbody>
      <tr><th class="score_title">SCORE</th><th class="score_data">456638</th><td rowspan="2" class="score_data_diff ${o.diff}">9.50</td></tr>
      ${row("PERFECT", "711")}${row("GREAT", "15")}${row("GOOD", "12")}${row("OK", o.ok)}${row("MISS", o.miss)}
      <tr><td class="score_title">MAX COMBO</td><td class="score_data">109</td></tr>
      <tr><th class="score_title">달성률</th><th class="score_data">${wrap(o.rate)}</th></tr>
    </tbody></table>
    <div class="cc_box"><ul>${o.options.map((c) => `<li class="cc_icon ${c}"></li>`).join("")}</ul></div>
    <form><input type="hidden" name="gtype" value="${o.gtype}">${o.dateMs === null ? "" : `<input type="hidden" name="date_ms" value="${o.dateMs}">`}</form>
  </div>`;
}

function read(html: string): ReadResult {
  document.body.innerHTML = html;
  const fn = new Function("document", `${READER_SOURCE}; return srpReadPlays(document);`) as (d: Document) => ReadResult;
  return fn(document);
}

describe("북마클릿 읽기", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.className = "";
  });

  it("한 건에서 곡명, 난이도 클래스, 판정, 달성률, 옵션, 시각을 읽는다", () => {
    const { plays, unreadable } = read(block({}));
    expect(unreadable).toBe(0);
    expect(plays).toEqual([
      {
        playedAtMs: 1791796344469,
        gameType: "gf",
        title: "Stargazer",
        difficultyClass: "bass_mst",
        rate: 7387,
        ok: 12,
        miss: 110,
        translated: false,
        options: ["gf_random_5", "gf_button_1", "gf_auto_1"],
      },
    ]);
  });

  it("달성률 MAX는 10000으로 읽는다", () => {
    expect(read(block({ rate: "MAX" })).plays[0].rate).toBe(10000);
  });

  it("달성률 소수 표기를 x100 정수로 바꾼다(부동소수 오차 없이)", () => {
    expect(read(block({ rate: "95.07%" })).plays[0].rate).toBe(9507);
    expect(read(block({ rate: "0.00%" })).plays[0].rate).toBe(0);
  });

  it("번역 흔적(font[dir=auto])이 있으면 translated=true로 읽는다", () => {
    expect(read(block({ translated: true })).plays[0].translated).toBe(true);
  });

  it("html에 translated 클래스가 있어도 translated=true로 읽는다", () => {
    document.documentElement.className = "translated-ltr";
    expect(read(block({})).plays[0].translated).toBe(true);
  });

  it("여러 건을 순서대로 읽고 읽지 못한 건은 세어서 뺀다", () => {
    const { plays, unreadable } = read(block({ title: "A" }) + block({ title: "B", dateMs: null }) + block({ title: "C", rate: "?" }) + block({ title: "D", diff: "gf_mst" }));
    expect(plays.map((p) => p.title)).toEqual(["A", "D"]);
    expect(unreadable).toBe(2);
  });

  it("가져오기 대상이 없는 페이지에서는 빈 결과를 돌려준다", () => {
    expect(read("<p>없음</p>")).toEqual({ plays: [], unreadable: 0 });
  });
});

describe("토큰 없는 북마클릿(D40)", () => {
  const SITE = "https://srp.example.com";
  const OFFICIAL = { hostname: "p.eagate.573.jp", pathname: "/game/gfdm/gitadora_galaxywave_delta/p/playdata/stage_result.html" };
  const openMock = vi.fn();
  const modal = () => document.getElementById("srp-import-modal");

  function run(location: { hostname: string; pathname: string }) {
    const fn = new Function("document", "location", "window", buildHandoffBookmarkletSource(SITE));
    fn(document, location, { open: openMock });
  }

  beforeEach(() => {
    openMock.mockReset();
    document.body.innerHTML = block({});
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("토큰·서버 주소 없이 사이트 주소만 들어 있고, 서버와 직접 통신하지 않는다", () => {
    const source = buildHandoffBookmarkletSource(SITE);
    expect(source).not.toContain("srpi_");
    expect(source).not.toContain("Authorization");
    expect(source).not.toContain("fetch(");
    expect(source).toContain(SITE);
    expect(buildHandoffBookmarkletHref(SITE).startsWith("javascript:")).toBe(true);
  });

  it("안내 창은 브라우저 번역 대상에서 뺀다(번역된 페이지에서 안내 글이 바뀌어 보이던 문제)", () => {
    run({ hostname: "example.com", pathname: "/" });
    expect(modal()).toHaveAttribute("translate", "no");
    expect(modal()).toHaveClass("notranslate");
  });

  it("읽은 값을 같은 이름의 창으로 사이트 /import#srp= 조각에 담아 연다", () => {
    openMock.mockReturnValue({});
    run(OFFICIAL);
    expect(openMock).toHaveBeenCalledTimes(1);
    const [url, name] = openMock.mock.calls[0] as [string, string];
    expect(name).toBe("srpfreaks-import");
    expect(url.startsWith(`${SITE}/import#srp=`)).toBe(true);
    const payload = JSON.parse(decodeURIComponent(url.slice(`${SITE}/import#srp=`.length)));
    expect(payload.plays).toHaveLength(1);
    expect(payload.plays[0].title).toBe("Stargazer");
    expect(payload.unreadable).toBe(0);
    expect(modal()).toBeNull();
  });

  it("창을 열지 못하면(팝업 차단) 같은 주소의 링크가 있는 안내 창을 보여 준다", () => {
    openMock.mockReturnValue(null);
    run(OFFICIAL);
    const link = modal()?.querySelector("a");
    expect(link?.getAttribute("href")?.startsWith(`${SITE}/import#srp=`)).toBe(true);
    expect(modal()?.textContent).toContain("1곡을 읽었습니다");
  });

  it("공식 최근 플레이 페이지가 아니면 열지 않고 안내한다", () => {
    run({ hostname: "example.com", pathname: "/" });
    expect(openMock).not.toHaveBeenCalled();
    expect(modal()?.textContent).toContain("stage_result");
  });

  it("번역된 페이지에서는 아무것도 보내지 않고 번역을 끄라고 안내한다", () => {
    document.body.innerHTML = block({ translated: true });
    run(OFFICIAL);
    expect(openMock).not.toHaveBeenCalled();
    expect(modal()?.textContent).toContain("원본 보기");
  });

  it("읽을 플레이가 없으면 열지 않는다", () => {
    document.body.innerHTML = "<p>없음</p>";
    run(OFFICIAL);
    expect(openMock).not.toHaveBeenCalled();
    expect(modal()?.textContent).toContain("읽을 수 있는 플레이가 없습니다");
  });
});
