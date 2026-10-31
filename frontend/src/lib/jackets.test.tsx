import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SongJacket } from "@/components/SongJacket";
import { JACKET_STORAGE_KEY, resetShowJacketsForTest, setJacketData, setShowJackets, useJackets, useJacketsLoader } from "@/lib/jackets";

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function Probe({ songId }: { songId: number }) {
  useJacketsLoader();
  const j = useJackets();
  return <p>{j.visible ? `on:${j.urlOf(songId) ?? "none"}` : "off"}</p>;
}

function renderProbe(songId: number) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Probe songId={songId} />
    </QueryClientProvider>,
  );
}

describe("재킷 표시 (D54)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    localStorage.clear();
    resetShowJacketsForTest();
    act(() => setJacketData(null));
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("운영 설정이 켜져 있고 개인 설정이 기본(켜짐)이면 곡 id로 주소를 찾고, 없는 곡은 빈 칸이다", async () => {
    fetchMock.mockResolvedValue(json({ enabled: true, jackets: { "3": "/jackets/3.webp?v=1" } }));
    renderProbe(3);
    expect(await screen.findByText("on:/jackets/3.webp?v=1")).toBeInTheDocument();
  });

  it("운영 설정이 꺼져 있으면 칸 자체를 그리지 않는다", async () => {
    fetchMock.mockResolvedValue(json({ enabled: false, jackets: {} }));
    renderProbe(3);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByText("off")).toBeInTheDocument();
  });

  it("개인 설정을 끄면 이 기기에 저장되고 칸이 사라진다", async () => {
    fetchMock.mockResolvedValue(json({ enabled: true, jackets: { "4": "/jackets/4.webp" } }));
    renderProbe(5);
    expect(await screen.findByText("on:none")).toBeInTheDocument();
    act(() => setShowJackets(false));
    expect(screen.getByText("off")).toBeInTheDocument();
    expect(localStorage.getItem(JACKET_STORAGE_KEY)).toBe("0");
  });

  it("목록을 받기 전(로더가 없는 화면 조각)에는 칸을 그리지 않고 서버도 부르지 않는다", () => {
    function Bare() {
      return <p>{useJackets().visible ? "on" : "off"}</p>;
    }
    render(<Bare />);
    expect(screen.getByText("off")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("주소가 있으면 곡명 alt를 가진 lazy 이미지를 그린다", () => {
    render(<SongJacket url="/jackets/3.webp" title="Alpha" className="size-8" />);
    const img = screen.getByRole("img", { name: "Alpha" });
    expect(img).toHaveAttribute("src", "/jackets/3.webp");
    expect(img).toHaveAttribute("loading", "lazy");
  });
});
