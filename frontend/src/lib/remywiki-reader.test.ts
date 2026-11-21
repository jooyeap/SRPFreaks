import { afterEach, describe, expect, it, vi } from "vitest";
import { compactBookmarkletSource } from "@/lib/import-bookmarklet";
import {
  buildRemyBookmarkletHref,
  buildRemyBookmarkletSource,
  MSG_REMY_ACK,
  MSG_REMY_ROWS,
  parseRemyMessage,
  READER_SOURCE,
  REMY_ORIGIN,
  REMY_WINDOW,
  type RemyBookmarkletMessages,
  type RemyRow,
} from "@/lib/remywiki-reader";

const messages: RemyBookmarkletMessages = {
  title: "T", open: "열기", ok: "확인", wrongPage: "RemyWiki 페이지에서 눌러 주세요.", noTable: "표 없음 {invalid}",
  popupBlocked: "팝업", sending: "보내는 중 {count}", done: "완료 {count}", noReply: "응답 없음",
};

interface ReadResult { rows: RemyRow[]; tables: number; invalid: number; truncated: boolean }
const read = new Function(`${READER_SOURCE}; return srpReadRemy;`)() as (doc: Document) => ReadResult;
const parse = (html: string) => read(new DOMParser().parseFromString(html, "text/html"));

/** RemyWiki 곡 표 모양(두 줄 머리글, 구분 줄, 범위 BPM, 줄바꿈으로 나뉜 `from ○○`)을 본뜬 샘플. */
const MAIN_TABLE = `
<table class="wikitable">
  <tr><th rowspan="2">Song</th><th rowspan="2">Artist</th><th rowspan="2">BPM</th><th colspan="4">Drum</th><th colspan="4">Guitar</th><th colspan="4">Bass</th></tr>
  <tr><th>Basic</th><th>Advanced</th><th>Extreme</th><th>Master</th><th>Basic</th><th>Advanced</th><th>Extreme</th><th>Master</th><th>Basic</th><th>Advanced</th><th>Extreme</th><th>Master</th></tr>
  <tr><td colspan="15">Licensed Songs</td></tr>
  <tr><td>Default</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td><a href="/My_HERO">My HERO</a></td><td>04 Limited Sazabys</td><td>217</td><td>1.40</td></tr>
  <tr><td>U.N.オーエンは彼女なのか?</td><td>岸田教団&amp;THE明星ロケッツ</td><td>210</td></tr>
  <tr><td>LIPS NOISE HUNTER</td><td>SOUND HOLIC</td><td>150-200</td></tr>
  <tr><td>Riff Riff Paradise<br>from GUITARFREAKS 6thMIX &amp; drummania 5thMIX</td><td>泉 陸奥彦</td><td>190 – 240</td></tr>
  <tr><td>Twinkle Star<br>from GUITARFREAKS 9thMIX &amp; drummania 8thMIX (Long Version)</td><td>Orange Lounge</td><td>１７０～１８０</td></tr>
  <tr><td>MONOLITH -GITADOROCK ver.- from ノスタルジア FORTE</td><td>TOMOSUKE</td><td>170-205</td></tr>
  <tr><td>The ULTIMATES -Darkness- <img alt="new song" src="n.png"><span> new song</span></td><td>Mutsuhiko Izumi</td><td>160-300<sup class="reference">[1]</sup></td></tr>
  <tr><td>Escape from Tokyo</td><td>Someone</td><td>128</td></tr>
  <tr><td>Broken BPM</td><td>X</td><td>varies</td></tr>
  <tr><td>Reversed</td><td>X</td><td>200-100</td></tr>
  <tr><td>Too Fast</td><td>X</td><td>2001</td></tr>
  <tr><td>Decimal</td><td>X</td><td>172.5</td></tr>
  <tr><td>My HERO</td><td>again</td><td>999</td></tr>
  <tr><td>Dash Only</td><td>X</td><td>-</td></tr>
</table>`;

