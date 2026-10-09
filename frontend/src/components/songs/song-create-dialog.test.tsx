import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SongCreateButton } from "@/components/songs/SongCreateButton";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("SongCreateButton / 곡 등록 창", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let client: QueryClient;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderButton(tableId?: number) {
    return render(
      <QueryClientProvider client={client}>
        <SongCreateButton tableId={tableId ?? null} />
      </QueryClientProvider>,
    );
  }
  const bodyOf = (call: number) => JSON.parse(String(fetchMock.mock.calls[call]?.[1]?.body)) as Record<string, unknown>;
  const urlOf = (call: number) => String(fetchMock.mock.calls[call]?.[0]);

  function open() {
    fireEvent.click(screen.getByRole("button", { name: "곡 등록" }));
  }

  it("버튼을 누르기 전에는 폼이 없고, 누르면 곡 입력 칸이 나온다", () => {
    renderButton();
    expect(screen.queryByLabelText("곡명")).toBeNull();
    open();
    expect(screen.getByLabelText("곡명")).toBeInTheDocument();
    expect(screen.getByLabelText("채보 1 레벨")).toBeInTheDocument();
  });

  it("곡 목록 모드에는 서열표 칸이 없고, 서열표 모드에는 있다", () => {
    const { unmount } = renderButton();
    open();
    expect(screen.queryByLabelText("채보 1 레이팅 상수 난이도")).toBeNull();
    unmount();

    renderButton(3);
    open();
    expect(screen.getByLabelText("채보 1 레이팅 상수 난이도")).toBeInTheDocument();
    expect(screen.getByLabelText("채보 1 추천도")).toBeInTheDocument();
    expect(screen.getByLabelText("채보 1 속성")).toBeInTheDocument();
  });

  it("비워 두고 등록하면 검사 문구가 나오고 서버를 부르지 않는다", async () => {
    renderButton();
    open();
    fireEvent.click(screen.getByRole("button", { name: "등록" }));
    expect(await screen.findByText("곡명을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("레벨을 입력해 주세요.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("같은 파트·난이도 채보를 두 번 넣으면 막는다", async () => {
    renderButton();
    open();
    fireEvent.change(screen.getByLabelText("곡명"), { target: { value: "새 곡" } });
    fireEvent.change(screen.getByLabelText("채보 1 레벨"), { target: { value: "9.5" } });
    fireEvent.click(screen.getByRole("button", { name: "채보 추가" }));
    fireEvent.change(screen.getByLabelText("채보 2 레벨"), { target: { value: "9.6" } });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));
    expect(await screen.findByText("같은 파트·난이도의 채보가 이미 있습니다.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("곡 목록에서 등록하면 곡 → 채보 순서로 보내고 완료 화면을 보여 준다", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 77 }, 201)).mockResolvedValueOnce(json({ id: 501 }, 201));
    renderButton();
    open();
    fireEvent.change(screen.getByLabelText("곡명"), { target: { value: "새 곡" } });
    fireEvent.change(screen.getByLabelText("아티스트"), { target: { value: "누군가" } });
    fireEvent.change(screen.getByLabelText("채보 1 레벨"), { target: { value: "9.55" } });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    expect(await screen.findByText("곡을 등록했습니다.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urlOf(0)).toContain("/songs");
    expect(bodyOf(0)).toMatchObject({ title: "새 곡", artist: "누군가", source: "admin-manual" });
    expect(urlOf(1)).toContain("/songs/77/difficulties");
    expect(bodyOf(1)).toMatchObject({ instrumentPart: "GUITAR", difficultyType: "MASTER", level: 9.55 });
    expect(screen.getByRole("link", { name: "곡 상세 보기" })).toHaveAttribute("href", "/songs/77?from=songs");
  });

  it("서열표 모드에서는 채보를 만든 뒤 서열표에도 추가한다", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: 77 }, 201))
      .mockResolvedValueOnce(json({ id: 501 }, 201))
      .mockResolvedValueOnce(json({}));
    renderButton(3);
    open();
    fireEvent.change(screen.getByLabelText("곡명"), { target: { value: "새 곡" } });
    fireEvent.change(screen.getByLabelText("채보 1 레벨"), { target: { value: "9.5" } });
    fireEvent.change(screen.getByLabelText("채보 1 레이팅 상수 난이도"), { target: { value: "5.8" } });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    expect(await screen.findByText("곡을 등록했습니다.")).toBeInTheDocument();
    expect(urlOf(2)).toContain("/admin/difficulty-tables/3/entries/501");
    expect(bodyOf(2)).toMatchObject({ tierLabel: 5.8 });
  });

  it("채보 저장이 실패하면 폼을 잠그고, 다시 저장하면 곡을 또 만들지 않고 이어 간다", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: 77 }, 201))
      .mockResolvedValueOnce(json({ message: "서버 오류" }, 500))
      .mockResolvedValueOnce(json({ id: 501 }, 201));
    renderButton();
    open();
    fireEvent.change(screen.getByLabelText("곡명"), { target: { value: "새 곡" } });
    fireEvent.change(screen.getByLabelText("채보 1 레벨"), { target: { value: "9.5" } });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    const retry = await screen.findByRole("button", { name: "남은 채보 다시 저장" });
    expect(screen.getByLabelText("곡명")).toBeDisabled();

    fireEvent.click(retry);
    expect(await screen.findByText("곡을 등록했습니다.")).toBeInTheDocument();
    // 곡 1번 + 채보 2번(실패 후 재시도). 곡 생성(POST /songs)은 한 번뿐이다.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(urlOf(2)).toContain("/songs/77/difficulties");
  });
});
