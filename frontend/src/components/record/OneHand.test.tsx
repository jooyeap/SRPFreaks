import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { RecordDialog } from "@/components/record/RecordDialog";
import { RecordForm, type RecordChart } from "@/components/record/RecordForm";
import { ToastProvider } from "@/components/Toast";
import { clearAccessToken } from "@/lib/auth-token";
import { resetOneHandModeForTest, setOneHandMode } from "@/lib/one-hand";

const chart: RecordChart = { songDifficultyId: 42, title: "테스트곡", part: "GUITAR", difficulty: "MASTER", level: 9.5 };
const next: RecordChart = { songDifficultyId: 43, title: "다음곡", part: "BASS", difficulty: "EXTREME", level: 8.0 };
const AUTH = {
  accessToken: "t",
  tokenType: "Bearer",
  expiresIn: 900,
  user: { id: 1, email: "a@example.com", nickname: null, role: "USER", createdAt: "2026-10-01T00:00:00Z" },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("한 손 입력 모드", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const onSaved = vi.fn();
  let client: QueryClient;

  beforeEach(() => {
    clearAccessToken();
    localStorage.clear();
    resetOneHandModeForTest();
    fetchMock.mockReset();
    onSaved.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    resetOneHandModeForTest();
  });

  function renderForm() {
    return render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <RecordForm chart={chart} onSaved={onSaved} onCancel={vi.fn()} />
        </ToastProvider>
      </QueryClientProvider>,
    );
  }
  const rate = () => screen.getByLabelText("달성률");
  const press = (...names: string[]) => names.forEach((name) => fireEvent.click(screen.getByRole("button", { name })));

  it("처음에는 꺼져 있어 숫자 패드가 없고 평소 입력칸(십진 키보드)이다", () => {
    renderForm();
    expect(screen.getByRole("button", { name: "한 손 모드" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("group", { name: "한 손 입력" })).toBeNull();
    expect(rate()).not.toHaveAttribute("readonly");
    expect(rate()).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByLabelText("Full Combo")).toBeInTheDocument(); // 평소 체크박스
  });

  it("켜면 숫자 패드가 나오고 달성률 칸은 화면 키보드 없이 읽기 전용이 된다", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "한 손 모드" }));
    expect(screen.getByRole("button", { name: "한 손 모드" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("group", { name: "한 손 입력" })).toBeInTheDocument();
    expect(rate()).toHaveAttribute("readonly");
    expect(rate()).toHaveAttribute("inputmode", "none");
    expect(screen.queryByLabelText("Full Combo")).toBeNull(); // 체크박스 대신 패드의 큰 버튼
    expect(localStorage.getItem("srp.oneHandMode")).toBe("1"); // 이 기기에 기억한다
  });

  it("패드를 눌러 정수로 달성률을 만들고 달성 표시를 바로 보여 준다 (9 6 5 0 → 9650 = 96.50, SS)", () => {
    setOneHandMode(true);
    renderForm();
    press("9", "6", "5", "0");
    expect(rate()).toHaveValue("9650");
    expect(screen.getByLabelText("달성 단계 SS")).toBeInTheDocument();
    expect(screen.getByText("달성률 96.50(으)로 저장됩니다")).toBeInTheDocument();
    press("한 글자 지우기");
    expect(rate()).toHaveValue("965");
  });

  it("패드에는 소수점 키가 없고, 10000을 넘는 입력은 막는다", () => {
    setOneHandMode(true);
    renderForm();
    expect(screen.queryByRole("button", { name: "소수점" })).toBeNull();
    press("1", "0", "0", "0", "1");
    expect(rate()).toHaveValue("1000");
  });

  it("풀콤보 큰 버튼은 켜짐/꺼짐을 글자로 보이고, 달성률 100.00이면 켜진 채 잠긴다", () => {
    setOneHandMode(true);
    renderForm();
    const fc = screen.getByRole("button", { name: /Full Combo/ });
    expect(fc).toHaveAttribute("aria-pressed", "false");
    expect(fc).toHaveTextContent("꺼짐");
    fireEvent.click(fc);
    expect(fc).toHaveAttribute("aria-pressed", "true");
    expect(fc).toHaveTextContent("켜짐");
    fireEvent.click(fc);
    expect(fc).toHaveAttribute("aria-pressed", "false");
    press("1", "0", "0", "00");
    expect(rate()).toHaveValue("10000");
    expect(fc).toBeDisabled();
    expect(fc).toHaveAttribute("aria-pressed", "true");
  });

  it("날짜·메모는 접혀 있어도 폼에 있어서 저장 요청에 담긴다 (패드로 입력한 값 + FC)", async () => {
    setOneHandMode(true);
    fetchMock.mockResolvedValueOnce(json({ id: 1, stage: "FC" }, 201));
    const { container } = renderForm();
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    press("9", "7", "2", "5");
    fireEvent.click(screen.getByRole("button", { name: /Full Combo/ }));
    fireEvent.click(screen.getByRole("button", { name: "새 기록 등록" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ songDifficultyId: 42, achievementRate: 97.25, fullCombo: true });
  });

  describe("저장 뒤 다음 곡으로 (RecordDialog)", () => {
    function renderDialog(nextChartAfterSave?: (saved: RecordChart) => RecordChart | null) {
      const onClose = vi.fn();
      fetchMock.mockImplementation((input, init) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) return Promise.resolve(json(AUTH));
        if (url.includes("/records?")) return Promise.resolve(json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
        if (init?.method === "POST") return Promise.resolve(json({ id: 9, stage: "SS" }, 201));
        return Promise.resolve(json({}));
      });
      render(
        <QueryClientProvider client={client}>
          <AuthProvider>
            <ToastProvider>
              <RecordDialog chart={chart} onClose={onClose} nextChartAfterSave={nextChartAfterSave} />
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>,
      );
      return onClose;
    }

    async function saveWith(value: string) {
      // 로그인 복구 전에는 폼이 잠깐 그려졌다가, 로그인 뒤 기록을 불러오는 동안 사라진다. 기록 요청이 끝나 폼이 다시 그려질 때까지 기다린다
      await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/records?"))).toBe(true));
      await waitFor(() => expect(screen.queryByText("불러오는 중입니다.")).toBeNull());
      fireEvent.change(await screen.findByLabelText("달성률"), { target: { value } });
      fireEvent.click(screen.getByRole("button", { name: "새 기록 등록" }));
    }

    it("다음 곡을 돌려주면 창을 닫지 않고 그 곡의 기록 입력으로 바뀐다", async () => {
      const nextChartAfterSave = vi.fn(() => next);
      const onClose = renderDialog(nextChartAfterSave);
      await saveWith("9650");
      await waitFor(() => expect(nextChartAfterSave).toHaveBeenCalledWith(expect.objectContaining({ songDifficultyId: 42 })));
      const dialog = screen.getByRole("dialog", { hidden: true });
      expect(await within(dialog).findByText("다음곡")).toBeInTheDocument();
      expect(within(dialog).queryByText("테스트곡")).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
      expect(await screen.findByLabelText("달성률")).toHaveValue(""); // 새 곡의 빈 입력
    });

    it("null을 돌려주면 평소처럼 창을 닫는다", async () => {
      const onClose = renderDialog(() => null);
      await saveWith("9650");
      await screen.findByRole("group", { name: "저장 결과" }); // 저장하면 닫지 않고 결과 카드를 보여 준다
      fireEvent.click(screen.getByRole("button", { name: "다음 곡 입력" }));
      expect(onClose).toHaveBeenCalled();
    });

    it("함수를 주지 않으면(다른 화면) 평소처럼 창을 닫는다", async () => {
      const onClose = renderDialog(undefined);
      await saveWith("9650");
      await screen.findByRole("group", { name: "저장 결과" }); // 저장하면 닫지 않고 결과 카드를 보여 준다
      fireEvent.click(screen.getByRole("button", { name: "다음 곡 입력" }));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
