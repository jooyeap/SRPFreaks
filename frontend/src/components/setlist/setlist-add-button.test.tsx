import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { MyRecordCard } from "@/components/song/MyRecordCard";
import { SetlistAddButton } from "@/components/setlist/SetlistAddButton";
import { ChartRow } from "@/components/songs/ChartRow";
import { EntryCard } from "@/components/table/EntryCard";
import { EntryRow, TableHeadRow } from "@/components/table/EntryRow";
import { ToastProvider } from "@/components/Toast";
import type { ChartRowResponse, SetlistItemResponse, TableEntryResponse } from "@/lib/api-types";
import { clearAccessToken } from "@/lib/auth-token";

vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }), usePathname: () => "/table" }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const AUTH = {
  accessToken: "t", tokenType: "Bearer", expiresIn: 900,
  user: { id: 1, email: "a@example.com", nickname: null, role: "USER", createdAt: "2026-10-01T00:00:00Z" },
};

function item(id: number): SetlistItemResponse {
  return {
    id, songDifficultyId: 100 + id, songId: 200 + id, title: `곡${id}`, part: "GUITAR", difficulty: "MASTER",
    level: 9.5, tier: 6.2, pattern: "단일", mine: null, done: false, createdAt: "2026-10-16T05:00:00Z",
  };
}
const pageOf = (content: SetlistItemResponse[]) => ({ content, page: 0, size: 30, totalElements: content.length, totalPages: 1 });

describe("SetlistAddButton (곡 상세의 담기, D49)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let listed: SetlistItemResponse[] = [];
  let loggedIn = true;
  let postResponse: () => Response = () => json(item(9), 201);
  const posts = () => fetchMock.mock.calls.filter(([input, init]) => String(input).includes("/setlist") && init?.method === "POST");

  beforeEach(() => {
    clearAccessToken();
    listed = [];
    loggedIn = true;
    postResponse = () => json(item(9), 201);
    fetchMock.mockReset();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return Promise.resolve(loggedIn ? json(AUTH) : json({ code: "AUTH_FAILED", message: "로그인이 필요합니다." }, 401));
      if (url.includes("/setlist") && init?.method === "POST") return Promise.resolve(postResponse());
      if (url.includes("/setlist")) return Promise.resolve(json(pageOf(listed)));
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
            <SetlistAddButton songDifficultyId={110} title="곡10" />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>,
    );
  }

  it("로그인하지 않았으면 아무것도 그리지 않고 세트리스트도 요청하지 않는다", async () => {
    loggedIn = false;
    renderButton();
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/auth/refresh"))).toBe(true));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/setlist"))).toBe(false);
  });

  it("글자로 `담기`를 보이고, 누르면 그 채보를 POST로 담고 안내한다", async () => {
    renderButton();
    const button = await screen.findByRole("button", { name: "곡10 세트리스트에 담기" });
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).toHaveTextContent("담기");

    fireEvent.click(button);

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(String(posts()[0][1]?.body))).toEqual({ songDifficultyId: 110 });
    expect(await screen.findByText("세트리스트에 담았습니다.")).toBeInTheDocument();
  });

  it("이미 담긴 채보는 체크 아이콘과 `담김` 글자로 막혀 있다", async () => {
    listed = [item(10)]; // songDifficultyId 110
    renderButton();
    const button = await screen.findByRole("button", { name: "곡10 세트리스트에 담김" });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("담김");
    expect(button.querySelector("svg")).not.toBeNull(); // 색이 아니라 모양으로도 구분
    expect(posts()).toHaveLength(0);
  });

  it("30곡이 차 있어도 이미 담긴 채보는 그대로 `담김`으로 보인다", async () => {
    listed = Array.from({ length: 30 }, (_, i) => item(i + 1)); // 곡10은 110이 들어 있어 담김
    renderButton();
    const added = await screen.findByRole("button", { name: "곡10 세트리스트에 담김" });
    expect(added).toBeDisabled();
  });

  it("30곡이 찬 상태에서 담기지 않은 채보의 담기는 막혀 있고 title로 이유를 알려 준다", async () => {
    listed = Array.from({ length: 30 }, (_, i) => item(i + 50));
    renderButton();
    const button = await screen.findByRole("button", { name: "곡10 세트리스트에 담기" });
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute("title", "30곡이 모두 담겨 있습니다. 곡을 빼면 새로 담을 수 있습니다.");
  });

  it("서버가 거절하면(이미 담김 등) 그 문구를 안내한다", async () => {
    postResponse = () => json({ code: "SETLIST_FULL", message: "세트리스트는 30곡까지 담을 수 있습니다." }, 409);
    renderButton();
    const button = await screen.findByRole("button", { name: "곡10 세트리스트에 담기" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByText("세트리스트는 30곡까지 담을 수 있습니다.")).toBeInTheDocument();
  });

  describe("놓이는 곳: 목록 줄에는 없고 곡 상세의 내 기록 카드에만 있다 (D49 변경)", () => {
    const chart: ChartRowResponse = { songDifficultyId: 110, songId: 210, title: "곡10", addedVersion: null, part: "GUITAR", difficulty: "MASTER", level: 9.5, mine: null };
    const entry: TableEntryResponse = {
      entryId: 1, songDifficultyId: 110, songId: 210, title: "곡10", addedVersion: null, part: "GUITAR", difficulty: "MASTER", level: 9.5,
      tierUncertain: false, recommend: null, recommendUncertain: false, pattern: "단일", patternUncertain: false, ratingEnabled: true, mine: null,
    };

    function renderWith(children: React.ReactNode) {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      return render(
        <QueryClientProvider client={client}>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </QueryClientProvider>,
      );
    }

    it("로그인해도 곡 목록 줄과 서열표 줄(표·카드)에는 담기가 없다", async () => {
      renderWith(
        <ul>
          <ChartRow row={chart} />
          <EntryRow entry={entry} />
          <EntryCard entry={entry} />
        </ul>,
      );
      // 로그인 처리(/auth/refresh)가 끝난 뒤에도 버튼이 없어야 하므로 한 번 기다린 뒤 확인한다
      await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/auth/refresh"))).toBe(true));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(screen.queryByRole("button", { name: /세트리스트에 담/ })).not.toBeInTheDocument();
    });

    it("곡 상세의 내 기록 카드에는 로그인했을 때 담기가 있다", async () => {
      renderWith(
        <MyRecordCard
          mine={null}
          best={null}
          chart={{ part: "GUITAR", difficulty: "MASTER", level: 9.5 }}
          emphasizeSrn={false}
          onRecord={() => {}}
          setlistTarget={{ songDifficultyId: 110, title: "곡10" }}
        />,
      );
      expect(await screen.findByRole("button", { name: "곡10 세트리스트에 담기" })).toBeInTheDocument();
    });

    it("곡 상세에서도 비로그인이면 담기가 없다", async () => {
      loggedIn = false;
      renderWith(
        <MyRecordCard
          mine={null}
          best={null}
          chart={{ part: "GUITAR", difficulty: "MASTER", level: 9.5 }}
          emphasizeSrn={false}
          onRecord={() => {}}
          setlistTarget={{ songDifficultyId: 110, title: "곡10" }}
        />,
      );
      await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/auth/refresh"))).toBe(true));
      expect(screen.queryByRole("button", { name: /세트리스트에 담/ })).not.toBeInTheDocument();
    });

    it("서열표 머리 행의 칸 수가 줄의 칸 수와 같다 (열이 어긋나지 않는다)", () => {
      const { container } = render(<TableHeadRow />);
      expect(container.firstElementChild?.children).toHaveLength(9);
    });
  });
});
