import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { SetlistTab } from "@/components/setlist/SetlistTab";
import { SetlistToggleButton } from "@/components/setlist/SetlistToggleButton";
import type { SetlistItemResponse } from "@/lib/api-types";
import { clearAccessToken } from "@/lib/auth-token";

vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }), usePathname: () => "/me" }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function item(id: number, over: Partial<SetlistItemResponse> = {}): SetlistItemResponse {
  return {
    id, songDifficultyId: 100 + id, songId: 200 + id, title: `곡${String(id).padStart(2, "0")}`, part: "GUITAR", difficulty: "MASTER",
    level: 9.5, tier: 6.2, mine: null, done: false, createdAt: "2026-10-16T05:00:00Z", ...over,
  };
}
function pageOf(content: SetlistItemResponse[]) {
  return { content, page: 0, size: 30, totalElements: content.length, totalPages: 1 };
}

const AUTH = {
  accessToken: "t", tokenType: "Bearer", expiresIn: 900,
  user: { id: 1, email: "a@example.com", nickname: null, role: "USER", createdAt: "2026-10-01T00:00:00Z" },
};

describe("세트리스트", () => {
  const fetchMock = vi.fn<typeof fetch>();
  /** 응답 상태를 바꿔 가며 쓰는 가짜 서버: 세트리스트 목록과 로그인 복구만 응답한다. */
  let listed: SetlistItemResponse[] = [];
  let loggedIn = true;
  const calls = (method: string) =>
    fetchMock.mock.calls.filter(([input, init]) => String(input).includes("/setlist") && (init?.method ?? "GET") === method);

  beforeEach(() => {
    clearAccessToken();
    listed = [];
    loggedIn = true;
    fetchMock.mockReset();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/auth/refresh")) return Promise.resolve(loggedIn ? json(AUTH) : json({ code: "AUTH_FAILED", message: "로그인이 필요합니다." }, 401));
      if (url.includes("/setlist/done")) return Promise.resolve(json({ removed: listed.filter((i) => i.done).length }));
      if (url.includes("/setlist") && method === "POST") return Promise.resolve(json(item(9), 201));
      if (url.includes("/setlist") && method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
      if (url.includes("/setlist")) return Promise.resolve(json(pageOf(listed)));
      if (url.includes("/records")) return Promise.resolve(json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
      return Promise.resolve(json({}));
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderWith(ui: React.ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <AuthProvider>{ui}</AuthProvider>
      </QueryClientProvider>,
    );
  }

  describe("SetlistToggleButton", () => {
    it("담기 전에는 담기 버튼이고, 누르면 POST로 채보를 담는다", async () => {
      renderWith(<SetlistToggleButton songDifficultyId={55} title="테스트곡" />);
      const button = await screen.findByRole("button", { name: "테스트곡 세트리스트에 담기" });
      await waitFor(() => expect(button).toBeEnabled()); // 목록을 받기 전에는 담김 여부를 몰라 막아 둔다
      expect(button).toHaveAttribute("aria-pressed", "false");

      fireEvent.click(button);

      await waitFor(() => expect(calls("POST")).toHaveLength(1));
      expect(JSON.parse(String(calls("POST")[0][1]?.body))).toEqual({ songDifficultyId: 55 });
    });

    it("이미 담긴 채보는 담김 상태로 보이고, 누르면 그 줄을 DELETE로 뺀다", async () => {
      listed = [item(7, { songDifficultyId: 55 })];
      renderWith(<SetlistToggleButton songDifficultyId={55} title="테스트곡" />);
      const button = await screen.findByRole("button", { name: "테스트곡 세트리스트에서 빼기" });
      expect(button).toHaveAttribute("aria-pressed", "true");

      await waitFor(() => expect(button).toBeEnabled());
      fireEvent.click(button);

      await waitFor(() => expect(calls("DELETE")).toHaveLength(1));
      expect(String(calls("DELETE")[0][0])).toMatch(/\/setlist\/7$/);
    });

    it("곡 상세용 큰 버튼은 글자로 담김 여부를 보여 준다", async () => {
      listed = [item(7, { songDifficultyId: 55 })];
      renderWith(<SetlistToggleButton variant="full" songDifficultyId={55} title="테스트곡" />);
      expect(await screen.findByText("세트리스트에 담김")).toBeInTheDocument();
    });

    it("로그인하지 않았으면 아무것도 그리지 않고 세트리스트를 요청하지 않는다", async () => {
      loggedIn = false;
      renderWith(<SetlistToggleButton songDifficultyId={55} title="테스트곡" />);
      await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/auth/refresh"))).toBe(true));
      expect(screen.queryByRole("button")).toBeNull();
      expect(calls("GET")).toHaveLength(0);
    });
  });

  describe("SetlistTab", () => {
    it("완료 개수와 줄마다 완료·미완료 글자, 내 최고 기록을 보여 준다", async () => {
      listed = [
        item(1, { done: true, mine: { rate: 96.5, fullCombo: false, stage: "SS" } }),
        item(2),
      ];
      renderWith(<SetlistTab userId={1} />);

      const list = await screen.findByRole("list", { name: "세트리스트" });
      expect(screen.getByText(/완료/, { selector: "p" })).toHaveTextContent("완료 1 / 전체 2");
      const rows = within(list).getAllByRole("listitem");
      expect(rows[0]).toHaveTextContent("곡01");
      expect(rows[0]).toHaveTextContent("완료");
      expect(rows[0]).toHaveTextContent("96.50");
      expect(rows[1]).toHaveTextContent("미완료");
    });

    it("비어 있으면 담는 방법을 안내하고 비우기 버튼은 막혀 있다", async () => {
      renderWith(<SetlistTab userId={1} />);
      expect(await screen.findByText(/담은 곡이 없습니다/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "완료한 곡 비우기" })).toBeDisabled();
    });

    it("완료한 곡이 있으면 비우기를 눌러 DELETE /setlist/done을 보낸다", async () => {
      listed = [item(1, { done: true }), item(2)];
      renderWith(<SetlistTab userId={1} />);
      const button = await screen.findByRole("button", { name: "완료한 곡 비우기" });
      expect(button).toBeEnabled();

      fireEvent.click(button);

      await waitFor(() => expect(calls("DELETE").some(([input]) => String(input).endsWith("/setlist/done"))).toBe(true));
    });

    it("줄의 빼기 버튼은 그 줄만 DELETE한다", async () => {
      listed = [item(1), item(2)];
      renderWith(<SetlistTab userId={1} />);
      fireEvent.click(await screen.findByRole("button", { name: "곡02 세트리스트에서 빼기" }));

      await waitFor(() => expect(calls("DELETE")).toHaveLength(1));
      expect(String(calls("DELETE")[0][0])).toMatch(/\/setlist\/2$/);
    });

    it("곡이 많으면 10개씩 나눠 보인다", async () => {
      listed = Array.from({ length: 23 }, (_, i) => item(i + 1));
      renderWith(<SetlistTab userId={1} />);

      const list = await screen.findByRole("list", { name: "세트리스트" });
      expect(within(list).getAllByRole("listitem")).toHaveLength(10);
      expect(screen.getByText("1 / 3")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "다음" }));
      expect(within(screen.getByRole("list", { name: "세트리스트" })).getByText("곡11")).toBeInTheDocument();
    });

    it("기록 입력을 누르면 그 채보의 기록 등록 창이 열린다", async () => {
      listed = [item(1)];
      renderWith(<SetlistTab userId={1} />);
      fireEvent.click(await screen.findByRole("button", { name: "곡01 기록 입력" }));

      expect(await screen.findByRole("heading", { name: "기록 등록" })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByLabelText("달성률")).toBeInTheDocument());
    });
  });
});
