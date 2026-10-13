import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  EMPTY_SONG_FILTERS,
  filtersFromParams,
  filtersToQuery,
  folderTitle,
  isFiltering,
  songListDetailHref,
} from "@/lib/song-list";

describe("song-list 조건 <-> 주소 쿼리", () => {
  it("빈 주소는 조건 없음(폴더 목록)이다", () => {
    const filters = filtersFromParams(new URLSearchParams(""));
    expect(filters).toEqual(EMPTY_SONG_FILTERS);
    expect(isFiltering(filters)).toBe(false);
    expect(filtersToQuery(filters)).toBe("");
  });

  it("짧은 코드를 읽고 다시 같은 문자열로 만든다", () => {
    const filters = filtersFromParams(new URLSearchParams("q=abc&part=G&diff=EXT,MAS&ver=V5"));
    expect(filters).toEqual({ q: "abc", part: "GUITAR", difficulties: ["EXTREME", "MASTER"], version: "V5" });
    expect(filtersToQuery(filters)).toBe("q=abc&part=G&diff=EXT%2CMAS&ver=V5");
  });

  it("알 수 없는 값은 버리고 난이도는 순서를 고정한다", () => {
    const filters = filtersFromParams(new URLSearchParams("part=X&diff=MAS,ZZZ,BAS,MAS"));
    expect(filters.part).toBeNull();
    expect(filters.difficulties).toEqual(["BASIC", "MASTER"]);
  });

  it("너무 긴 검색어는 100자로 자른다", () => {
    expect(filtersFromParams(new URLSearchParams(`q=${"a".repeat(150)}`)).q).toHaveLength(100);
  });

  it("공백만 있는 검색어는 조건으로 치지 않는다", () => {
    expect(isFiltering({ ...EMPTY_SONG_FILTERS, q: "   " })).toBe(false);
    expect(filtersToQuery({ ...EMPTY_SONG_FILTERS, q: "   " })).toBe("");
  });

  it("필터 개수는 파트 + 난이도 수 + 버전이고 검색어는 세지 않는다", () => {
    expect(
      activeFilterCount({ q: "x", part: "BASS", difficulties: ["BASIC", "MASTER"], version: "V5" }),
    ).toBe(4);
    expect(activeFilterCount({ ...EMPTY_SONG_FILTERS, q: "x" })).toBe(0);
  });
});

describe("song-list 표기", () => {
  it("폴더 제목과 상세 주소", () => {
    expect(folderTitle({ lo: 9.5, hi: 9.99 })).toBe("9.50 ~ 9.99");
    expect(songListDetailHref({ songId: 4, songDifficultyId: 12 })).toBe("/songs/4?from=songs&chart=12");
  });
});
