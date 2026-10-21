import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecordForm, type RecordChart } from "@/components/record/RecordForm";

const chart: RecordChart = { songDifficultyId: 42, title: "테스트곡", part: "GUITAR", difficulty: "MASTER", level: 9.5 };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("RecordForm", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  let client: QueryClient;

  beforeEach(() => {
    fetchMock.mockReset();
    onSaved.mockReset();
    onCancel.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderForm(target: RecordChart = chart) {
    return render(
      <QueryClientProvider client={client}>
        <RecordForm chart={target} onSaved={onSaved} onCancel={onCancel} />
      </QueryClientProvider>,
    );
  }
  const rateInput = () => screen.getByLabelText("달성률");

  it("달성률을 입력하면 달성 표시를 미리 보여 준다", () => {
    renderForm();
    expect(screen.queryByLabelText(/달성 단계/)).toBeNull();
    fireEvent.change(rateInput(), { target: { value: "9650" } });
    expect(screen.getByLabelText("달성 단계 SS")).toBeInTheDocument();
    fireEvent.change(rateInput(), { target: { value: "7999" } });
    expect(screen.getByLabelText("달성 단계 A")).toBeInTheDocument();
    fireEvent.change(rateInput(), { target: { value: "6299" } });
    expect(screen.getByLabelText("달성 단계 C")).toBeInTheDocument();
  });

  it("레이팅 상수 난이도가 있으면 달성률을 입력하는 동안 점수를 바로 계산해 티어 색으로 보여 준다", () => {
    renderForm({ ...chart, tier: 6.0 }); // R=15
    expect(screen.getByText(/예상 점수/)).toHaveTextContent("레이팅 상수 난이도 6.0");
    expect(screen.queryByText("304.00")).toBeNull(); // 아직 입력 전: 점수 대신 –

    fireEvent.change(rateInput(), { target: { value: "9500" } });
    const top = screen.getByText("304.00"); // 15×0.8 + 3.2 = 15.2, ×20
    expect(top).toHaveAttribute("data-tier", "HSB"); // 304는 275 이상

    fireEvent.change(rateInput(), { target: { value: "8000" } });
    expect(screen.getByText("240.00")).toHaveAttribute("data-tier", "IRIDESCENT"); // 237.5 이상 250 미만

    fireEvent.change(rateInput(), { target: { value: "5000" } }); // 15×0.5×20 = 150 -> Red
    const low = screen.getByText("150.00");
    expect(low).toHaveAttribute("data-tier", "RED");
  });

  it("달성률이 범위 밖이면 점수를 계산하지 않고, 레이팅 상수 난이도가 없으면 점수 칸을 그리지 않는다", () => {
    const first = renderForm({ ...chart, tier: 6.0 });
    fireEvent.change(rateInput(), { target: { value: "10001" } });
    expect(screen.queryByText(/^\d+\.\d\d$/)).toBeNull();
    first.unmount();

    renderForm({ ...chart, tier: null });
    fireEvent.change(rateInput(), { target: { value: "9500" } });
    expect(screen.queryByText(/예상 점수/)).toBeNull();
  });

  it("풀콤보를 체크하면 FC, 달성률 100.00이면 EXC로 보이고 풀콤보가 자동으로 켜진다", () => {
    renderForm();
    fireEvent.change(rateInput(), { target: { value: "9700" } });
    fireEvent.click(screen.getByLabelText("Full Combo"));
    expect(screen.getByLabelText("달성 단계 FC")).toBeInTheDocument();

    fireEvent.change(rateInput(), { target: { value: "10000" } });
    expect(screen.getByLabelText("달성 단계 EXC")).toBeInTheDocument();
    const fc = screen.getByLabelText("Full Combo");
    expect(fc).toBeChecked();
    expect(fc).toBeDisabled();
  });

  it("검사에 실패하면 서버에 보내지 않고 입력칸 아래에 문구를 보여 준다", async () => {
    renderForm();
    fireEvent.change(rateInput(), { target: { value: "10001" } });
    fireEvent.click(screen.getByRole("button", { name: "새 기록 등록" }));
    expect(await screen.findByText("달성률은 0 이상 10000 이하여야 합니다.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("소수점·글자는 입력칸에 들어가지 못하고, 입력한 정수가 어떤 달성률로 저장되는지 안내한다", () => {
    renderForm();
    expect(screen.getByText(/소수점은 자동으로 찍힙니다/)).toBeInTheDocument();
    expect(rateInput()).toHaveAttribute("inputmode", "numeric");
    fireEvent.change(rateInput(), { target: { value: "99.7a1" } });
    expect(rateInput()).toHaveValue("9971");
    expect(screen.getByText("달성률 99.71(으)로 저장됩니다")).toBeInTheDocument();
    fireEvent.change(rateInput(), { target: { value: "1234567" } }); // 5자리까지만
    expect(rateInput()).toHaveValue("12345");
    fireEvent.change(rateInput(), { target: { value: "10000" } });
    expect(screen.getByText("달성률 MAX(으)로 저장됩니다")).toBeInTheDocument();
  });

  it("비어 있으면 필수 문구를 보여 준다", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "새 기록 등록" }));
    expect(await screen.findByText("달성률은 필수입니다.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("저장하면 SRN+ 기록으로 POST하고 서열표 캐시를 무효화한 뒤 onSaved를 부른다", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 1, stage: "SS" }, 201));
    const invalidate = vi.spyOn(client, "invalidateQueries");
    renderForm();
    fireEvent.change(rateInput(), { target: { value: "9650" } });
    fireEvent.change(screen.getByLabelText("메모 (선택)"), { target: { value: " 메모 " } });
    fireEvent.click(screen.getByRole("button", { name: "새 기록 등록" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/records");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      songDifficultyId: 42,
      noteOption: "SUPER_RANDOM_PLUS",
      achievementRate: 96.5,
      fullCombo: false,
      memo: "메모",
    });
    expect(body.playedAt).toMatch(/Z$/); // UTC 시각으로 보낸다
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["difficulty-tables"] });
  });

  it("서버의 필드 오류는 해당 입력칸 아래에 보여 주고 창은 닫지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        {
          code: "VALIDATION_ERROR",
          message: "입력값을 확인해 주세요.",
          timestamp: "t",
          fieldErrors: { achievementRate: "서버: 달성률을 확인해 주세요." },
        },
        400,
      ),
    );
    renderForm();
    fireEvent.change(rateInput(), { target: { value: "9650" } });
    fireEvent.click(screen.getByRole("button", { name: "새 기록 등록" }));
    expect(await screen.findByText("서버: 달성률을 확인해 주세요.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("필드가 없는 서버 오류는 서버 문구를 그대로 보여 준다", async () => {
    fetchMock.mockResolvedValueOnce(json({ code: "NOT_FOUND", message: "찾을 수 없습니다.", timestamp: "t" }, 404));
    renderForm();
    fireEvent.change(rateInput(), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "새 기록 등록" }));
    expect(await screen.findByText("찾을 수 없습니다.")).toBeInTheDocument();
  });

  it("취소를 누르면 onCancel을 부른다", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("userId가 있으면 입력 중에 예상 레이팅(+점수, 새로 들어가면 NEW)을 보여 준다", async () => {
    const entryOf = (id: number, score: number) => ({ rank: 1, songDifficultyId: id, songId: id, title: "x", score, pattern: "단일", tier: 6 });
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json({
          single: [entryOf(1, 300), entryOf(2, 200)], other: [], singleLimit: 2, otherLimit: 2,
          totalScore: 500, singleScore: 500, otherScore: 0, tier: {}, noteOption: "SUPER_RANDOM_PLUS",
        }),
      ),
    );
    render(
      <QueryClientProvider client={client}>
        <RecordForm chart={{ ...chart, tier: 6.0, pattern: "단일" }} userId={1} onSaved={onSaved} onCancel={onCancel} />
      </QueryClientProvider>,
    );
    fireEvent.change(rateInput(), { target: { value: "9500" } }); // 304.00점 > 맨 아래 200
    expect(await screen.findByText("예상 레이팅 +104.00 · NEW")).toBeInTheDocument();
    fireEvent.change(rateInput(), { target: { value: "5000" } }); // 150점 < 200: 목록에 못 든다
    expect(await screen.findByText(/레이팅 변화 없음 · 아직 레이팅 목록에는 들지 못합니다/)).toBeInTheDocument();
  });
});
