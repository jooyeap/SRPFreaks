import { afterEach, describe, expect, it } from "vitest";
import { consumeFragment, parseFragment, resetHandoffCache } from "@/lib/import-handoff";
import { FRAGMENT_PREFIX, MAX_SONGS, type ReadSong } from "@/lib/official-song-reader";
import { mergeSongs, parseSongFragment } from "@/lib/song-import";

const song = (title: string, artist = "A"): ReadSong => ({ title, artist, charts: [{ part: "G", levels: ["1", "2", "3", "4"] }] });
const hash = (value: unknown) => `${FRAGMENT_PREFIX}${encodeURIComponent(JSON.stringify(value))}`;

describe("받은 값 해석", () => {
  it("모양이 맞는 조각은 곡 목록으로 해석한다", () => {
    expect(parseSongFragment(hash({ songs: [song("S1")] }))).toEqual([song("S1")]);
  });

  it("접두사가 다르거나 JSON이 아니거나 모양이 틀리면 null", () => {
    expect(parseSongFragment("#srp=abc")).toBeNull();
    expect(parseSongFragment(`${FRAGMENT_PREFIX}not-json`)).toBeNull();
    expect(parseSongFragment(hash({ songs: [{ title: "", artist: "", charts: [] }] }))).toBeNull();
    expect(parseSongFragment(hash({ plays: [] }))).toBeNull();
  });

  it(`곡이 ${MAX_SONGS}개를 넘는 조각은 받지 않는다`, () => {
    expect(parseSongFragment(hash({ songs: Array.from({ length: MAX_SONGS + 1 }, (_, i) => song(`S${i}`)) }))).toBeNull();
  });
});

describe("받은 곡 합치기", () => {
  it("같은 곡 줄은 한 번만 두고 새 곡은 뒤에 붙인다", () => {
    const merged = mergeSongs([song("S1"), song("S2")], [song("S2"), song("S3")]);
    expect(merged.map((s) => s.title)).toEqual(["S1", "S2", "S3"]);
  });

  it("아티스트나 채보가 다르면 다른 줄로 둔다", () => {
    expect(mergeSongs([song("S1", "A")], [song("S1", "B")])).toHaveLength(2);
  });

  it(`최대 ${MAX_SONGS}곡까지만 둔다`, () => {
    const many = Array.from({ length: MAX_SONGS }, (_, i) => song(`S${i}`));
    expect(mergeSongs(many, [song("extra")])).toHaveLength(MAX_SONGS);
  });
});

describe("최근 플레이 가져오기와 조각 이름이 겹치지 않는다", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
    resetHandoffCache();
  });

  it("전역 핸드오프는 #srpsong= 조각을 지우거나 해석하지 않는다", () => {
    window.history.replaceState(null, "", `/admin/song-import${hash({ songs: [song("S1")] })}`);
    expect(consumeFragment()).toBe(false);
    expect(window.location.hash.startsWith(FRAGMENT_PREFIX)).toBe(true); // 이 화면이 받을 때까지 남아 있어야 한다
    expect(parseFragment(window.location.hash)).toBeNull();
  });
});
