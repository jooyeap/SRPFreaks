import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, EMPTY_FILTERS } from "@/lib/difficulty-table";
import {
  clearFilterCarried,
  FILTER_NOTICE_IDLE_MS,
  FILTER_NOTICE_MAX_MS,
  folderCarryFromParams,
  folderCarryToQuery,
  isFilterNoticeShown,
  markFilterCarried,
  markFilterNoticeShown,
  peekFilterCarried,
  resetFilterNoticeShown,
  withCarryQuery,
} from "@/lib/folder-filter-carry";

const state = (over: Partial<Parameters<typeof folderCarryToQuery>[0]> = {}) => ({ filters: EMPTY_FILTERS, sort: "level" as const, includeZero: false, ...over });

describe("folderCarryToQuery / folderCarryFromParams (D99)", () => {
  it("도착 폴더가 어차피 같은 상태로 시작하면 쿼리가 없다 (주소는 예전과 같다)", () => {
    expect(folderCarryToQuery(state(), EMPTY_FILTERS)).toBe("");
    expect(folderCarryToQuery(state({ filters: DEFAULT_FILTERS }), DEFAULT_FILTERS)).toBe("");
  });

  it("속성 필터를 걸면 rec(없으면 all)와 pat를 싣는다", () => {
    const q = folderCarryToQuery(state({ filters: { part: null, recommend: [], pattern: ["복합", "이중"] } }), EMPTY_FILTERS);
    expect(new URLSearchParams(q).get("rec")).toBe("all");
    expect(new URLSearchParams(q).get("pat")).toBe("복합,이중");
  });

  it("시작 필터(상·중)를 풀었으면 rec=all로 싣는다 (풀린 상태도 이어진다)", () => {
    expect(folderCarryToQuery(state(), DEFAULT_FILTERS)).toBe("rec=all");
  });

  it("정렬·평균 계산(0% 포함)도 기본이 아니면 싣는다", () => {
    const q = new URLSearchParams(folderCarryToQuery(state({ sort: "rateDesc", includeZero: true }), EMPTY_FILTERS));
    expect(q.get("sort")).toBe("rateDesc");
    expect(q.get("zero")).toBe("1");
  });

  it("실었다가 읽으면 같은 상태가 된다 (왕복)", () => {
    const original = state({ filters: { part: null, recommend: ["상", "중"], pattern: ["단일"] }, sort: "title", includeZero: true });
    const back = folderCarryFromParams(new URLSearchParams(folderCarryToQuery(original, EMPTY_FILTERS)));
    expect(back).toEqual(original);
  });

  it("싣고 온 값이 하나도 없으면 null (서열표에서 들어왔거나 다른 길)", () => {
    expect(folderCarryFromParams(new URLSearchParams(""))).toBeNull();
    expect(folderCarryFromParams(new URLSearchParams("pattern=복합"))).toBeNull(); // 속성별 화면의 칸은 carry가 아니다
  });

  it("알 수 없는 값은 버린다 (주소는 사용자가 고칠 수 있다)", () => {
    const c = folderCarryFromParams(new URLSearchParams("rec=최상&pat=없음,복합&sort=hack&zero=2"));
    expect(c).toEqual({ filters: { part: null, recommend: [], pattern: ["복합"] }, sort: "level", includeZero: false });
  });

  it("withCarryQuery: 빈 쿼리면 주소 그대로", () => {
    expect(withCarryQuery("/table/folder/5.9", "")).toBe("/table/folder/5.9");
    expect(withCarryQuery("/table/folder/5.9", "rec=all")).toBe("/table/folder/5.9?rec=all");
  });
});

describe("이동 표시(한 번짜리)와 안내 시간", () => {
  afterEach(() => clearFilterCarried());
  it("mark 하면 peek는 true, 읽어도 지워지지 않고 clear로만 지워진다", () => {
    expect(peekFilterCarried()).toBe(false);
    markFilterCarried();
    expect(peekFilterCarried()).toBe(true);
    expect(peekFilterCarried()).toBe(true);
    clearFilterCarried();
    expect(peekFilterCarried()).toBe(false);
  });
  it("입력이 없으면 5초, 최대 15초", () => {
    expect(FILTER_NOTICE_IDLE_MS).toBe(5000);
    expect(FILTER_NOTICE_MAX_MS).toBeGreaterThan(FILTER_NOTICE_IDLE_MS);
  });
});

describe("안내를 이미 보여 줬다는 기억 (D99)", () => {
  afterEach(() => resetFilterNoticeShown());

  it("처음에는 보여 주지 않은 상태이고, 표시하면 유지되며, 지우면 되돌아간다", () => {
    expect(isFilterNoticeShown()).toBe(false);
    markFilterNoticeShown();
    expect(isFilterNoticeShown()).toBe(true);
    resetFilterNoticeShown();
    expect(isFilterNoticeShown()).toBe(false);
  });
});
