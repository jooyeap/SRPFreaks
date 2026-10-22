import { describe, expect, it } from "vitest";
import type { ReadPlay } from "@/lib/import-bookmarklet";
import { chartRequestOf, describePlayChart, isExcludedReason, playFullCombo, playKey, playStage } from "@/lib/record-import";

const base: ReadPlay = { playedAtMs: 1, gameType: "gf", title: "T", difficultyClass: "gf_mst", rate: 9650, ok: 1, miss: 2, translated: false, options: [] };

describe("가져오기 표시 규칙", () => {
  it("달성 단계: MAX는 EXC, OK·MISS가 0이면 FC, 그 외는 달성률로", () => {
    expect(playStage({ ...base, rate: 10000 })).toBe("EXC");
    expect(playStage({ ...base, rate: 9000, ok: 0, miss: 0 })).toBe("FC");
    expect(playStage(base)).toBe("SS");
    expect(playStage({ ...base, rate: 8800 })).toBe("S");
    expect(playStage({ ...base, rate: 7387 })).toBe("A");
    expect(playStage({ ...base, rate: 100 })).toBe("C");
  });

  it("풀콤보 판정은 서버와 같다(OK와 MISS 둘 다 0일 때만)", () => {
    expect(playFullCombo({ ...base, ok: 0, miss: 0 })).toBe(true);
    expect(playFullCombo({ ...base, ok: 1, miss: 0 })).toBe(false);
    expect(playFullCombo({ ...base, ok: 0, miss: 1 })).toBe(false);
  });

  it("난이도 클래스를 파트와 난이도로 바꾼다", () => {
    expect(describePlayChart("gf_mst")).toBe("Guitar | MAS");
    expect(describePlayChart("bass_mst")).toBe("Bass | MAS");
    expect(describePlayChart("gf_ext")).toBe("Guitar | EXT");
    expect(describePlayChart("bass_adv")).toBe("Bass | ADV");
    expect(describePlayChart("gf_bsc")).toBe("Guitar | BSC");
    expect(describePlayChart("dm_ext")).toBeNull();
  });

  it("난이도 클래스를 건의에 붙일 파트·난이도로 바꾼다", () => {
    expect(chartRequestOf("gf_mst")).toEqual({ part: "GUITAR", difficulty: "MASTER" });
    expect(chartRequestOf("bass_bsc")).toEqual({ part: "BASS", difficulty: "BASIC" });
    expect(chartRequestOf("bass_adv")).toEqual({ part: "BASS", difficulty: "ADVANCED" });
    expect(chartRequestOf("gf_ext")).toEqual({ part: "GUITAR", difficulty: "EXTREME" });
    expect(chartRequestOf("dm_ext")).toBeNull();
  });

  it("곡 목록에 없는 사유만 제외로 본다", () => {
    expect(isExcludedReason("SONG_NOT_FOUND")).toBe(true);
    expect(isExcludedReason("AMBIGUOUS_SONG")).toBe(true);
    expect(isExcludedReason("LOWER_THAN_BEST")).toBe(false);
    expect(isExcludedReason(null)).toBe(false);
  });

  it("같은 플레이는 시각+난이도+곡명이 같다", () => {
    expect(playKey(base)).toBe(playKey({ ...base, rate: 1 }));
    expect(playKey(base)).not.toBe(playKey({ ...base, difficultyClass: "bass_mst" }));
  });
});
