import { afterEach, describe, expect, it } from "vitest";
import {
  buildJacketBookmarkletHref,
  buildJacketBookmarkletSource,
  chunk,
  JACKET_MAX_BYTES,
  MSG_DONE,
  MSG_IMAGE,
  MSG_TITLES,
  parseJacketMessage,
  READER_SOURCE,
  type JacketBookmarkletMessages,
} from "@/lib/jacket-reader";
import { compactBookmarkletSource } from "@/lib/import-bookmarklet";

const messages: JacketBookmarkletMessages = {
  title: "T", open: "열기", ok: "확인", wrongPage: "곡별 성적 페이지에서 눌러 주세요.", popupBlocked: "팝업", reading: "{n}/{total}",
  noSongs: "없음", matching: "{count}", converting: "{n}/{total}", done: "{count} {failed}",
};

type Reader = (doc: Document, pageUrl: string) => { title: string; src: string; artist: string }[];

describe("재킷 북마클릿 (D54)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("쪽에서 재킷의 곡명(alt)과 절대 주소만 읽고, 곡명이나 주소가 없으면 건너뛴다", () => {
    const read = new Function(`${READER_SOURCE}; return srpReadJackets;`)() as Reader;
    const doc = new DOMParser().parseFromString(
      `<table>
        <tr><td><img class="jacket" alt=" 0時20分の  Roulette " src="img.html?imgkey=a&imgid=1"></td><td>98.00%</td></tr>
        <tr><td><img class="jacket" alt="" src="img.html?imgkey=b"></td></tr>
        <tr><td><img class="jacket" alt="NoSrc"></td></tr>
        <tr><td><img class="icon" alt="아이콘" src="x.png"></td></tr>
      </table>`,
      "text/html",
    );
    const rows = read(doc, "https://p.eagate.573.jp/game/gfdm/gitadora_galaxywave_delta/p/playdata/music.html?cat=0");
    expect(rows).toEqual([
      { title: "0時20分の Roulette", src: "https://p.eagate.573.jp/game/gfdm/gitadora_galaxywave_delta/p/playdata/img.html?imgkey=a&imgid=1", artist: "" },
    ]);
  });

  it("같은 줄에 아티스트가 보이면 함께 읽고, 없으면 빈 글자로 건너뛴다. BPM은 읽지 않는다 (D90, D94)", () => {
    const read = new Function(`${READER_SOURCE}; return srpReadJackets;`)() as Reader;
    const doc = new DOMParser().parseFromString(
      `<table>
        <tr><td><img class="jacket" alt="Fixed" src="a.html"></td><td class="music_artist"> Yusuke
          Kitaura </td><td class="bpm">172</td></tr>
        <tr><td><img class="jacket" alt="Variable" src="b.html"></td><td class="artist">Ryu</td><td class="bpm_text">BPM 120 - 180</td></tr>
        <tr><td><img class="jacket" alt="Label" src="c.html"></td><td>BPM: １５０</td></tr>
        <tr><td><img class="jacket" alt="Nothing" src="d.html"></td><td>98.00%</td></tr>
      </table>`,
      "text/html",
    );
    const rows = read(doc, "https://p.eagate.573.jp/x/music.html");
    expect(rows.map((r) => [r.title, r.artist])).toEqual([
      ["Fixed", "Yusuke Kitaura"],
      ["Variable", "Ryu"],
      ["Label", ""],
      ["Nothing", ""],
    ]);
    expect(JSON.stringify(rows)).not.toContain("bpm");
  });

  it("줄인 소스도 문법이 맞고, 공식 페이지가 아니면 안내만 띄우고 창을 열지 않는다", () => {
    const source = compactBookmarkletSource(buildJacketBookmarkletSource("https://srpfreaks.com/", messages));
    const run = new Function(source);
    const opened: string[] = [];
    const original = window.open;
    window.open = ((url?: string | URL) => {
      opened.push(String(url));
      return null;
    }) as typeof window.open;
    try {
      run();
    } finally {
      window.open = original;
    }
    expect(opened).toEqual([]);
    expect(document.getElementById("srp-import-modal")).toHaveTextContent("곡별 성적 페이지에서 눌러 주세요.");
  });

  it("북마크 주소는 javascript: 로 시작하고 우리 창 주소와 공식 출처 확인이 들어 있다", () => {
    const href = buildJacketBookmarkletHref("https://srpfreaks.com", messages);
    expect(href.startsWith("javascript:")).toBe(true);
    const body = decodeURIComponent(href.slice("javascript:".length));
    expect(body).toContain("/admin/song-import?jacket=1");
    expect(body).toContain("e.origin!==BASE||e.source!==w");
    expect(body).toContain("'image/webp',0.8");
  });
});

describe("parseJacketMessage", () => {
  it("곡명 목록은 1~300자 글자만, 4,000개까지 받는다", () => {
    expect(parseJacketMessage({ type: MSG_TITLES, titles: ["A", "B"], failedPages: 1 })).toEqual({ type: MSG_TITLES, titles: ["A", "B"], infos: [], failedPages: 1 });
    expect(parseJacketMessage({ type: MSG_TITLES, titles: ["A", 3] })).toBeNull();
    expect(parseJacketMessage({ type: MSG_TITLES, titles: [""] })).toBeNull();
    expect(parseJacketMessage({ type: MSG_TITLES, titles: Array(4001).fill("A") })).toBeNull();
  });

  it("곡 정보(infos)는 없어도 되고, 틀린 줄만 버리며, 옛 북마클릿이 보낸 BPM은 버린다 (D90, D94)", () => {
    const parsed = parseJacketMessage({
      type: MSG_TITLES,
      titles: ["A"],
      infos: [
        { title: "A", artist: "Ryu", bpm: "172" }, // BPM은 버리고 아티스트만 남긴다
        { title: "B", artist: "", bpm: "150" }, // 아티스트가 비면 보낼 값이 없다
        { title: "C", artist: 3, bpm: "1" },
        { title: "D", artist: "x".repeat(501) }, // 길이 초과
        null,
      ],
    });
    expect(parsed).toMatchObject({ infos: [{ title: "A", artist: "Ryu", bpm: "" }] });
    expect((parsed as { infos: unknown[] }).infos).toHaveLength(1);
    expect(parseJacketMessage({ type: MSG_TITLES, titles: ["A"], infos: "x" })).toMatchObject({ infos: [] });
  });

  it("이미지는 50KB 이하 ArrayBuffer만 받는다", () => {
    expect(parseJacketMessage({ type: MSG_IMAGE, title: "A", data: new ArrayBuffer(10) })).not.toBeNull();
    expect(parseJacketMessage({ type: MSG_IMAGE, title: "A", data: new ArrayBuffer(JACKET_MAX_BYTES + 1) })).toBeNull();
    expect(parseJacketMessage({ type: MSG_IMAGE, title: "A", data: "data:image/png;base64,AAA" })).toBeNull();
  });

  it("끝 신호와 모르는 종류", () => {
    expect(parseJacketMessage({ type: MSG_DONE, sent: 3, failed: 1 })).toEqual({ type: MSG_DONE, sent: 3, failed: 1 });
    expect(parseJacketMessage({ type: "other" })).toBeNull();
    expect(parseJacketMessage("x")).toBeNull();
  });

  it("저장 묶음은 10장씩 나눈다", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk(Array.from({ length: 23 }, (_, i) => i), 10).map((c) => c.length)).toEqual([10, 10, 3]);
  });
});
