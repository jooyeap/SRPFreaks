import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyListsTab } from "@/components/mylists/MyListsTab";
import { ToastProvider } from "@/components/Toast";
import type { UserListDetailResponse, UserListItemResponse, UserListSummaryResponse } from "@/lib/api-types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }), usePathname: () => "/me" }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const page = <T,>(content: T[]) => ({ content, page: 0, size: 100, totalElements: content.length, totalPages: 1 });
const summary = (id: number, name: string, itemCount: number): UserListSummaryResponse => ({ id, name, itemCount, contains: false });
const item = (id: number, rate: number | null): UserListItemResponse => ({
  id, songDifficultyId: 100 + id, songId: 200 + id, title: `곡${id}`, part: "GUITAR", difficulty: "MASTER", level: 9.5, tier: 6.2, pattern: "단일",
  mine: rate === null ? null : { rate, fullCombo: false, stage: "S" }, createdAt: "2026-10-16T05:00:00Z",
});

describe("MyListsTab (내 리스트, D76)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let lists: UserListSummaryResponse[] = [];
  let detail: UserListDetailResponse = { id: 1, name: "연습", itemCount: 0, items: page<UserListItemResponse>([]) };
  let createResponse: () => Response = () => json(summary(5, "새 리스트", 0), 201);
  const calls = (method: string, part: string) => fetchMock.mock.calls.filter(([input, init]) => String(input).includes(part) && (init?.method ?? "GET") === method);

  beforeEach(() => {
    lists = [];
    detail = { id: 1, name: "연습", itemCount: 0, items: page<UserListItemResponse>([]) };
    createResponse = () => json(summary(5, "새 리스트", 0), 201);
    fetchMock.mockReset();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (/\/me\/lists\/\d+\/items\/order$/.test(url) && method === "PUT") return Promise.resolve(new Response(null, { status: 204 }));
      if (/\/me\/lists\/\d+\/items\/\d+$/.test(url) && method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
      if (/\/me\/lists\/\d+$/.test(url) && method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
      if (/\/me\/lists\/\d+$/.test(url) && method === "PATCH") return Promise.resolve(json(summary(1, "바뀐 이름", 2)));
      if (/\/me\/lists\/\d+(\?|$)/.test(url)) return Promise.resolve(json(detail));
      if (url.includes("/me/lists") && method === "POST") return Promise.resolve(createResponse());
      if (url.includes("/me/lists")) return Promise.resolve(json(page(lists)));
      return Promise.resolve(json({})); // 재킷 설정 등
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderTab() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <MyListsTab userId={1} />
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  it("리스트가 없으면 빈 상태 안내와 `새 리스트 만들기`가 보인다", async () => {
    renderTab();
    expect(await screen.findByText(/만든 리스트가 없습니다/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /새 리스트 만들기/ })).toBeInTheDocument();
  });

  it("리스트 목록에 이름과 곡 수가 보이고, 누르면 그 리스트를 연다", async () => {
    lists = [summary(1, "연습", 2), summary(2, "도전", 0)];
    detail = { id: 1, name: "연습", itemCount: 2, items: page([item(1, 91.5), item(2, null)]) };
    renderTab();
    const index = await screen.findByRole("list", { name: "내 리스트 목록" });
    expect(within(index).getByText("2곡")).toBeInTheDocument();
    fireEvent.click(within(index).getByRole("button", { name: "연습 열기" }));

    const songs = await screen.findByRole("list", { name: "연습 곡 목록" });
    expect(within(songs).getAllByRole("listitem")).toHaveLength(2);
    // 내 달성률·단계는 서버가 계산해 준 값으로 보이고(곡마다 요청하지 않는다), 기록이 없는 곡은 비어 있다
    expect(within(songs).getByText("91.50")).toBeInTheDocument();
    expect(calls("GET", "/me/lists/1")).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/records")).length).toBe(0);
  });

  it("새 리스트 만들기: 이름을 입력하면 POST하고 그 리스트를 연다", async () => {
    detail = { id: 5, name: "새 리스트", itemCount: 0, items: page<UserListItemResponse>([]) };
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: /새 리스트 만들기/ }));
    fireEvent.change(screen.getByLabelText("리스트 이름"), { target: { value: " 새 리스트 " } });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));

    await waitFor(() => expect(calls("POST", "/me/lists")).toHaveLength(1));
    expect(JSON.parse(String(calls("POST", "/me/lists")[0][1]?.body))).toEqual({ name: "새 리스트" });
    expect(await screen.findByText("담은 곡이 없습니다. 아래 「곡 추가」로 곡을 담아 보세요.")).toBeInTheDocument();
  });

  it("개수 한도 같은 서버 거절은 문구 그대로 안내하고 폼을 유지한다", async () => {
    createResponse = () => json({ code: "LIST_LIMIT", message: "더 이상 리스트를 만들 수 없습니다. 쓰지 않는 리스트를 지운 뒤 다시 시도해 주세요." }, 400);
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: /새 리스트 만들기/ }));
    fireEvent.change(screen.getByLabelText("리스트 이름"), { target: { value: "하나 더" } });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));
    expect(await screen.findByText(/더 이상 리스트를 만들 수 없습니다/)).toBeInTheDocument();
    expect(screen.getByLabelText("리스트 이름")).toBeInTheDocument();
  });

  async function openDetail() {
    lists = [summary(1, "연습", 3)];
    detail = { id: 1, name: "연습", itemCount: 3, items: page([item(1, 91.5), item(2, null), item(3, 80)]) };
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: "연습 열기" }));
    await screen.findByRole("list", { name: "연습 곡 목록" });
  }

  it("편집 모드에서 아래로 옮기면 전체 채보 id를 새 순서로 PUT한다 (맨 위의 위로·맨 아래의 아래로는 막힌다)", async () => {
    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    expect(screen.getByRole("button", { name: "곡1 위로 옮기기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "곡3 아래로 옮기기" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "곡1 아래로 옮기기" }));
    await waitFor(() => expect(calls("PUT", "/me/lists/1/items/order")).toHaveLength(1));
    expect(JSON.parse(String(calls("PUT", "/me/lists/1/items/order")[0][1]?.body))).toEqual({ songDifficultyIds: [102, 101, 103] });
  });

  it("편집 모드에서 빼기는 그 채보만 DELETE한다", async () => {
    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    fireEvent.click(screen.getByRole("button", { name: "곡2 리스트에서 빼기" }));
    await waitFor(() => expect(calls("DELETE", "/me/lists/1/items/102")).toHaveLength(1));
  });

  it("이름 변경은 PATCH, 삭제는 확인 창을 거쳐 DELETE하고 목록으로 돌아간다", async () => {
    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "편집" }));

    fireEvent.click(screen.getByRole("button", { name: "이름 변경" }));
    fireEvent.change(screen.getByLabelText("리스트 이름"), { target: { value: "바뀐 이름" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(calls("PATCH", "/me/lists/1")).toHaveLength(1));
    expect(JSON.parse(String(calls("PATCH", "/me/lists/1")[0][1]?.body))).toEqual({ name: "바뀐 이름" });

    fireEvent.click(screen.getByRole("button", { name: "리스트 삭제" }));
    expect(calls("DELETE", "/me/lists/1")).toHaveLength(0); // 확인 전에는 지우지 않는다
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("기록은 지워지지 않습니다.");
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(calls("DELETE", "/me/lists/1")).toHaveLength(1));
    expect(await screen.findByRole("button", { name: /새 리스트 만들기/ })).toBeInTheDocument();
  });

  it("편집 모드가 아니면 위/아래·빼기 버튼이 없다", async () => {
    await openDetail();
    expect(screen.queryByRole("button", { name: /위로 옮기기|리스트에서 빼기/ })).not.toBeInTheDocument();
  });

  it("리스트가 없거나 남의 것이면(404) 서버 문구를 그대로 보인다", async () => {
    lists = [summary(1, "연습", 0)];
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (/\/me\/lists\/1(\?|$)/.test(url)) return Promise.resolve(json({ code: "NOT_FOUND", message: "찾을 수 없습니다." }, 404));
      if (url.includes("/me/lists")) return Promise.resolve(json(page(lists)));
      return Promise.resolve(json({}));
    });
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: "연습 열기" }));
    expect(await screen.findByText("찾을 수 없습니다.")).toBeInTheDocument();
  });

  it("`+ 곡 추가`로 검색한 곡의 `담기`는 이 리스트에 바로 POST한다 (이미 담긴 곡은 막힌다)", async () => {
    await openDetail();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (/\/me\/lists\/1\/items$/.test(url) && method === "POST") return Promise.resolve(json({ alreadyContained: false, itemCount: 4 }, 201));
      if (url.includes("/songs/charts")) {
        return Promise.resolve(
          json(page([
            { songDifficultyId: 101, songId: 201, title: "곡1", part: "GUITAR", difficulty: "MASTER", level: 9.5 },
            { songDifficultyId: 190, songId: 290, title: "새곡", part: "BASS", difficulty: "EXTREME", level: 8.5 },
          ])),
        );
      }
      if (/\/me\/lists\/1(\?|$)/.test(url)) return Promise.resolve(json(detail));
      return Promise.resolve(json(page([])));
    });
    fireEvent.click(screen.getByRole("button", { name: /곡 추가/ }));
    const box = await screen.findByRole("searchbox");
    fireEvent.change(box, { target: { value: "곡" } });
    fireEvent.keyDown(box, { key: "Enter" });

    const results = await screen.findByRole("list", { name: "검색 결과" });
    const rows = within(results).getAllByRole("listitem");
    expect(within(rows[0]).getByRole("button")).toBeDisabled(); // 곡1(101)은 이미 담겨 있다
    fireEvent.click(within(rows[1]).getByRole("button", { name: "담기" }));
    await waitFor(() => expect(calls("POST", "/me/lists/1/items")).toHaveLength(1));
    expect(JSON.parse(String(calls("POST", "/me/lists/1/items")[0][1]?.body))).toEqual({ songDifficultyId: 190 });
  });
});
