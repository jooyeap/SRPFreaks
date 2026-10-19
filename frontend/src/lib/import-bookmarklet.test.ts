import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildBookmarkletHref, buildBookmarkletSource, READER_SOURCE, type ReadResult } from "@/lib/import-bookmarklet";

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

describe("북마클릿 실행", () => {
  const fetchMock = vi.fn();
  const API = "https://srp.example.com/api/v1";

  function run(location: { hostname: string; pathname: string }) {
    const fn = new Function("document", "location", "fetch", buildBookmarkletSource(API, "srpi_token"));
    fn(document, location, fetchMock);
  }
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const OFFICIAL = { hostname: "p.eagate.573.jp", pathname: "/game/gfdm/gitadora_galaxywave_delta/p/playdata/stage_result.html" };
  const modal = () => document.getElementById("srp-import-modal");
  const modalText = () => modal()?.textContent ?? "";

  beforeEach(() => {
    fetchMock.mockReset();
    document.body.innerHTML = block({});
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("공식 최근 플레이 페이지가 아니면 보내지 않고 안내한다", () => {
    run({ hostname: "example.com", pathname: "/" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(modalText()).toContain("stage_result");
  });

  it("누르면 바로 처리 중 창이 뜨고, 읽은 값을 토큰과 함께 한 번만 보낸 뒤 같은 창이 결과로 바뀐다", async () => {
    let finish: (v: unknown) => void = () => undefined;
    fetchMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    run(OFFICIAL);

    // 서버 응답 전: 처리 중 안내가 보이고 창은 하나뿐이다
    expect(modalText()).toContain("서버로 보내는 중");
    expect(modal()).toHaveAttribute("role", "dialog");

    finish({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ saved: 0, skipped: 1, skippedByReason: { SONG_NOT_FOUND: 1 }, results: [], excludedSongs: ["Stargazer"] }),
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API}/imports/recent-plays`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer srpi_token");
    expect(JSON.parse(String(init.body)).plays).toHaveLength(1);
    expect(document.querySelectorAll("#srp-import-modal")).toHaveLength(1);
    expect(modalText()).toContain("저장 0곡, 건너뜀 1곡");
    expect(modalText()).toContain("곡 목록에 없음: 1곡");
    expect(modalText()).toContain("· Stargazer");
  });

  it("저장된 곡이 있으면 완료 제목과 SRPFreaks 링크를 보여 주고, 확인을 누르면 창이 닫힌다", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ saved: 1, skipped: 0, skippedByReason: {}, results: [], excludedSongs: [] }) });
    run(OFFICIAL);
    await flush();
    expect(modalText()).toContain("가져오기 완료");
    const link = modal()?.querySelector("a");
    expect(link).toHaveAttribute("href", "https://srp.example.com");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    const close = Array.from(modal()?.querySelectorAll("button") ?? []).find((el) => el.textContent === "확인");
    close?.click();
    expect(modal()).toBeNull();
  });

  it("서버가 준 글자는 HTML로 해석하지 않고 글자로만 보여 준다", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ saved: 0, skipped: 1, skippedByReason: {}, results: [], excludedSongs: ["<img src=x onerror=alert(1)>"] }),
    });
    run(OFFICIAL);
    await flush();
    expect(modal()?.querySelector("img")).toBeNull();
    expect(modalText()).toContain("<img src=x onerror=alert(1)>");
  });

  it("안내 창은 브라우저 번역 대상에서 뺀다(번역된 페이지에서 안내 글이 바뀌어 보이던 문제)", () => {
    run({ hostname: "example.com", pathname: "/" });
    expect(modal()).toHaveAttribute("translate", "no");
    expect(modal()).toHaveClass("notranslate");
  });

  it("번역된 페이지에서는 서버로 보내지 않고 번역을 끄라고 안내한다", () => {
    document.body.innerHTML = block({ translated: true });
    run(OFFICIAL);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(modalText()).toContain("번역된 상태");
    expect(modalText()).toContain("원본 보기");
  });

  it("토큰이 거절되면(401) 다시 발급하라고 안내한다", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) });
    run(OFFICIAL);
    await flush();
    expect(modalText()).toContain("다시 발급");
  });

  it("연결 자체가 막히면 그 가능성을 안내한다", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    run(OFFICIAL);
    await flush();
    expect(modalText()).toContain("외부 연결");
  });

  it("읽을 플레이가 없으면 보내지 않는다", () => {
    document.body.innerHTML = "<p>없음</p>";
    run(OFFICIAL);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(modalText()).toContain("읽을 수 있는 플레이가 없습니다");
  });

  it("북마크 주소는 javascript: 로 시작하고 `//` 주석이 없는 한 덩어리다", () => {
    const href = buildBookmarkletHref(API, "srpi_token");
    expect(href.startsWith("javascript:")).toBe(true);
    const source = decodeURIComponent(href.slice("javascript:".length));
    expect(source).toBe(buildBookmarkletSource(API, "srpi_token"));
    expect(source.replace(/https:\/\//g, "")).not.toContain("//");
  });
});
