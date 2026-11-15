import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminGate } from "@/components/admin/AdminGate";
import { AuditLogView } from "@/components/admin/AuditLogView";
import { AuthProvider } from "@/components/AuthProvider";
import type { AuditLogResponse, PageResponse } from "@/lib/api-types";
import { clearAccessToken } from "@/lib/auth-token";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }), usePathname: () => "/admin" }));
vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function log(id: number, over: Partial<AuditLogResponse> = {}): AuditLogResponse {
  return {
    id,
    actorId: 5,
    actorNickname: "ルート",
    action: "SONG_CREATE",
    targetType: "SONG",
    targetId: "7",
    detail: { title: "새 곡" },
    createdAt: "2026-10-08T00:00:00Z",
    ...over,
  };
}

function page(content: AuditLogResponse[], p = 0, totalPages = 1): PageResponse<AuditLogResponse> {
  return { content, page: p, size: 30, totalElements: content.length, totalPages };
}

describe("감사 로그 화면", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    clearAccessToken();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  // 작업 종류 선택지에도 "곡 등록" 같은 글자가 있어서, 로그 목록 안에서만 찾는다
  const inList = async () => within(await screen.findByRole("list", { name: "감사 로그" }));

  const renderView = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuditLogView viewerId={1} />
      </QueryClientProvider>,
    );

  it("작업 이름, 사람, 대상, 세부 내용을 보여 준다", async () => {
    fetchMock.mockResolvedValueOnce(json(page([log(2), log(1, { actorId: null, actorNickname: null, action: "SOMETHING_NEW", detail: null })])));
    renderView();
    expect((await inList()).getByText("곡 등록")).toBeInTheDocument();
    expect(screen.getByText(/ルート/)).toBeInTheDocument();
    // 세부 내용은 JSON 대신 읽기 쉬운 글자로, 시각은 서울 시각까지(UTC 00:00 = 09:00)
    expect(screen.getByText("제목: 새 곡")).toHaveAttribute("title", '{"title":"새 곡"}');
    expect(screen.getAllByText("2026-10-08 09:00").length).toBeGreaterThan(0);
    expect(screen.getByText("SOMETHING_NEW")).toBeInTheDocument(); // 모르는 종류는 그대로
    expect(screen.getByText(/탈퇴한 사용자/)).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/admin/audit-logs");
  });

  it("기록이 없으면 안내 문구, 서버 오류면 오류 문구", async () => {
    fetchMock.mockResolvedValueOnce(json(page([])));
    const { unmount } = renderView();
    expect(await screen.findByText("아직 기록이 없습니다.")).toBeInTheDocument();
    unmount();

    fetchMock.mockResolvedValueOnce(json({ code: "FORBIDDEN", message: "권한이 없습니다." }, 403));
    renderView();
    expect(await screen.findByRole("alert")).toHaveTextContent("권한이 없습니다.");
  });

  it("다음 버튼으로 다음 페이지를 요청한다", async () => {
    fetchMock.mockResolvedValueOnce(json(page([log(2)], 0, 2))).mockResolvedValueOnce(json(page([log(1)], 1, 2)));
    renderView();
    await inList();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(await screen.findByText("2 / 2")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("page=1");
  });

  const urlParams = (i: number) => new URL(String(fetchMock.mock.calls[i]?.[0]), "http://x").searchParams;

  it("처음에는 조건 없이 요청한다", async () => {
    fetchMock.mockResolvedValueOnce(json(page([log(1)])));
    renderView();
    await inList();
    expect(urlParams(0).has("action")).toBe(false);
    expect(urlParams(0).has("q")).toBe(false);
    expect(screen.queryByRole("button", { name: "초기화" })).toBeNull();
  });

  const chip = (name: string) => screen.getByRole("button", { name });
  const mixed = () => [
    log(5, { actorId: 5, action: "SETTING_UPDATE", targetType: "SETTING", targetId: "rating.pivot", detail: null }),
    log(4, { actorId: 7, actorNickname: "ユーザー7", action: "USER_BLOCK", targetType: "USER", targetId: "9", detail: null }),
    log(3, { actorId: 5, action: "TABLE_ENTRY_UPDATE", targetType: "ENTRY", targetId: "3", detail: null }),
    log(2, { actorId: 5, action: "DIFFICULTY_UPDATE", targetType: "DIFFICULTY", targetId: "8", detail: null }),
    log(1, { actorId: 8, actorNickname: "ユーザー8", action: "NOTICE_CREATE", targetType: "NOTICE", targetId: "1", detail: null }),
  ];

  it("종류 칩은 전체·곡·채보·서열표·사용자·설정이고 처음에는 전체가 눌려 있다", async () => {
    fetchMock.mockResolvedValueOnce(json(page([log(1)])));
    renderView();
    await inList();
    for (const name of ["전체", "곡·채보", "서열표", "사용자", "설정"]) {
      expect(chip(name)).toBeInTheDocument();
    }
    expect(chip("전체")).toHaveAttribute("aria-pressed", "true");
    expect(chip("설정")).toHaveAttribute("aria-pressed", "false");
  });

  it("종류 칩은 새 요청 없이 받아 온 로그 안에서 거르고, 어느 칩에도 없는 작업은 전체에서만 보인다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(mixed())));
    renderView();
    const list = await inList();
    expect(list.getByText("공지 등록")).toBeInTheDocument(); // 공지는 어느 칩에도 속하지 않는다

    fireEvent.click(chip("설정"));
    expect(chip("설정")).toHaveAttribute("aria-pressed", "true");
    expect(chip("전체")).toHaveAttribute("aria-pressed", "false");
    expect(list.getByText("설정 변경")).toBeInTheDocument();
    expect(list.queryByText("계정 차단")).toBeNull();
    expect(list.queryByText("공지 등록")).toBeNull();

    fireEvent.click(chip("사용자"));
    expect(list.getByText("계정 차단")).toBeInTheDocument();
    expect(list.queryByText("설정 변경")).toBeNull();

    fireEvent.click(chip("전체"));
    expect(list.getByText("공지 등록")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // 칩만으로는 요청하지 않는다
    expect(urlParams(0).has("action")).toBe(false);
  });

  it("칩으로 거른 결과가 없으면 검색 결과 없음 문구, 초기화하면 전체로 돌아온다", async () => {
    fetchMock.mockResolvedValueOnce(json(page([log(1)])));
    renderView();
    await inList();
    fireEvent.click(chip("설정"));
    expect(await screen.findByText("검색 결과가 없습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect((await inList()).getByText("곡 등록")).toBeInTheDocument();
    expect(chip("전체")).toHaveAttribute("aria-pressed", "true");
  });

  it("같은 사람의 연속 작업은 묶음으로 접혀 있고, 누르면 펼쳐서 항목 문구를 그대로 보여 준다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(mixed())));
    renderView();
    const list = await inList();
    // 5(ルート 설정) / 4(다른 사람) / 3·2(ルート 연속) / 1(또 다른 사람) → 3·2가 한 묶음. 종류는 서열표·곡·채보
    const header = list.getByRole("button", { name: /서열표·곡·채보 작업 2건/ });
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(list.queryByText("서열표 값 수정")).toBeNull();
    expect(list.getByText("설정 변경")).toBeInTheDocument(); // 혼자인 작업은 묶지 않는다
    expect(list.getByText("계정 차단")).toBeInTheDocument();

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(list.getByText("서열표 값 수정")).toBeInTheDocument();
    expect(list.getByText("채보 수정")).toBeInTheDocument();

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(list.queryByText("서열표 값 수정")).toBeNull();
  });

  it("어느 칩에도 속하지 않는 작업만 이어지면 묶음 이름에 기타가 붙는다", async () => {
    fetchMock.mockResolvedValueOnce(
      json(page([log(2, { action: "NOTICE_UPDATE", detail: null }), log(1, { action: "NOTICE_CREATE", detail: null })])),
    );
    renderView();
    expect(await screen.findByRole("button", { name: /기타 작업 2건/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("탈퇴한 사용자(작업한 사람 없음)의 연속 작업은 누구인지 몰라 묶지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(
      json(page([log(3, { actorId: null, actorNickname: null }), log(2, { actorId: null, actorNickname: null }), log(1, { actorId: null, actorNickname: null })])),
    );
    renderView();
    const list = await inList();
    expect(list.queryByRole("button", { name: /작업 \d+건/ })).toBeNull();
    expect(list.getAllByText("곡 등록")).toHaveLength(3);
  });

  it("날짜(서울 시각 기준)별로 나누어 날짜 머리를 보여 준다", async () => {
    fetchMock.mockResolvedValueOnce(
      json(page([log(3, { actorId: 7, actorNickname: "A", createdAt: "2026-10-09T15:30:00Z" }), log(2, { actorId: 8, actorNickname: "B", createdAt: "2026-10-09T14:59:00Z" }), log(1, { actorId: 9, actorNickname: "C", createdAt: "2026-10-08T00:00:00Z" })])),
    );
    renderView();
    const list = await inList();
    // UTC 15:30은 서울로 다음 날 00:30이라 10-10, UTC 14:59는 10-09 23:59
    expect(list.getByRole("heading", { name: "2026-10-10" })).toBeInTheDocument();
    expect(list.getByRole("heading", { name: "2026-10-09" })).toBeInTheDocument();
    expect(list.getByRole("heading", { name: "2026-10-08" })).toBeInTheDocument();
  });

  it("검색어는 검색을 눌러야 적용되고, 앞뒤 공백은 뺀다", async () => {
    fetchMock.mockResolvedValue(json(page([log(1)])));
    renderView();
    await inList();
    fireEvent.change(screen.getByRole("searchbox", { name: "닉네임 또는 로그 내용 검색" }), { target: { value: "  ルート " } });
    expect(fetchMock).toHaveBeenCalledTimes(1); // 입력만으로는 요청하지 않는다

    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(urlParams(1).get("q")).toBe("ルート");
  });

  it("조건에 맞는 로그가 없으면 검색 결과 없음 문구, 초기화하면 조건이 풀린다", async () => {
    fetchMock.mockResolvedValueOnce(json(page([log(1)]))).mockResolvedValueOnce(json(page([]))).mockResolvedValueOnce(json(page([log(1)])));
    renderView();
    await inList();
    fireEvent.change(screen.getByRole("searchbox", { name: "닉네임 또는 로그 내용 검색" }), { target: { value: "없는말" } });
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    expect(await screen.findByText("검색 결과가 없습니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect((await inList()).getByText("곡 등록")).toBeInTheDocument();
    expect(urlParams(2).has("q")).toBe(false);
    expect(screen.getByRole("searchbox", { name: "닉네임 또는 로그 내용 검색" })).toHaveValue("");
  });
});

describe("AdminGate", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    clearAccessToken();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const login = (role: string) =>
    fetchMock.mockResolvedValueOnce(
      json({
        accessToken: "t",
        tokenType: "Bearer",
        expiresIn: 900,
        user: { id: 9, email: "a@example.com", nickname: null, role, createdAt: "2026-10-01T00:00:00Z" },
      }),
    );
  const renderGate = () =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <AdminGate title="관리">{(viewerId) => <p>안쪽 {viewerId}</p>}</AdminGate>
        </AuthProvider>
      </QueryClientProvider>,
    );

  it("ROOT면 안쪽을 보여 주고 보는 사람의 id를 넘긴다", async () => {
    login("ROOT");
    renderGate();
    expect(await screen.findByText("안쪽 9")).toBeInTheDocument();
  });

  it("ADMIN·USER는 권한 없음 문구만 보인다", async () => {
    login("ADMIN");
    renderGate();
    expect(await screen.findByRole("alert")).toHaveTextContent("권한이 없습니다.");
    expect(screen.queryByText(/안쪽/)).toBeNull();
  });

  it("로그인하지 않았으면 로그인 링크", async () => {
    fetchMock.mockResolvedValueOnce(json({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." }, 401));
    renderGate();
    expect(await screen.findByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
  });
});
