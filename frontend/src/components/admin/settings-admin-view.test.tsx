import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsAdminView } from "@/components/admin/SettingsAdminView";
import type { PageResponse, SettingResponse } from "@/lib/api-types";
import { validateSettingValue } from "@/lib/admin";

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

describe("validateSettingValue", () => {
  it("종류별로 검사한다", () => {
    expect(validateSettingValue("rating.bonus", "3.2")).toBeNull();
    expect(validateSettingValue("rating.bonus", "abc")).toBe("숫자로 입력해 주세요.");
    expect(validateSettingValue("rating.list_other", "25")).toBeNull();
    expect(validateSettingValue("rating.list_other", "-1")).toBe("0 이상의 정수로 입력해 주세요.");
    expect(validateSettingValue("ui.show_song_images", "maybe")).toBe("켬 또는 끔을 골라 주세요.");
    expect(validateSettingValue("rating.note_option", "SUPER_RANDOM")).toBe("고를 수 있는 값이 아닙니다.");
    expect(validateSettingValue("contact.takedown_email", "  ")).toBe("값을 입력해 주세요.");
    expect(validateSettingValue("unknown.key", "아무 글자")).toBeNull();
  });
});
