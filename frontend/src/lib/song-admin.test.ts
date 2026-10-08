import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chartEditSchema,
  emptyChart,
  emptySongCreate,
  MAX_CHARTS,
  newProgress,
  registerSong,
  songCreateSchema,
  songToEditValues,
  toChartBody,
  toSongBody,
  toSongUpdateBody,
  type SongCreateValues,
} from "@/lib/song-admin";

function values(over: Partial<SongCreateValues> = {}): SongCreateValues {
  return { ...emptySongCreate(), title: "새 곡", charts: [{ ...emptyChart(), level: "9.50" }], ...over };
}

describe("songCreateSchema", () => {
  it("곡명과 레벨이 있으면 통과한다 (아티스트·버전은 비워도 된다)", () => {
    expect(songCreateSchema.safeParse(values()).success).toBe(true);
  });

  it("곡명이 비면 거절한다", () => {
    const result = songCreateSchema.safeParse(values({ title: "   " }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("곡명을 입력해 주세요.");
  });

  it.each(["", "10.00", "9.999", "-1", "abc", "9,5"])("레벨 %j 는 거절한다", (level) => {
    expect(songCreateSchema.safeParse(values({ charts: [{ ...emptyChart(), level }] })).success).toBe(false);
  });

  it.each(["0", "0.00", "9.5", "9.99", "1.05"])("레벨 %j 는 통과한다 (0.00 ~ 9.99, 소수 둘째 자리까지)", (level) => {
    expect(songCreateSchema.safeParse(values({ charts: [{ ...emptyChart(), level }] })).success).toBe(true);
  });

  it("채보가 하나도 없으면 거절한다", () => {
    expect(songCreateSchema.safeParse(values({ charts: [] })).success).toBe(false);
  });

  it("같은 파트·난이도 채보가 둘이면 두 번째 줄에 오류를 낸다", () => {
    const charts = [
      { ...emptyChart(), level: "9.5" },
      { ...emptyChart(), level: "9.6" },
    ];
    const result = songCreateSchema.safeParse(values({ charts }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["charts", 1, "difficulty"]);
  });

  it("파트나 난이도가 다르면 같은 곡에 여러 채보를 둘 수 있고 최대 8개다", () => {
    const parts = ["GUITAR", "BASS"] as const;
    const diffs = ["BASIC", "ADVANCED", "EXTREME", "MASTER"] as const;
    const charts = parts.flatMap((part) => diffs.map((difficulty) => ({ ...emptyChart(), part, difficulty, level: "5.00" })));
    expect(charts).toHaveLength(MAX_CHARTS);
    expect(songCreateSchema.safeParse(values({ charts })).success).toBe(true);
    expect(songCreateSchema.safeParse(values({ charts: [...charts, { ...emptyChart(), level: "1" }] })).success).toBe(false);
  });

  it("서열표 값은 기준 난이도 형식을 같이 검사한다", () => {
    expect(songCreateSchema.safeParse(values({ charts: [{ ...emptyChart(), level: "9", tier: "5.85" }] })).success).toBe(false);
    expect(songCreateSchema.safeParse(values({ charts: [{ ...emptyChart(), level: "9", tier: "5.8" }] })).success).toBe(true);
  });
});

describe("요청 본문", () => {
  it("곡 본문: 빈 아티스트·버전은 null, 곡명은 앞뒤 공백을 지우고 출처를 남긴다", () => {
    expect(toSongBody(values({ title: "  새 곡 ", artist: " ", addedVersion: "V5" }))).toEqual({
      title: "새 곡",
      artist: null,
      addedVersion: "V5",
      source: "admin-manual",
    });
  });

  it("채보 본문: 레벨은 숫자로, 노트 수는 보내지 않는다(null)", () => {
    expect(toChartBody({ ...emptyChart(), part: "BASS", difficulty: "EXTREME", level: "7.40" })).toEqual({
      instrumentPart: "BASS",
      difficultyType: "EXTREME",
      level: 7.4,
      noteCount: null,
    });
  });
});

describe("registerSong", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const calls = () => fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? "GET"} ${String(input).replace(/^.*\/api\/v1/, "")}`);

  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const twoCharts = (): SongCreateValues =>
    values({
      charts: [
        { ...emptyChart(), level: "9.5", tier: "5.8", recommend: "상", pattern: "단일" },
        { ...emptyChart(), part: "BASS", level: "8.5" },
      ],
    });

  it("곡 → 채보를 차례로 만들고 곡 id를 돌려준다 (tableId가 없으면 서열표는 건드리지 않는다)", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: 77 }, 201))
      .mockResolvedValueOnce(json({ id: 101 }, 201))
      .mockResolvedValueOnce(json({ id: 102 }, 201));

    const songId = await registerSong(twoCharts(), null, newProgress());

    expect(songId).toBe(77);
    expect(calls()).toEqual(["POST /songs", "POST /songs/77/difficulties", "POST /songs/77/difficulties"]);
  });

  it("tableId가 있으면 만든 채보마다 서열표 값을 저장한다 (기준 난이도가 비면 null = 미정)", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: 77 }, 201))
      .mockResolvedValueOnce(json({ id: 101 }, 201))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({ id: 102 }, 201))
      .mockResolvedValueOnce(json({}));

    await registerSong(twoCharts(), 3, newProgress());

    expect(calls()).toEqual([
      "POST /songs",
      "POST /songs/77/difficulties",
      "PUT /admin/difficulty-tables/3/entries/101",
      "POST /songs/77/difficulties",
      "PUT /admin/difficulty-tables/3/entries/102",
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({ tierLabel: 5.8, recommend: "상", pattern: "단일" });
    expect(JSON.parse(String(fetchMock.mock.calls[4][1]?.body))).toEqual({ tierLabel: null, recommend: null, pattern: null });
  });

  it("중간에 실패해도 다시 부르면 이미 만든 곡·채보는 건너뛰고 남은 것만 보낸다 (곡이 두 번 만들어지지 않는다)", async () => {
    const progress = newProgress();
    fetchMock
      .mockResolvedValueOnce(json({ id: 77 }, 201))
      .mockResolvedValueOnce(json({ id: 101 }, 201))
      .mockResolvedValueOnce(json({ code: "X", message: "실패", timestamp: "t" }, 500));

    await expect(registerSong(twoCharts(), null, progress)).rejects.toBeDefined();
    expect(progress.songId).toBe(77);
    expect(progress.chartIds.get(0)).toBe(101);

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(json({ id: 102 }, 201));
    await expect(registerSong(twoCharts(), null, progress)).resolves.toBe(77);
    expect(calls()).toEqual(["POST /songs/77/difficulties"]); // 곡과 첫 채보는 다시 만들지 않는다
  });
});

describe("수정 본문", () => {
  const song = {
    id: 7,
    title: "곡",
    artist: null,
    addedVersion: null,
    titleFolder: "ㄱ",
    bpmMin: 100,
    bpmMax: null,
    source: null,
    titles: [],
    difficulties: [],
  };

  it("songToEditValues: null은 빈 문자열이 된다", () => {
    expect(songToEditValues(song)).toEqual({ title: "곡", artist: "", addedVersion: "" });
  });

  it("toSongUpdateBody: 빈 칸은 null, 화면에 없는 값은 지금 값 그대로, titles는 생략한다", () => {
    const body = toSongUpdateBody(song, { title: " 새 ", artist: " ", addedVersion: "V3" });
    expect(body).toEqual({ title: "새", artist: null, addedVersion: "V3", titleFolder: "ㄱ", bpmMin: 100, bpmMax: null });
    expect("titles" in body).toBe(false);
  });

  it("chartEditSchema: 레벨 형식", () => {
    expect(chartEditSchema.safeParse({ level: "9.5" }).success).toBe(true);
    expect(chartEditSchema.safeParse({ level: "" }).success).toBe(false);
    expect(chartEditSchema.safeParse({ level: "10.00" }).success).toBe(false);
    expect(chartEditSchema.safeParse({ level: "9.555" }).success).toBe(false);
  });
});
