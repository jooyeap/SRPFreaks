import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { ListAddButton } from "@/components/mylists/ListAddButton";
import { ToastProvider } from "@/components/Toast";
import type { SetlistItemResponse, UserListSummaryResponse } from "@/lib/api-types";
import { clearAccessToken } from "@/lib/auth-token";

vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push, back: vi.fn() }), usePathname: () => "/songs/1" }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const AUTH = {
  accessToken: "t", tokenType: "Bearer", expiresIn: 900,
  user: { id: 1, email: "a@example.com", nickname: null, role: "USER", createdAt: "2026-10-01T00:00:00Z" },
};
const page = <T,>(content: T[]) => ({ content, page: 0, size: 100, totalElements: content.length, totalPages: 1 });
const setlistItem = (id: number, songDifficultyId: number): SetlistItemResponse => ({
  id, songDifficultyId, songId: 200, title: "곡10", part: "GUITAR", difficulty: "MASTER", level: 9.5, tier: 6.2, pattern: "단일", mine: null, done: false, createdAt: "2026-10-16T05:00:00Z",
});
const list = (id: number, name: string, contains: boolean): UserListSummaryResponse => ({ id, name, itemCount: 3, contains });

describe("ListAddButton (곡 상세의 리스트에 추가, D76)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let setlist: SetlistItemResponse[] = [];
  let lists: UserListSummaryResponse[] = [];
  let loggedIn = true;
  let createResponse: () => Response = () => json(list(7, "새 리스트", false), 201);
  const calls = (method: string, part: string) => fetchMock.mock.calls.filter(([input, init]) => String(input).includes(part) && (init?.method ?? "GET") === method);

  beforeEach(() => {
    clearAccessToken();
    push.mockReset();
    setlist = [];
    lists = [];
    loggedIn = true;
    createResponse = () => json(list(7, "새 리스트", false), 201);
    fetchMock.mockReset();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/auth/refresh")) return Promise.resolve(loggedIn ? json(AUTH) : json({ code: "AUTH_FAILED", message: "로그인이 필요합니다." }, 401));
      if (url.includes("/me/lists/") && url.includes("/items") && method === "POST") return Promise.resolve(json({ alreadyContained: false, itemCount: 4 }, 201));
      if (url.includes("/me/lists/") && url.includes("/items/") && method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
      if (url.includes("/me/lists") && method === "POST") return Promise.resolve(createResponse());
      if (url.includes("/me/lists")) return Promise.resolve(json(page(lists)));
      if (url.includes("/setlist/") && method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
      if (url.includes("/setlist") && method === "POST") return Promise.resolve(json(setlistItem(9, 110), 201));
      if (url.includes("/setlist")) return Promise.resolve(json(page(setlist)));
      return Promise.resolve(json({}));
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderButton() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <ToastProvider>
            <ListAddButton songDifficultyId={110} title="곡10" />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>,
    );
  }
  async function pressButton() {
    const button = await screen.findByRole("button", { name: "곡10 리스트에 추가" });
    await waitFor(() => expect(button).toBeEnabled());
    return button;
  }

  it("로그인하지 않았으면 아무것도 그리지 않고 리스트도 요청하지 않는다", async () => {
    loggedIn = false;
    renderButton();
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/auth/refresh"))).toBe(true));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/me/lists"))).toBe(false);
  });

  it("리스트가 0개면 시트 없이 세트리스트에 바로 담고, 토스트의 `리스트 만들기`는 내 리스트 탭으로 보낸다", async () => {
    renderButton();
    fireEvent.click(await pressButton());

    await waitFor(() => expect(calls("POST", "/setlist")).toHaveLength(1));
    expect(JSON.parse(String(calls("POST", "/setlist")[0][1]?.body))).toEqual({ songDifficultyId: 110 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByText("세트리스트에 담았습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "리스트 만들기" }));
    expect(push).toHaveBeenCalledWith("/me?tab=list&view=mine");
  });

  it("리스트가 0개이고 이미 세트리스트에 있으면 누를 때 세트리스트에서 뺀다 (예전 토글과 같다)", async () => {
    setlist = [setlistItem(10, 110)];
    renderButton();
    fireEvent.click(await pressButton());
    await waitFor(() => expect(calls("DELETE", "/setlist/10")).toHaveLength(1));
    expect(await screen.findByText("세트리스트에서 뺐습니다.")).toBeInTheDocument();
  });

  it("리스트가 1개 이상이면 시트가 열리고, 세트리스트와 내 리스트가 한 줄씩 보인다 (다른 곳에 담긴 곡은 `담김`)", async () => {
    lists = [list(1, "연습", true), list(2, "도전", false)];
    renderButton();
    fireEvent.click(await pressButton());

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("button", { name: "곡10 세트리스트에 담기" })).toHaveAttribute("aria-pressed", "false");
    expect(within(sheet).getByRole("button", { name: "곡10 연습에서 빼기" })).toHaveAttribute("aria-pressed", "true");
    expect(within(sheet).getByRole("button", { name: "곡10 도전에 담기" })).toHaveAttribute("aria-pressed", "false");
    expect(within(sheet).getByText("담김")).toBeInTheDocument(); // 색이 아니라 글자로도 구분
    expect(calls("POST", "/setlist")).toHaveLength(0); // 시트를 여는 것만으로는 담지 않는다
  });

  it("여러 곳에 동시에 담을 수 있고, 담긴 줄을 다시 누르면 뺀다 (오류 없이)", async () => {
    lists = [list(1, "연습", true), list(2, "도전", false)];
    renderButton();
    fireEvent.click(await pressButton());
    const sheet = await screen.findByRole("dialog");

    fireEvent.click(within(sheet).getByRole("button", { name: "곡10 도전에 담기" }));
    await waitFor(() => expect(calls("POST", "/me/lists/2/items")).toHaveLength(1));
    expect(JSON.parse(String(calls("POST", "/me/lists/2/items")[0][1]?.body))).toEqual({ songDifficultyId: 110 });

    fireEvent.click(within(sheet).getByRole("button", { name: "곡10 연습에서 빼기" }));
    await waitFor(() => expect(calls("DELETE", "/me/lists/1/items/110")).toHaveLength(1));

    fireEvent.click(within(sheet).getByRole("button", { name: "곡10 세트리스트에 담기" }));
    await waitFor(() => expect(calls("POST", "/setlist")).toHaveLength(1));
  });

  it("`+ 새 리스트에 담기`: 이름을 입력하면 리스트를 만들고 그 리스트에 이 곡을 담는다", async () => {
    lists = [list(1, "연습", false)];
    renderButton();
    fireEvent.click(await pressButton());
    const sheet = await screen.findByRole("dialog");

    fireEvent.click(within(sheet).getByRole("button", { name: /새 리스트에 담기/ }));
    fireEvent.change(within(sheet).getByLabelText("리스트 이름"), { target: { value: "  새 리스트  " } });
    fireEvent.click(within(sheet).getByRole("button", { name: "만들고 담기" }));

    await waitFor(() => expect(calls("POST", "/me/lists/7/items")).toHaveLength(1));
    const created = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/me/lists") && init?.method === "POST");
    expect(JSON.parse(String(created?.[1]?.body))).toEqual({ name: "새 리스트" }); // 앞뒤 공백을 뗀 글자
    expect(await screen.findByText("「새 리스트」을 만들고 담았습니다.")).toBeInTheDocument();
  });

  it("같은 이름 같은 서버 거절은 문구 그대로 안내하고 곡을 담지 않는다", async () => {
    lists = [list(1, "연습", false)];
    createResponse = () => json({ code: "LIST_NAME_DUPLICATE", message: "같은 이름의 리스트가 이미 있습니다. 다른 이름을 입력해 주세요." }, 400);
    renderButton();
    fireEvent.click(await pressButton());
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: /새 리스트에 담기/ }));
    fireEvent.change(within(sheet).getByLabelText("리스트 이름"), { target: { value: "연습" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "만들고 담기" }));

    expect(await screen.findByText("같은 이름의 리스트가 이미 있습니다. 다른 이름을 입력해 주세요.")).toBeInTheDocument();
    expect(calls("POST", "/items")).toHaveLength(0);
  });

  it("이름이 비었으면 요청하지 않고 입력 안내를 보인다", async () => {
    lists = [list(1, "연습", false)];
    renderButton();
    fireEvent.click(await pressButton());
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: /새 리스트에 담기/ }));
    fireEvent.click(within(sheet).getByRole("button", { name: "만들고 담기" }));
    expect(await within(sheet).findByRole("alert")).toHaveTextContent("리스트 이름을 입력해 주세요.");
    expect(fetchMock.mock.calls.some(([input, init]) => String(input).endsWith("/me/lists") && init?.method === "POST")).toBe(false);
  });
});
