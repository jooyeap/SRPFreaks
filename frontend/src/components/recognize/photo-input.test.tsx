import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/Toast";
import { PhotoInputView } from "@/components/recognize/PhotoInputView";
import { canSave, parseRate } from "@/components/recognize/PhotoRow";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ status: "authenticated", user: { id: 1, role: "ROOT" } }),
}));
// 브라우저 Canvas 축소는 jsdom에 없어서 그대로 돌려준다(축소 크기 계산은 lib/recognize.test.ts가 본다)
vi.mock("@/lib/recognize", async (orig) => ({
  ...(await orig<typeof import("@/lib/recognize")>()),
  shrinkPhoto: async (file: Blob) => file,
}));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const recognized = {
  title: "Step forward", part: "GUITAR", difficulty: "MASTER", level: 9.65, achievementRate: 92.45,
  fullCombo: false, superRandomPlus: true, songDifficultyId: 70, candidates: [{ songId: 7, title: "Step forward" }], remaining: 29,
};

describe("사진으로 입력 (D55)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let status: unknown;
  beforeEach(() => {
    status = { available: true, reason: null, remaining: 30, weeklyLimit: 30, nextRefillAt: null };
    fetchMock.mockReset();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes("/records/recognize/status")) return Promise.resolve(json(status));
      if (url.includes("/records/recognize")) return Promise.resolve(json(recognized));
      if (url.endsWith("/records") && init?.method === "POST") return Promise.resolve(json({ id: 1 }, 201));
      return Promise.resolve(json({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:photo", revokeObjectURL: () => {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderView = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToastProvider>
          <PhotoInputView />
        </ToastProvider>
      </QueryClientProvider>,
    );

  it("꺼져 있거나 권한이 없으면 안내만 보이고 사진을 고를 수 없다", async () => {
    status = { available: false, reason: "ROLE", remaining: 0, weeklyLimit: 30, nextRefillAt: null };
    renderView();
    expect(await screen.findByText("지금은 사진 입력을 쓸 수 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText(/사진 고르기/)).toBeNull();
  });

  it("사진을 고르면 읽어서 확인 목록을 채우고, 체크한 줄을 SRN+ 기록으로 저장한다", async () => {
    const { container } = renderView();
    expect(await screen.findByText(/이번 주 남은 횟수/)).toHaveTextContent("이번 주 남은 횟수 30/30");
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] } });

    const list = await screen.findByRole("list", { name: "인식 결과 확인 목록" });
    expect(within(list).getAllByText("Step forward").length).toBeGreaterThan(0);
    expect(within(list).getByDisplayValue("92.45")).toBeInTheDocument();
    // 사진은 multipart로 보낸다
    const post = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/records/recognize"));
    expect(post?.[1]?.body).toBeInstanceOf(FormData);

    fireEvent.click(screen.getByRole("button", { name: "체크한 기록 저장 (1)" }));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/records") && c[1]?.method === "POST")).toBe(true));
    const save = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/records") && c[1]?.method === "POST");
    expect(JSON.parse(String(save?.[1]?.body))).toMatchObject({ songDifficultyId: 70, noteOption: "SUPER_RANDOM_PLUS", achievementRate: 92.45, fullCombo: false });
    expect(await within(list).findByText(/저장됨/)).toBeInTheDocument();
  });

  it("SRN+를 확인하지 못한 줄은 사용자가 체크해야 저장할 수 있다", () => {
    const draft = { chart: { songDifficultyId: 1, title: "a", part: "GUITAR" as const, difficulty: "MASTER" as const, level: 9 }, rate: "90", fullCombo: false, srnConfirmed: false, playedDate: "2026-10-28", include: true };
    expect(canSave(draft, true)).toBe(true);
    expect(canSave(draft, null)).toBe(false);
    expect(canSave(draft, false)).toBe(false);
    expect(canSave({ ...draft, srnConfirmed: true }, false)).toBe(true);
    expect(canSave({ ...draft, chart: null }, true)).toBe(false);
  });

  it("달성률 칸은 0.00~100.00과 MAX만 받는다", () => {
    expect(parseRate("92.45")).toBe(92.45);
    expect(parseRate("MAX")).toBe(100);
    expect(parseRate("100")).toBe(100);
    expect(parseRate("0.00")).toBe(0);
    expect(parseRate("100.01")).toBeNull();
    expect(parseRate("-0.01")).toBeNull();
    expect(parseRate("92.455")).toBeNull();   // 소수 셋째 자리
    expect(parseRate("")).toBeNull();
  });
});
