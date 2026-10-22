import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSongBookmarkletHref,
  buildSongBookmarkletSource,
  MAX_SONGS,
  READER_SOURCE,
  songBookmarkletMessages,
  type ReadSongsResult,
} from "@/lib/official-song-reader";
import { koT } from "@/i18n/ko-translator";

const MSG = songBookmarkletMessages(koT);
const SITE = "https://srpfreaks.test";

/**
 * 공식 곡 목록(`music/index.html`)의 표 구조를 본뜬 테스트용 HTML (docs/DESIGN.md 18.4.0-2, D17 점검 기록).
 * 열 수가 1(이벤트 구분), 6(머리글), 8(곡의 첫 행), 5(같은 곡의 둘째 행)인 줄이 섞여 있다.
 */
const dif = (n: number, text: string) => `<td class="dif td_c${n}">${text}</td>`;
const first = (title: string, artist: string, part: "g" | "b", levels: [string, string, string, string]) =>
  `<tr><td class="jk"><img></td><td class="title">${title}</td><td class="artist">${artist}</td><td class="type td_${part}">${part.toUpperCase()}</td>${levels
    .map((l, i) => dif(i + 1, l))
    .join("")}</tr>`;
const second = (part: "g" | "b", levels: [string, string, string, string]) =>
  `<tr><td class="type td_${part}">${part.toUpperCase()}</td>${levels.map((l, i) => dif(i + 1, l)).join("")}</tr>`;
const EVENT = `<tr><td colspan="8">NEW MUSIC 2026</td></tr>`;
const HEADER = `<tr><th>제목</th><th>아티스트</th><th>BSC</th><th>ADV</th><th>EXT</th><th>MAS</th></tr>`;

function table(rows: string): string {
  return `<table><tbody>${rows}</tbody></table>`;
}

function read(html: string): ReadSongsResult {
  document.body.innerHTML = html;
  const fn = new Function("document", `${READER_SOURCE}; return srpReadSongs(document);`) as (d: Document) => ReadSongsResult;
  return fn(document);
}

describe("공식 곡 목록 읽기", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.className = "";
  });

  it("곡의 첫 줄과 둘째 줄에서 곡명, 아티스트, 파트별 레벨 네 개를 읽는다", () => {
    const { songs, unreadable, translated } = read(
      table(EVENT + HEADER + first("Song A", " Artist X ", "g", ["3.50", "5.20", "7.10", "8.55"]) + second("b", ["2.50", "4.00", "6.00", "7.45"])),
    );
    expect(unreadable).toBe(0);
    expect(translated).toBe(false);
    expect(songs).toEqual([
      {
        title: "Song A",
        artist: "Artist X",
        charts: [
          { part: "G", levels: ["3.50", "5.20", "7.10", "8.55"] },
          { part: "B", levels: ["2.50", "4.00", "6.00", "7.45"] },
        ],
      },
    ]);
  });

  it("레벨은 칸 순서가 아니라 클래스(td_c1~c4)로 BSC·ADV·EXT·MAS 자리를 정한다", () => {
    const row = `<tr><td></td><td>Song B</td><td>Y</td><td class="type td_g">G</td>${dif(4, "9.00")}${dif(3, "7.00")}${dif(2, "5.00")}${dif(1, "3.00")}</tr>`;
    expect(read(table(row)).songs[0]?.charts[0]?.levels).toEqual(["3.00", "5.00", "7.00", "9.00"]);
  });

  it("없는 채보(빈 칸, -)는 빈 글자나 -로 그대로 넘긴다(해석은 서버가 한다)", () => {
    const { songs } = read(table(first("Song C", "Z", "g", ["", "-", "7.00", "8.00"])));
    expect(songs[0]?.charts[0]?.levels).toEqual(["", "-", "7.00", "8.00"]);
  });

  it("여러 곡을 순서대로 읽고, 이벤트·머리글 줄은 건너뛴다", () => {
    const { songs } = read(table(EVENT + HEADER + first("One", "A", "g", ["1", "2", "3", "4"]) + EVENT + first("Two", "B", "b", ["1", "2", "3", "4"])));
    expect(songs.map((s) => s.title)).toEqual(["One", "Two"]);
  });

  it("앞선 곡 없이 시작한 둘째 줄과 파트를 알 수 없는 줄은 읽지 못한 것으로 센다", () => {
    const unknownPart = `<tr><td></td><td>Song D</td><td>Q</td><td class="type">?</td>${dif(1, "1")}${dif(2, "2")}${dif(3, "3")}${dif(4, "4")}</tr>`;
    const { songs, unreadable } = read(table(second("g", ["1", "2", "3", "4"]) + unknownPart));
    expect(unreadable).toBe(2);
    expect(songs).toHaveLength(1); // 곡명이 있는 줄은 곡으로 남지만 채보는 비어 있다
    expect(songs[0]?.charts).toEqual([]);
  });

  it("곡명이 비어 있는 첫 줄은 읽지 못한 것으로 세고 그 뒤 둘째 줄을 다른 곡에 붙이지 않는다", () => {
    const { songs, unreadable } = read(table(first("Real", "A", "g", ["1", "2", "3", "4"]) + first("", "B", "g", ["1", "2", "3", "4"]) + second("b", ["5", "6", "7", "8"])));
    expect(unreadable).toBe(2);
    expect(songs).toHaveLength(1);
    expect(songs[0]?.charts).toHaveLength(1);
  });

  it("브라우저 번역 흔적(font[dir=auto])이 있으면 번역된 페이지로 알린다", () => {
    const { translated } = read(table(`<tr><td></td><td><font dir="auto">Song</font></td><td>A</td><td class="type td_g">G</td>${dif(1, "1")}${dif(2, "2")}${dif(3, "3")}${dif(4, "4")}</tr>`));
    expect(translated).toBe(true);
  });
});

