import { describe, expect, it } from "vitest";
import { createTranslator } from "use-intl/core";
import ko from "../../messages/ko.json";
import type { SongDetailResponse } from "@/lib/api-types";
import { addKeyword, canSaveMeta, missingOf, toMetaRestoreBody, toMetaSaveBody, type SongMetaRow } from "@/lib/song-meta";

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
  songId: 1, title: "Peyotl", artist: null, titleCount: 0, topPart: "GUITAR", topDifficulty: "MASTER", topLevel: 9.65, ...over,
});

describe("곡 정보 정리 계산", () => {
  it("비어 있는 것은 아티스트(공백뿐 포함)와 키워드(표기 0개)로 판단한다", () => {
    expect(missingOf(row())).toEqual({ artist: true, keyword: true });
    expect(missingOf(row({ artist: "  ", titleCount: 2 }))).toEqual({ artist: true, keyword: false });
    expect(missingOf(row({ artist: "A", titleCount: 1 }))).toEqual({ artist: false, keyword: false });
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