describe("RemyWiki 표 읽기 (D94)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("두 줄 머리글 표에서 열 이름으로 곡명·아티스트·BPM을 읽고 구분 줄은 건너뛴다", () => {
    const result = parse(MAIN_TABLE);
    expect(result.tables).toBe(1);
    const byTitle = Object.fromEntries(result.rows.map((r) => [r.title, r.bpm]));
    expect(byTitle["My HERO"]).toBe("217"); // 링크 글자, 정수 BPM
    expect(result.rows[0]).toEqual({ title: "My HERO", artist: "04 Limited Sazabys", bpm: "217" });
    expect(byTitle["U.N.オーエンは彼女なのか?"]).toBe("210");
    expect(byTitle["LIPS NOISE HUNTER"]).toBe("150-200"); // 범위
    expect(result.rows.some((r) => r.title === "Licensed Songs" || r.title === "Default")).toBe(false); // 구분 줄
  });

  it("범위 BPM은 줄표·물결표·전각 숫자를 `최소-최대`로 맞춘다", () => {
    const byTitle = Object.fromEntries(parse(MAIN_TABLE).rows.map((r) => [r.title, r.bpm]));
    expect(byTitle["Riff Riff Paradise"]).toBe("190-240");
    expect(byTitle["Twinkle Star (Long Version)"]).toBe("170-180");
  });

  it("곡명: 다음 줄의 `from ○○`와 BEMANI 시리즈 이름이 붙은 `from`을 떼고, 끝 괄호는 남기며, 각주·new song 표시를 지운다", () => {
    const titles = parse(MAIN_TABLE).rows.map((r) => r.title);
    expect(titles).toContain("Riff Riff Paradise");
    expect(titles).toContain("Twinkle Star (Long Version)");
    expect(titles).toContain("MONOLITH -GITADOROCK ver.-");
    expect(titles).toContain("The ULTIMATES -Darkness-");
    expect(parse(MAIN_TABLE).rows.find((r) => r.title === "The ULTIMATES -Darkness-")?.bpm).toBe("160-300"); // 각주 [1]은 BPM이 아니다
    // 알려진 시리즈가 아닌 `from`은 곡명의 일부로 둔다
    expect(titles).toContain("Escape from Tokyo");
  });

  it("BPM이 비었거나 맞지 않으면 그 곡만 건너뛰고(invalid로 센다), 같은 곡명은 먼저 나온 줄만 쓴다", () => {
    const result = parse(MAIN_TABLE);
    const titles = result.rows.map((r) => r.title);
    for (const bad of ["Broken BPM", "Reversed", "Too Fast", "Decimal", "Dash Only"]) expect(titles).not.toContain(bad);
    expect(result.invalid).toBe(5);
    expect(titles.filter((t) => t === "My HERO")).toHaveLength(1);
    expect(result.rows.find((r) => r.title === "My HERO")?.bpm).toBe("217");
  });

  it("곡명·BPM 열이 없는 표(제거된 곡, 난이도 변경)와 표가 없는 페이지는 건너뛴다", () => {
    const html = `
      <table><tr><th>Song Title</th><th>Artist</th><th>Game</th></tr><tr><td>Old</td><td>X</td><td>GF</td></tr></table>
      <table><tr><th>Song</th><th>Drum</th></tr><tr><td>Sakura Sunrise (GITADORA ver.)</td><td>5.00→5.50</td></tr></table>
      <ul><li>Song BPM</li></ul>`;
    expect(parse(html)).toMatchObject({ rows: [], tables: 0, invalid: 0 });
    expect(parse("<p>표 없음</p>").rows).toEqual([]);
  });

  it("앞에 열이 더 있는 표(Drive Flare, rowspan 칸)도 열 이름으로 찾는다", () => {
    const html = `
      <table>
        <tr><th>Drive Flare</th><th>Song Title</th><th>Artist</th><th>BPM</th></tr>
        <tr><td rowspan="2">Flare 1</td><td>Alpha</td><td>A</td><td>150</td></tr>
        <tr><td>Beta</td><td>B</td><td>120-130</td></tr>
        <tr><td>Flare 2</td><td>Gamma</td><td>C</td><td>99</td></tr>
      </table>`;
    expect(parse(html).rows).toEqual([
      { title: "Alpha", artist: "A", bpm: "150" },
      { title: "Beta", artist: "B", bpm: "120-130" },
      { title: "Gamma", artist: "C", bpm: "99" },
    ]);
  });

  it("Artist 열이 없어도 읽고(아티스트는 빈 글자), 표가 여러 개면 모두 읽는다", () => {
    const html = `
      <table><tr><th>Song</th><th>BPM</th></tr><tr><td>One</td><td>100</td></tr></table>
      <table><tr><td>Song</td><td>Artist</td><td>BPM</td></tr><tr><td>Two</td><td>Z</td><td>200</td></tr></table>`;
    const result = parse(html);
    expect(result.tables).toBe(2);
    expect(result.rows).toEqual([
      { title: "One", artist: "", bpm: "100" },
      { title: "Two", artist: "Z", bpm: "200" },
    ]);
  });

  it("아티스트 칸: 줄바꿈은 공백으로 잇고, `from ○○` 원작 줄과 각주는 빼며, 빈 칸은 빈 글자다", () => {
    const html = `<table>
      <tr><th>Song</th><th>Artist</th><th>BPM</th></tr>
      <tr><td>A</td><td>Band One<br>feat. Singer<br>from GITADORA</td><td>120</td></tr>
      <tr><td>B</td><td><div>Name X</div><div>from jubeat</div>[1]</td><td>130</td></tr>
      <tr><td>C</td><td></td><td>140</td></tr>
      <tr><td>D</td><td>from the edge</td><td>150</td></tr>
      <tr><td>E</td><td>Ｚｅｄｄ</td><td>160</td></tr>
    </table>`;
    expect(parse(html).rows).toEqual([
      { title: "A", artist: "Band One feat. Singer", bpm: "120" },
      { title: "B", artist: "Name X", bpm: "130" },
      { title: "C", artist: "", bpm: "140" },
      { title: "D", artist: "from the edge", bpm: "150" }, // 시리즈 이름이 아닌 `from`은 아티스트 글자다
      { title: "E", artist: "Zedd", bpm: "160" },
    ]);
  });

  it("4,000곡을 넘으면 넘는 줄은 버리고 truncated로 알린다", () => {
    const body = Array.from({ length: 4005 }, (_, i) => `<tr><td>Song ${i}</td><td>A</td><td>${100 + (i % 100)}</td></tr>`).join("");
    const result = parse(`<table><tr><th>Song</th><th>Artist</th><th>BPM</th></tr>${body}</table>`);
    expect(result.rows).toHaveLength(4000);
    expect(result.truncated).toBe(true);
  });
});