describe("공식 곡 목록 북마클릿 실행", () => {
  const openMock = vi.fn();
  const OFFICIAL = { hostname: "p.eagate.573.jp", pathname: "/game/gfdm/gitadora_galaxywave_delta/p/music/index.html" };
  const modal = () => document.getElementById("srp-import-modal");

  function run(location: { hostname: string; pathname: string }) {
    const fn = new Function("document", "location", "window", buildSongBookmarkletSource(SITE, MSG));
    fn(document, location, { open: openMock });
  }

  beforeEach(() => {
    openMock.mockReset();
    document.body.innerHTML = table(first("Song A", "Artist X", "g", ["1.00", "2.00", "3.00", "4.00"]));
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("토큰·서버 주소 없이 사이트 주소만 들어 있고, 추가 요청(fetch)을 보내지 않는다", () => {
    const source = buildSongBookmarkletSource(SITE, MSG);
    expect(source).toContain(SITE);
    expect(source).not.toContain("fetch");
    expect(source).not.toContain("Authorization");
    expect(buildSongBookmarkletHref(SITE, MSG).startsWith("javascript:")).toBe(true);
  });

  it("공식 사이트가 아니면 안내만 하고 창을 열지 않는다", () => {
    run({ hostname: "example.com", pathname: OFFICIAL.pathname });
    expect(openMock).not.toHaveBeenCalled();
    expect(modal()?.textContent).toContain("곡 목록 페이지에서 실행");
  });

  it("기록 목록 페이지(/playdata/music.html)와 다른 페이지에서는 실행하지 않는다", () => {
    run({ hostname: OFFICIAL.hostname, pathname: "/game/gfdm/gitadora_galaxywave_delta/p/playdata/music.html" });
    run({ hostname: OFFICIAL.hostname, pathname: "/game/gfdm/gitadora_galaxywave_delta/p/playdata/stage_result.html" });
    expect(openMock).not.toHaveBeenCalled();
  });

  it("읽은 값을 같은 이름의 창으로 사이트 /admin/song-import#srpsong= 조각에 담아 연다", () => {
    openMock.mockReturnValue({});
    run(OFFICIAL);
    expect(openMock).toHaveBeenCalledTimes(1);
    const [url, name] = openMock.mock.calls[0] as [string, string];
    expect(name).toBe("srpfreaks-song-import");
    const prefix = `${SITE}/admin/song-import#srpsong=`;
    expect(url.startsWith(prefix)).toBe(true);
    const payload = JSON.parse(decodeURIComponent(url.slice(prefix.length))) as { songs: { title: string; artist: string }[] };
    expect(payload.songs).toEqual([{ title: "Song A", artist: "Artist X", charts: [{ part: "G", levels: ["1.00", "2.00", "3.00", "4.00"] }] }]);
    expect(modal()).toBeNull();
  });

  it("곡을 하나도 읽지 못하면 창을 열지 않고 안내한다", () => {
    document.body.innerHTML = "<p>빈 페이지</p>";
    run(OFFICIAL);
    expect(openMock).not.toHaveBeenCalled();
    expect(modal()?.textContent).toContain("곡을 찾지 못했습니다");
  });

  it("번역된 페이지에서는 보내지 않는다", () => {
    document.body.innerHTML = table(`<tr><td></td><td><font dir="auto">Song</font></td><td>A</td><td class="type td_g">G</td>${dif(1, "1")}${dif(2, "2")}${dif(3, "3")}${dif(4, "4")}</tr>`);
    run(OFFICIAL);
    expect(openMock).not.toHaveBeenCalled();
    expect(modal()).not.toBeNull();
  });

  it("창이 막히면 안내 창에 같은 주소의 링크를 둔다", () => {
    openMock.mockReturnValue(null);
    run(OFFICIAL);
    const link = modal()?.querySelector("a");
    expect(link?.getAttribute("href")?.startsWith(`${SITE}/admin/song-import#srpsong=`)).toBe(true);
  });

  it(`곡이 ${MAX_SONGS}개를 넘으면 처음 ${MAX_SONGS}개만 보내고 알린다`, () => {
    openMock.mockReturnValue({});
    document.body.innerHTML = table(Array.from({ length: MAX_SONGS + 5 }, (_, i) => first(`Song ${i}`, "A", "g", ["1", "2", "3", "4"])).join(""));
    run(OFFICIAL);
    const url = (openMock.mock.calls[0] as [string])[0];
    const payload = JSON.parse(decodeURIComponent(url.slice(`${SITE}/admin/song-import#srpsong=`.length))) as { songs: unknown[] };
    expect(payload.songs).toHaveLength(MAX_SONGS);
    expect(modal()?.textContent).toContain(String(MAX_SONGS + 5));
  });
});
