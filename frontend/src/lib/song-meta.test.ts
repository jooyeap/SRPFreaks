import { describe, expect, it } from "vitest";
import { createTranslator } from "use-intl/core";
import ko from "../../messages/ko.json";
import type { SongDetailResponse } from "@/lib/api-types";
import { addKeyword, canSaveMeta, missingOf, readBpmDraft, toMetaRestoreBody, toMetaSaveBody, type SongMetaRow } from "@/lib/song-meta";

const t = createTranslator({ locale: "ko", messages: ko }) as unknown as Parameters<typeof addKeyword>[3];

const detail = (over: Partial<SongDetailResponse> = {}): SongDetailResponse => ({
  id: 1,
  title: "Peyotl",
  artist: null,
  addedVersion: "V8",
  titleFolder: "P",
  bpmMin: 120,
  bpmMax: 180,
  source: "sheet",
  titles: [],
  difficulties: [],
  ...over,
});

const row = (over: Partial<SongMetaRow> = {}): SongMetaRow => ({
  songId: 1, title: "Peyotl", artist: null, bpmMin: 150, bpmMax: 150, titleCount: 0, topPart: "GUITAR", topDifficulty: "MASTER", topLevel: 9.65, ...over,
});

describe("곡 정보 정리 계산", () => {
  it("비어 있는 것은 아티스트(공백뿐 포함)와 키워드(표기 0개)로 판단한다", () => {
    expect(missingOf(row())).toEqual({ artist: true, keyword: true, bpm: false });
    expect(missingOf(row({ artist: "  ", titleCount: 2 }))).toEqual({ artist: true, keyword: false, bpm: false });
    expect(missingOf(row({ artist: "A", titleCount: 1 }))).toEqual({ artist: false, keyword: false, bpm: false });
  });

  it("저장은 비어 있는 칸 중 하나라도 채웠을 때만 가능하다", () => {
    expect(canSaveMeta(row(), "", [])).toBe(false);
    expect(canSaveMeta(row(), "  ", [])).toBe(false);
    expect(canSaveMeta(row(), "Yusuke", [])).toBe(true);
    expect(canSaveMeta(row(), "", [{ kind: "ALIAS", title: "a" }])).toBe(true);
    // 아티스트가 이미 있으면 아티스트 입력은 의미가 없다
    expect(canSaveMeta(row({ artist: "A" }), "B", [])).toBe(false);
    // 키워드가 이미 있으면 키워드 추가는 의미가 없다
    expect(canSaveMeta(row({ titleCount: 1 }), "", [{ kind: "ALIAS", title: "a" }])).toBe(false);
  });

  it("BPM이 비어 있다는 것은 최소·최대가 모두 없을 때다(D105)", () => {
    expect(missingOf(row({ bpmMin: null, bpmMax: null })).bpm).toBe(true);
    expect(missingOf(row({ bpmMin: 150, bpmMax: null })).bpm).toBe(false);
    expect(missingOf(row({ bpmMin: 120, bpmMax: 180 })).bpm).toBe(false);
  });

  it("BPM만 채워도 저장할 수 있지만, 이미 BPM이 있는 줄의 BPM 입력은 의미가 없다", () => {
    const noBpm = row({ artist: "A", titleCount: 1, bpmMin: null, bpmMax: null });
    expect(canSaveMeta(noBpm, "", [], "", "")).toBe(false);
    expect(canSaveMeta(noBpm, "", [], "150", "")).toBe(true);
    expect(canSaveMeta(noBpm, "", [], "", "180")).toBe(true); // 최대만 써도 눌러 볼 수 있고, 저장할 때 안내한다
    expect(canSaveMeta(row({ artist: "A", titleCount: 1 }), "", [], "150", "")).toBe(false);
  });

  it("BPM 입력 검사: 비어 있음·고정·범위·경계값·오류", () => {
    expect(readBpmDraft("", "", t)).toEqual({ ok: true, bpm: null });
    expect(readBpmDraft(" 150 ", "", t)).toEqual({ ok: true, bpm: { min: 150, max: 150 } }); // 최소만 = 고정 BPM
    expect(readBpmDraft("120", "180", t)).toEqual({ ok: true, bpm: { min: 120, max: 180 } });
    expect(readBpmDraft("150", "150", t)).toEqual({ ok: true, bpm: { min: 150, max: 150 } });
    expect(readBpmDraft("1", "2000", t)).toEqual({ ok: true, bpm: { min: 1, max: 2000 } });
    expect(readBpmDraft("", "180", t)).toEqual({ ok: false, field: "bpmMin", message: "최소 BPM을 입력해 주세요." });
    expect(readBpmDraft("0", "", t)).toEqual({ ok: false, field: "bpmMin", message: "BPM은 1 이상 2000 이하여야 합니다." });
    expect(readBpmDraft("100", "2001", t)).toEqual({ ok: false, field: "bpmMax", message: "BPM은 1 이상 2000 이하여야 합니다." });
    expect(readBpmDraft("181", "180", t)).toEqual({ ok: false, field: "bpmMax", message: "최소 BPM은 최대 BPM보다 클 수 없습니다." });
    for (const bad of ["abc", "1.5", "-5", "1e3", "１５０a"]) {
      expect(readBpmDraft(bad, "", t)).toEqual({ ok: false, field: "bpmMin", message: "BPM은 숫자(정수)로 입력해 주세요." });
    }
    expect(readBpmDraft("100", "x", t)).toEqual({ ok: false, field: "bpmMax", message: "BPM은 숫자(정수)로 입력해 주세요." });
  });

  it("저장 본문: BPM이 비어 있던 곡만 입력값으로 채우고, 이미 있으면 그대로 둔다", () => {
    const empty = detail({ artist: "A", bpmMin: null, bpmMax: null });
    expect(toMetaSaveBody(empty, "", [], { min: 150, max: 150 })).toMatchObject({ bpmMin: 150, bpmMax: 150 });
    expect(toMetaSaveBody(empty, "", [])).toMatchObject({ bpmMin: null, bpmMax: null });
    // 그 사이 다른 관리자가 120~180을 넣었다면 덮어쓰지 않는다
    expect(toMetaSaveBody(detail({ artist: "A" }), "", [], { min: 150, max: 150 })).toMatchObject({ bpmMin: 120, bpmMax: 180 });
  });

  it("키워드 추가: 빈 값·중복(같은 종류, 공백·대소문자 무시)·20개 초과는 거부한다", () => {
    const first = addKeyword([], "ROMAJI", "  Peyo tl ", t);
    expect(first).toEqual({ ok: true, keywords: [{ kind: "ROMAJI", title: "Peyo tl" }] });
    if (!first.ok) throw new Error();
    expect(addKeyword(first.keywords, "ROMAJI", "PEYOTL", t).ok).toBe(false);
    expect(addKeyword(first.keywords, "ALIAS", "PEYOTL", t).ok).toBe(true); // 다른 종류는 같은 글자도 허용(서버와 같다)
    expect(addKeyword([], "ALIAS", "   ", t).ok).toBe(false);
    const full = Array.from({ length: 20 }, (_, i) => ({ kind: "ALIAS" as const, title: `k${i}` }));
    expect(addKeyword(full, "ALIAS", "more", t).ok).toBe(false);
  });

  it("저장 본문: 비어 있던 아티스트만 채우고 나머지 값(버전·폴더·BPM)은 그대로 보낸다", () => {
    const body = toMetaSaveBody(detail(), " Yusuke Kitaura ", []);
    expect(body).toEqual({ title: "Peyotl", artist: "Yusuke Kitaura", addedVersion: "V8", titleFolder: "P", bpmMin: 120, bpmMax: 180 });
    expect("titles" in body).toBe(false); // 키워드를 안 넣으면 titles를 보내지 않는다(서버가 기존 표기를 그대로 둔다)
  });

  it("저장 본문: 이미 있는 아티스트는 덮어쓰지 않고, 키워드는 기존 표기 뒤에 더한다", () => {
    const body = toMetaSaveBody(detail({ artist: "Old", titles: [{ kind: "ROMAJI", title: "PEYOTL" }] }), "New", [
      { kind: "KO", title: "페이요틀" },
      { kind: "ROMAJI", title: "peyotl" }, // 기존과 같은 표기는 한 번만
    ]);
    expect(body.artist).toBe("Old");
    expect(body.titles).toEqual([{ kind: "ROMAJI", title: "PEYOTL" }, { kind: "KO", title: "페이요틀" }]);
  });

  it("되돌리기 본문: 저장 직전 값 그대로, 표기를 바꿨을 때만 titles를 보낸다", () => {
    const before = detail({ artist: null, titles: [] });
    expect(toMetaRestoreBody(before, false)).toEqual({ title: "Peyotl", artist: null, addedVersion: "V8", titleFolder: "P", bpmMin: 120, bpmMax: 180 });
    expect(toMetaRestoreBody(before, true).titles).toEqual([]); // 빈 목록 = 새로 넣은 표기를 모두 지운다
  });
});