describe("RemyWiki 북마클릿 (D94)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("줄인 소스도 문법이 맞고, 북마크 주소는 javascript:로 시작하며 사이트 주소가 들어 있다", () => {
    const source = compactBookmarkletSource(buildRemyBookmarkletSource("https://srpfreaks.com/", messages));
    expect(() => new Function(source)).not.toThrow();
    expect(source).not.toContain("\n");
    expect(source).toContain('"https://srpfreaks.com"');
    expect(buildRemyBookmarkletHref("https://srpfreaks.com", messages).startsWith("javascript:")).toBe(true);
  });

  it("RemyWiki가 아닌 페이지에서는 안내만 띄우고 창을 열지 않는다", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    new Function(buildRemyBookmarkletSource("https://srpfreaks.com", messages))(); // jsdom 주소는 localhost
    expect(open).not.toHaveBeenCalled();
    expect(document.getElementById("srp-import-modal")?.textContent).toContain("RemyWiki 페이지에서 눌러 주세요.");
  });

  it("RemyWiki 페이지에서는 이름 고정 창에 곡 목록을 보내고, 답을 받으면 멈춘다", () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = MAIN_TABLE;
      const posted: { message: Record<string, unknown>; target: string }[] = [];
      const fake = {
        location: { href: "about:blank" },
        postMessage: (message: Record<string, unknown>, target: string) => posted.push({ message, target }),
      } as unknown as Window;
      const open = vi.spyOn(window, "open").mockReturnValue(fake);
      // 북마클릿은 location.hostname을 보므로, jsdom 위치를 RemyWiki로 바꿔 둔다
      const source = buildRemyBookmarkletSource("https://srpfreaks.com", messages).replace(/location\.hostname!==/, "false&&location.hostname!==");
      new Function(source)();
      expect(open).toHaveBeenCalledWith("", REMY_WINDOW);
      expect(fake.location.href).toBe("https://srpfreaks.com/admin/song-import?remy=1"); // 새 창만 이동한다
      expect(posted.length).toBe(1);
      expect(posted[0].target).toBe("https://srpfreaks.com"); // 우리 사이트 출처로만 보낸다
      expect(posted[0].message.type).toBe(MSG_REMY_ROWS);
      const id = posted[0].message.id as string;
      vi.advanceTimersByTime(2100);
      expect(posted.length).toBe(3); // 답이 없으면 1초마다 다시 보낸다
      // 우리 사이트의 답(ack)을 받으면 더 보내지 않는다
      window.dispatchEvent(new MessageEvent("message", { data: { type: MSG_REMY_ACK, id }, origin: "https://srpfreaks.com", source: fake }));
      vi.advanceTimersByTime(5000);
      expect(posted.length).toBe(3);
      expect(document.getElementById("srp-import-modal")?.textContent).toContain("완료");
    } finally {
      vi.useRealTimers();
    }
  });

  it("이미 열려 있는 창(교차 출처)은 location을 읽을 수 없어도 오류 없이 이동시키지 않고 보낸다", () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = MAIN_TABLE;
      const posted: unknown[] = [];
      const fake = {
        get location(): Location {
          throw new Error("SecurityError"); // 다른 출처의 창은 location을 읽을 수 없다
        },
        postMessage: (message: unknown) => posted.push(message),
      } as unknown as Window;
      vi.spyOn(window, "open").mockReturnValue(fake);
      const source = buildRemyBookmarkletSource("https://srpfreaks.com", messages).replace(/location\.hostname!==/, "false&&location.hostname!==");
      expect(() => new Function(source)()).not.toThrow();
      expect(posted.length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("RemyWiki 메시지 검사 (D94)", () => {
  it("모양이 틀리면 null이고, 줄 하나가 틀리면 그 줄만 버린다", () => {
    expect(parseRemyMessage(null)).toBeNull();
    expect(parseRemyMessage({ type: "other", id: "a", rows: [] })).toBeNull();
    expect(parseRemyMessage({ type: MSG_REMY_ROWS, rows: [] })).toBeNull(); // id 없음
    expect(parseRemyMessage({ type: MSG_REMY_ROWS, id: "a", rows: "x" })).toBeNull();
    expect(parseRemyMessage({ type: MSG_REMY_ROWS, id: "a", rows: Array(4001).fill({ title: "A", bpm: "100" }) })).toBeNull();
    const parsed = parseRemyMessage({
      type: MSG_REMY_ROWS,
      id: "a",
      source: "AC_GD_EXCHAIN",
      invalid: 2,
      rows: [
        { title: "Ok", artist: "Z", bpm: "172" },
        { title: "Range", artist: "", bpm: "１２０〜１８０" },
        { title: "Same", artist: "", bpm: "150-150" },
        { title: "", bpm: "100" }, // 곡명 없음
        { title: "x".repeat(301), bpm: "100" }, // 곡명 길이 초과
        { title: "Bad", bpm: "2001" },
        { title: "Reversed", bpm: "200-100" },
        { title: "Float", bpm: "172.5" },
        { title: "NoBpm" },
        { title: "LongArtist", artist: "y".repeat(256), bpm: "90" },
        { title: "Multi", artist: "Line\nTwo \r\n  Three", bpm: "91" },
        { title: "Wide", artist: "Ｗｉｄｅ", bpm: "92" },
        { title: "Blank", artist: "   ", bpm: "93" },
        null,
      ],
    });
    expect(parsed).toEqual({
      type: MSG_REMY_ROWS,
      id: "a",
      source: "AC_GD_EXCHAIN",
      invalid: 2 + 4, // 북마클릿이 센 2건 + 여기서 거른 BPM 4건 (곡명 문제는 세지 않는다)
      rows: [
        { title: "Ok", artist: "Z", bpm: "172" },
        { title: "Range", artist: "", bpm: "120-180" },
        { title: "Same", artist: "", bpm: "150" },
        { title: "LongArtist", artist: "", bpm: "90" }, // 255자 초과는 값 없음
        { title: "Multi", artist: "Line Two Three", bpm: "91" },
        { title: "Wide", artist: "Wide", bpm: "92" },
        { title: "Blank", artist: "", bpm: "93" },
      ],
    });
  });

  it("출처 상수는 RemyWiki 한 곳이다", () => {
    expect(REMY_ORIGIN).toBe("https://remywiki.com");
  });
});
