import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsAdminView } from "@/components/admin/SettingsAdminView";
import type { PageResponse, SettingResponse } from "@/lib/api-types";
import { koT } from "@/i18n/ko-translator";
import { settingGroup, validateSettingValue } from "@/lib/admin";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function setting(key: string, value: string, over: Partial<SettingResponse> = {}): SettingResponse {
  return { key, value, updatedByNickname: null, updatedAt: "2026-10-08T00:00:00Z", ...over };
}

function page(content: SettingResponse[]): PageResponse<SettingResponse> {
  return { content, page: 0, size: 100, totalElements: content.length, totalPages: 1 };
}

const rows = [
  setting("rating.list_single", "15"),
  setting("ui.show_song_images", "false", { updatedByNickname: "ルート" }),
  setting("contact.takedown_email", "a@example.com"),
];

describe("설정 화면", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderView = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <SettingsAdminView viewerId={1} />
      </QueryClientProvider>,
    );

  it("설정 이름·키·값·마지막 변경을 보여 주고, 바꾸기 전에는 저장 버튼이 꺼져 있다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(rows)));
    renderView();
    expect(await screen.findByLabelText("단일 목록 개수")).toHaveValue("15");
    expect(screen.getByText("rating.list_single")).toBeInTheDocument();
    expect(screen.getByLabelText("재킷 이미지 표시")).toHaveValue("false");
    expect(screen.getByText(/ルート/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "단일 목록 개수 저장" })).toBeDisabled();
  });

  it("값을 바꿔 저장하면 PATCH /admin/settings/{키}로 보낸다", async () => {
    fetchMock
      .mockResolvedValueOnce(json(page(rows)))
      .mockResolvedValueOnce(json(setting("rating.list_single", "20", { updatedByNickname: "ルート" })))
      .mockResolvedValue(json(page(rows)));
    renderView();
    fireEvent.change(await screen.findByLabelText("단일 목록 개수"), { target: { value: " 20 " } });
    fireEvent.click(screen.getByRole("button", { name: "단일 목록 개수 저장" }));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/admin/settings/rating.list_single");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ value: "20" });
  });

  it("정수 칸에 숫자가 아닌 값을 넣으면 서버를 부르지 않고 안내한다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(rows)));
    renderView();
    fireEvent.change(await screen.findByLabelText("단일 목록 개수"), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "단일 목록 개수 저장" }));
    expect(await screen.findByText("0 이상의 정수로 입력해 주세요.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("서버가 거절하면 그 줄에 오류를 보여 준다", async () => {
    fetchMock
      .mockResolvedValueOnce(json(page(rows)))
      .mockResolvedValueOnce(json({ code: "VALIDATION_ERROR", message: "요청 값을 확인해 주세요." }, 400));
    renderView();
    fireEvent.change(await screen.findByLabelText("단일 목록 개수"), { target: { value: "99" } });
    fireEvent.click(screen.getByRole("button", { name: "단일 목록 개수 저장" }));
    expect(await screen.findByText(/요청 값을 확인해 주세요/)).toBeInTheDocument();
  });

  const manyRows = [
    setting("rating.pivot", "6.0"),
    setting("rating.list_single", "15"),
    setting("list.max_lists", "10"),
    setting("peer.min_band_users", "5"),
    setting("setlist.recommend_ss_min", "-0.6"),
    setting("rival.max_count", "5"),
    setting("tier.notify_keep_days", "30"),
    setting("recognize.enabled", "false"),
    setting("ui.show_song_images", "false"),
    setting("future.new_key", "x"),
  ];
  const chip = (name: string) => screen.getByRole("button", { name });
  const list = async () => within(await screen.findByRole("list", { name: "설정 목록" }));

  it("묶음 칩 6개가 있고 처음에는 전체가 눌려 모든 설정이 보인다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(manyRows)));
    renderView();
    const l = await list();
    for (const name of ["전체", "레이팅", "목록", "같은 티어", "세트리스트·라이벌", "기타"]) {
      expect(chip(name)).toBeInTheDocument();
    }
    expect(chip("전체")).toHaveAttribute("aria-pressed", "true");
    expect(l.getAllByRole("listitem")).toHaveLength(manyRows.length);
  });

  it("묶음 칩은 새 요청 없이 키로 거른다: 레이팅(목록 곡 수 제외) / 목록 / 같은 티어 / 세트리스트·라이벌 / 기타(새 키 포함)", async () => {
    fetchMock.mockResolvedValueOnce(json(page(manyRows)));
    renderView();
    const l = await list();
    // 이름이 없는 새 키는 이름 칸에도 키가 그대로 보이므로 겹치는 글자는 한 번만 센다
    const keys = () => [...new Set(l.queryAllByText(/^[a-z_]+\.[a-z_]+$/).map((e) => e.textContent))];

    fireEvent.click(chip("레이팅"));
    expect(keys()).toEqual(["rating.pivot"]); // rating.list_single은 목록 묶음
    fireEvent.click(chip("목록"));
    expect(keys()).toEqual(["rating.list_single", "list.max_lists"]);
    fireEvent.click(chip("같은 티어"));
    expect(keys()).toEqual(["peer.min_band_users"]);
    fireEvent.click(chip("세트리스트·라이벌"));
    expect(keys()).toEqual(["setlist.recommend_ss_min", "rival.max_count"]);
    fireEvent.click(chip("기타"));
    expect(keys()).toEqual(["tier.notify_keep_days", "recognize.enabled", "ui.show_song_images", "future.new_key"]);
    expect(chip("기타")).toHaveAttribute("aria-pressed", "true");
    expect(chip("전체")).toHaveAttribute("aria-pressed", "false");
    expect(fetchMock).toHaveBeenCalledTimes(1); // 칩만으로는 요청하지 않는다

    fireEvent.click(chip("전체"));
    expect(l.getAllByRole("listitem")).toHaveLength(manyRows.length);
  });

  it("새로 확정한 이름·설명과 영문 키가 보이고, 이름이 없는 새 키는 키 그대로 보인다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(manyRows)));
    renderView();
    const l = await list();
    expect(l.getByLabelText("내 리스트 개수 상한")).toHaveValue("10");
    expect(l.getByText("list.max_lists")).toBeInTheDocument();
    expect(l.getByText("한 사람이 만들 수 있는 내 리스트의 최대 개수입니다.")).toBeInTheDocument();
    expect(l.getByLabelText("서열표 변경 알림 보관 일수")).toHaveValue("30");
    expect(l.getByLabelText("추천 SS 범위 최소")).toHaveValue("-0.6");
    // 이 값은 난이도대가 아니라 내 티어 구간의 공개 유저 수 하한이라 이름이 「티어 전체」다(사용자 승인)
    expect(l.getByLabelText("같은 티어 비교 최소 인원 (티어 전체)")).toHaveValue("5");
    expect(l.getByLabelText("future.new_key")).toHaveValue("x");
  });

  it("값을 바꾸면 그 카드에만 「바꾸는 중: 이전 → 새 값」이 보이고 저장 버튼이 켜지며, 되돌리면 사라진다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(manyRows)));
    renderView();
    const l = await list();
    expect(l.queryByText(/바꾸는 중/)).toBeNull();
    const input = l.getByLabelText("내 리스트 개수 상한");
    fireEvent.change(input, { target: { value: "12" } });
    expect(l.getByText("바꾸는 중: 10 → 12")).toBeInTheDocument();
    expect(l.getAllByText(/바꾸는 중/)).toHaveLength(1);
    expect(l.getByRole("button", { name: "내 리스트 개수 상한 저장" })).toBeEnabled();
    expect(l.getByRole("button", { name: "라이벌 등록 상한 저장" })).toBeDisabled();

    fireEvent.change(input, { target: { value: "10" } });
    expect(l.queryByText(/바꾸는 중/)).toBeNull();
    expect(l.getByRole("button", { name: "내 리스트 개수 상한 저장" })).toBeDisabled();
  });

  it("켬/끔 설정의 변경 표시는 true/false 대신 켬/끔으로 보인다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(manyRows)));
    renderView();
    const l = await list();
    fireEvent.change(l.getByLabelText("재킷 이미지 표시"), { target: { value: "true" } });
    expect(l.getByText("바꾸는 중: 끔 → 켬")).toBeInTheDocument();
  });

  it("묶음을 바꿔도 바꾸는 중이던 다른 묶음의 입력값은 요청 없이 유지된다(화면에서만 가림)", async () => {
    fetchMock.mockResolvedValueOnce(json(page(manyRows)));
    renderView();
    const l = await list();
    fireEvent.change(l.getByLabelText("내 리스트 개수 상한"), { target: { value: "12" } });
    fireEvent.click(chip("레이팅"));
    expect(l.queryByLabelText("내 리스트 개수 상한")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("켬/끔 설정은 true/false로 보낸다", async () => {
    fetchMock
      .mockResolvedValueOnce(json(page(rows)))
      .mockResolvedValueOnce(json(setting("ui.show_song_images", "true")))
      .mockResolvedValue(json(page(rows)));
    renderView();
    fireEvent.change(await screen.findByLabelText("재킷 이미지 표시"), { target: { value: "true" } });
    fireEvent.click(screen.getByRole("button", { name: "재킷 이미지 표시 저장" }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ value: "true" });
  });
});

describe("settingGroup", () => {
  it("키로 묶음을 정한다(알 수 없는 키는 기타)", () => {
    expect(settingGroup("rating.pivot")).toBe("rating");
    expect(settingGroup("rating.note_option")).toBe("rating");
    expect(settingGroup("rating.list_single")).toBe("list");
    expect(settingGroup("rating.list_other")).toBe("list");
    expect(settingGroup("list.max_items")).toBe("list");
    expect(settingGroup("peer.min_chart_users")).toBe("peer");
    expect(settingGroup("setlist.recommend_starter_tier")).toBe("setlistRival");
    expect(settingGroup("rival.notify_keep_days")).toBe("setlistRival");
    expect(settingGroup("recognize.min_role")).toBe("other");
    expect(settingGroup("ui.show_song_images")).toBe("other");
    expect(settingGroup("contact.takedown_email")).toBe("other");
    expect(settingGroup("tier.notify_bundle_over")).toBe("other");
    expect(settingGroup("brand.new")).toBe("other");
  });
});

describe("validateSettingValue", () => {
  it("종류별로 검사한다", () => {
    expect(validateSettingValue("rating.bonus", "3.2", koT)).toBeNull();
    expect(validateSettingValue("rating.bonus", "abc", koT)).toBe("숫자로 입력해 주세요.");
    expect(validateSettingValue("rating.list_other", "25", koT)).toBeNull();
    expect(validateSettingValue("rating.list_other", "-1", koT)).toBe("0 이상의 정수로 입력해 주세요.");
    expect(validateSettingValue("ui.show_song_images", "maybe", koT)).toBe("켬 또는 끔을 골라 주세요.");
    expect(validateSettingValue("rating.note_option", "SUPER_RANDOM", koT)).toBe("고를 수 있는 값이 아닙니다.");
    expect(validateSettingValue("contact.takedown_email", "  ", koT)).toBe("값을 입력해 주세요.");
    expect(validateSettingValue("unknown.key", "아무 글자", koT)).toBeNull();
  });
});
