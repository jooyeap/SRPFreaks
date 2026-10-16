import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { RecordDialog } from "@/components/record/RecordDialog";
import type { RecordChart } from "@/components/record/RecordForm";
import { ToastProvider } from "@/components/Toast";
import { clearAccessToken } from "@/lib/auth-token";
import type { RecordResponse } from "@/lib/records";

const chart: RecordChart = { songDifficultyId: 42, title: "지금곡", part: "GUITAR", difficulty: "MASTER", level: 9.5 };
const AUTH = {
  accessToken: "t",
  tokenType: "Bearer",
  expiresIn: 900,
  user: { id: 1, email: "a@example.com", nickname: null, role: "USER", createdAt: "2026-10-01T00:00:00Z" },
};

function rec(id: number, chartId: number, title: string, part: "GUITAR" | "BASS" = "GUITAR"): RecordResponse {
  return {
    id, songDifficultyId: chartId, songId: chartId, title, part, difficulty: "MASTER", level: 9, noteOption: "SUPER_RANDOM_PLUS",
    achievementRate: 90, fullCombo: false, stage: "S", playedAt: null, platform: null, memo: null,
    createdAt: "2026-10-05T01:00:00Z", updatedAt: "2026-10-05T01:00:00Z",
  };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("최근 입력한 곡 바로가기", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let recent: RecordResponse[];

  beforeEach(() => {
    clearAccessToken();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    // 최근 입력 순서: 지금 곡(42), 알파(50) 두 번, 베타(51, 베이스)
    recent = [rec(1, 42, "지금곡"), rec(2, 50, "알파"), rec(3, 50, "알파"), rec(4, 51, "베타", "BASS")];
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return Promise.resolve(json(AUTH));
      if (url.includes("sort=entered")) return Promise.resolve(json({ content: recent, page: 0, size: 20, totalElements: recent.length, totalPages: 1 }));
      return Promise.resolve(json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderDialog() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <ToastProvider>
            <RecordDialog chart={chart} onClose={vi.fn()} />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>,
    );
  }

  it("지금 열린 곡은 빼고, 같은 곡은 한 번만 보여 준다", async () => {
    renderDialog();
    const section = await screen.findByRole("region", { name: "최근 입력한 곡" });
    const buttons = within(section).getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent("알파");
    expect(buttons[1]).toHaveTextContent("베타");
    expect(buttons[1]).toHaveTextContent("Bass MAS");
  });

  it("누르면 그 곡의 기록 창으로 바뀐다", async () => {
    renderDialog();
    const section = await screen.findByRole("region", { name: "최근 입력한 곡" });
    fireEvent.click(within(section).getByRole("button", { name: /알파/ }));
    expect(await screen.findByText("알파", { selector: "p.truncate.font-bold" })).toBeInTheDocument();
    // 이제 알파가 열려 있으므로 목록에서는 빠지고 지금곡이 들어온다
    await waitFor(() => {
      const names = within(screen.getByRole("region", { name: "최근 입력한 곡" })).getAllByRole("button").map((b) => b.textContent);
      expect(names.join("|")).toContain("지금곡");
      expect(names.join("|")).not.toContain("알파");
    });
  });

  it("입력 중인 값이 있으면 옮기지 않고 안내한다", async () => {
    renderDialog();
    const section = await screen.findByRole("region", { name: "최근 입력한 곡" });
    fireEvent.change(await screen.findByLabelText("달성률"), { target: { value: "95" } });
    fireEvent.click(within(section).getByRole("button", { name: /알파/ }));
    expect(await screen.findByText(/입력 중인 값이 있습니다/)).toBeInTheDocument();
    expect(screen.getByLabelText("달성률")).toHaveValue("95");
  });

  it("최근 입력한 기록이 없으면 아무것도 그리지 않는다", async () => {
    recent = [];
    renderDialog();
    await screen.findByLabelText("달성률");
    expect(screen.queryByRole("region", { name: "최근 입력한 곡" })).toBeNull();
  });
});
