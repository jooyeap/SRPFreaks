import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UsersAdminView } from "@/components/admin/UsersAdminView";
import type { AdminUserResponse, PageResponse } from "@/lib/api-types";
import { DESKTOP_QUERY } from "@/lib/use-media-query";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function user(id: number, over: Partial<AdminUserResponse> = {}): AdminUserResponse {
  return { id, email: `u${id}@example.com`, nickname: `ユーザー${id}`, role: "USER", status: "ACTIVE", createdAt: "2026-10-01T00:00:00Z", ...over };
}

function page(content: AdminUserResponse[]): PageResponse<AdminUserResponse> {
  return { content, page: 0, size: 30, totalElements: content.length, totalPages: 1 };
}

const rows = [user(1, { role: "ROOT", nickname: "ルート" }), user(2), user(3, { role: "ADMIN", status: "BLOCKED" }), user(4, { nickname: null })];

/** 데스크톱 폭(1024px 이상)인 것처럼 보이게 한다. 지정하지 않으면 테스트 환경에는 matchMedia가 없어 폰 구성이다. */
function stubViewport(desktop: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: desktop && query === DESKTOP_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe("사용자 관리 화면 (폰: 압축 행)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderView = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <UsersAdminView viewerId={1} />
      </QueryClientProvider>,
    );

  /** 압축 행의 머리 버튼(aria-expanded가 있는 버튼). 이름으로 찾는다. */
  const head = (nickname: string) =>
    screen.getAllByRole("button").find((b) => b.hasAttribute("aria-expanded") && (b.textContent ?? "").startsWith(nickname));

  async function expand(nickname: string) {
    await screen.findByText(nickname);
    const button = head(nickname);
    expect(button).toBeDefined();
    fireEvent.click(button as HTMLElement);
  }

  it("압축 행에는 닉네임과 역할 칩·차단 표시만 보이고, 이메일은 펼쳐야 보인다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(rows)));
    renderView();
    expect(await screen.findByText("ユーザー2")).toBeInTheDocument();
    expect(screen.getByText("(닉네임 없음)")).toBeInTheDocument();
    expect(screen.getByText(/차단됨/)).toBeInTheDocument();
    expect(screen.queryByText(/u2@example\.com/)).toBeNull();
    expect(head("ユーザー2")).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(head("ユーザー2") as HTMLElement);
    expect(head("ユーザー2")).toHaveAttribute("aria-expanded", "true");
    const meta = screen.getByText(/u2@example\.com/);
    expect(meta).toBeInTheDocument();
    expect(meta).toHaveTextContent(/가입 2026/);
  });

  it("한 번에 하나만 펼쳐지고, 다시 누르면 접힌다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(rows)));
    renderView();
    await expand("ユーザー2");
    expect(head("ユーザー2")).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(head("ユーザー3") as HTMLElement);
    expect(head("ユーザー3")).toHaveAttribute("aria-expanded", "true");
    expect(head("ユーザー2")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/u2@example\.com/)).toBeNull();

    fireEvent.click(head("ユーザー3") as HTMLElement);
    expect(head("ユーザー3")).toHaveAttribute("aria-expanded", "false");
  });

  it("ROOT 줄은 펼치지 않고 `변경 불가`로 보이며 변경·차단 버튼이 없다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(rows)));
    renderView();
    await screen.findByText("ルート");
    expect(screen.getByText("변경 불가")).toBeInTheDocument();
    expect(head("ルート")).toBeUndefined(); // 펼치는 버튼이 없다
    expect(screen.getByText(/u1@example\.com/)).toBeInTheDocument(); // 누구인지는 알아볼 수 있다
    expect(screen.queryByRole("radiogroup", { name: "ルート 역할" })).toBeNull();
    expect(screen.queryByRole("button", { name: "ルート 차단" })).toBeNull();
  });

  it("고를 수 있는 역할 칩에 ROOT는 없고, 지금 역할이 눌려 있다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(rows)));
    renderView();
    await expand("ユーザー2");
    const group = screen.getByRole("radiogroup", { name: "ユーザー2 역할" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["일반 사용자(USER)", "관리자(ADMIN)"]);
    expect(within(group).getByRole("radio", { name: "일반 사용자(USER)" })).toHaveAttribute("aria-checked", "true");
    expect(within(group).getByRole("radio", { name: "관리자(ADMIN)" })).toHaveAttribute("aria-checked", "false");
  });

  it("역할 칩을 바꿔 저장하면 PATCH /admin/users/{id}/role로 보낸다(바꾸기 전에는 저장이 막혀 있다)", async () => {
    fetchMock
      .mockResolvedValueOnce(json(page(rows)))
      .mockResolvedValueOnce(json(user(2, { role: "ADMIN" })))
      .mockResolvedValue(json(page(rows)));
    renderView();
    await expand("ユーザー2");
    expect(screen.getByRole("button", { name: "ユーザー2 역할 저장" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "관리자(ADMIN)" }));
    fireEvent.click(screen.getByRole("button", { name: "ユーザー2 역할 저장" }));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/admin/users/2/role");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ role: "ADMIN" });
  });

  it("서버가 거절하면 그 줄에 오류를 보여 준다", async () => {
    fetchMock
      .mockResolvedValueOnce(json(page(rows)))
      .mockResolvedValueOnce(json({ code: "FORBIDDEN", message: "권한이 없습니다." }, 403));
    renderView();
    await expand("ユーザー2");
    fireEvent.click(screen.getByRole("radio", { name: "관리자(ADMIN)" }));
    fireEvent.click(screen.getByRole("button", { name: "ユーザー2 역할 저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("권한이 없습니다.");
  });

  it("차단 버튼을 누르면 확인 창이 먼저 뜨고, 확인해야 PATCH /admin/users/{id}/status로 보낸다", async () => {
    fetchMock
      .mockResolvedValueOnce(json(page(rows)))
      .mockResolvedValueOnce(json(user(2, { status: "BLOCKED" })))
      .mockResolvedValue(json(page(rows)));
    renderView();
    await expand("ユーザー2");
    fireEvent.click(screen.getByRole("button", { name: "ユーザー2 차단" }));

    expect(screen.getByText(/계정을 차단할까요\?/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // 확인 전에는 요청을 보내지 않는다
    fireEvent.click(screen.getByRole("button", { name: "차단" }));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/admin/users/2/status");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ status: "BLOCKED" });
  });

  it("확인 창에서 취소하면 요청을 보내지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(rows)));
    renderView();
    await expand("ユーザー2");
    fireEvent.click(screen.getByRole("button", { name: "ユーザー2 차단" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(screen.queryByText(/계정을 차단할까요\?/)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("차단된 사용자 줄에는 `차단 해제`가 보이고 ACTIVE로 보낸다", async () => {
    fetchMock
      .mockResolvedValueOnce(json(page(rows)))
      .mockResolvedValueOnce(json(user(3, { role: "ADMIN" })))
      .mockResolvedValue(json(page(rows)));
    renderView();
    await expand("ユーザー3");
    expect(screen.queryByRole("button", { name: "ユーザー3 차단" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "ユーザー3 차단 해제" }));
    fireEvent.click(screen.getByRole("button", { name: "차단 해제" }));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/admin/users/3/status");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ status: "ACTIVE" });
  });

  it("처음에는 10명 크기로 검색어 없이 불러온다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(rows)));
    renderView();
    await screen.findByText("ユーザー2");
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("size=10");
    expect(url).not.toContain("q=");
  });

  it("검색어를 넣고 검색하면 q로 보내고 첫 쪽부터 다시 본다", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ ...page(rows), totalPages: 3 }))
      .mockResolvedValue(json(page([user(2)])));
    renderView();
    await screen.findByText("ユーザー2");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => expect(String(fetchMock.mock.calls[1]?.[0])).toContain("page=1"));

    fireEvent.change(screen.getByLabelText("닉네임 또는 이메일 검색"), { target: { value: "  ユーザー2 " } });
    fireEvent.click(screen.getByRole("button", { name: "검색" }));

    await waitFor(() => {
      const url = String(fetchMock.mock.calls.at(-1)?.[0]);
      expect(url).toContain("q=%E3%83%A6%E3%83%BC%E3%82%B6%E3%83%BC2");
      expect(url).toContain("page=0");
    });
  });

  it("검색 결과가 없으면 안내를 보이고, 초기화하면 전체 목록으로 돌아간다", async () => {
    fetchMock
      .mockResolvedValueOnce(json(page(rows)))
      .mockResolvedValueOnce(json(page([])))
      .mockResolvedValue(json(page(rows)));
    renderView();
    await screen.findByText("ユーザー2");
    fireEvent.change(screen.getByLabelText("닉네임 또는 이메일 검색"), { target: { value: "없는사람" } });
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    expect(await screen.findByText("검색 결과가 없습니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(await screen.findByText("ユーザー2")).toBeInTheDocument();
    expect(screen.getByLabelText("닉네임 또는 이메일 검색")).toHaveValue("");
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).not.toContain("q=");
  });
});

describe("사용자 관리 화면 (데스크톱 1024px 이상: 표)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    stubViewport(true);
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderView = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <UsersAdminView viewerId={1} />
      </QueryClientProvider>,
    );

  it("닉네임 / 이메일 / 역할 / 가입일 / 관리 열의 표로 보이고, 이메일은 예전 화면처럼 보인다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(rows)));
    renderView();
    const table = await screen.findByRole("table", { name: "사용자 목록" });
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["닉네임", "이메일", "역할", "가입일", "관리"]);
    expect(within(table).getByText(/u2@example\.com/)).toBeInTheDocument();
    expect(within(table).getByText(/차단됨/)).toBeInTheDocument();
    // 표에서는 압축 행처럼 펼치는 버튼이 없다
    expect(screen.queryAllByRole("button").some((b) => b.hasAttribute("aria-expanded"))).toBe(false);
  });

  it("ROOT 줄에는 `변경 불가`만 있고 역할 변경·차단 버튼이 없다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(rows)));
    renderView();
    const table = await screen.findByRole("table", { name: "사용자 목록" });
    const rootRow = within(table).getByText("ルート").closest("tr") as HTMLElement;
    expect(within(rootRow).getByText("변경 불가")).toBeInTheDocument();
    expect(within(rootRow).queryAllByRole("button")).toHaveLength(0);
  });

  it("`역할 변경`은 작은 창에서 하고, 바꿔 저장하면 같은 PATCH를 보낸 뒤 창이 닫힌다", async () => {
    fetchMock
      .mockResolvedValueOnce(json(page(rows)))
      .mockResolvedValueOnce(json(user(2, { role: "ADMIN" })))
      .mockResolvedValue(json(page(rows)));
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "역할 변경: ユーザー2" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "역할 변경" })).toBeInTheDocument();
    // 바꾸기 전에는 저장이 막혀 있다
    expect(within(dialog).getByRole("button", { name: "ユーザー2 역할 저장" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("radio", { name: "관리자(ADMIN)" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "ユーザー2 역할 저장" }));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/admin/users/2/role");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ role: "ADMIN" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("역할 변경 창에서 취소하면 요청을 보내지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(rows)));
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "역할 변경: ユーザー2" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("표에서도 차단은 확인 창을 먼저 거친다", async () => {
    fetchMock
      .mockResolvedValueOnce(json(page(rows)))
      .mockResolvedValueOnce(json(user(2, { status: "BLOCKED" })))
      .mockResolvedValue(json(page(rows)));
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "ユーザー2 차단" }));
    expect(screen.getByText(/계정을 차단할까요\?/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "차단" }));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/admin/users/2/status");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ status: "BLOCKED" });
  });
});
