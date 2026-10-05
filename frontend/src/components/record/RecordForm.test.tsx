import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecordForm, type RecordChart } from "@/components/record/RecordForm";

const chart: RecordChart = { songId: 7, songDifficultyId: 42, title: "테스트곡", part: "GUITAR", difficulty: "MASTER", level: 9.5 };

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

  function renderForm() {
    return render(
      <QueryClientProvider client={client}>
        <RecordForm chart={chart} onSaved={onSaved} onCancel={onCancel} />
      </QueryClientProvider>,
    );
  }
  const rateInput = () => screen.getByLabelText("달성률");

  it("달성률을 입력하면 달성 표시를 미리 보여 준다", () => {
    renderForm();
    expect(screen.queryByLabelText(/달성 단계/)).toBeNull();
    fireEvent.change(rateInput(), { target: { value: "96.5" } });
    expect(screen.getByLabelText("달성 단계 SS")).toBeInTheDocument();
    fireEvent.change(rateInput(), { target: { value: "79.99" } });
    expect(screen.getByLabelText("달성 단계 A")).toBeInTheDocument();
    fireEvent.change(rateInput(), { target: { value: "62.99" } });
    expect(screen.getByLabelText("달성 단계 C")).toBeInTheDocument();
  });

  it("풀콤보를 체크하면 FC, 달성률 100.00이면 EXC로 보이고 풀콤보가 자동으로 켜진다", () => {
    renderForm();
    fireEvent.change(rateInput(), { target: { value: "97" } });
    fireEvent.click(screen.getByLabelText("풀콤보(0 miss)"));
    expect(screen.getByLabelText("달성 단계 FC")).toBeInTheDocument();

    fireEvent.change(rateInput(), { target: { value: "100" } });
    expect(screen.getByLabelText("달성 단계 EXC")).toBeInTheDocument();
    const fc = screen.getByLabelText("풀콤보(0 miss)");
    expect(fc).toBeChecked();
    expect(fc).toBeDisabled();
  });

  it("검사에 실패하면 서버에 보내지 않고 입력칸 아래에 문구를 보여 준다", async () => {
    renderForm();
    fireEvent.change(rateInput(), { target: { value: "100.01" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("달성률은 0.00 이상 100.00 이하여야 합니다.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("비어 있으면 필수 문구를 보여 준다", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("달성률은 필수입니다.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("저장하면 SRN+ 기록으로 POST하고 서열표 캐시를 무효화한 뒤 onSaved를 부른다", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 1, stage: "SS" }, 201));
    const invalidate = vi.spyOn(client, "invalidateQueries");
    renderForm();
    fireEvent.change(rateInput(), { target: { value: "96.5" } });
    fireEvent.change(screen.getByLabelText("메모 (선택)"), { target: { value: " 메모 " } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

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
    fireEvent.change(rateInput(), { target: { value: "96.5" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("서버: 달성률을 확인해 주세요.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("필드가 없는 서버 오류는 서버 문구를 그대로 보여 준다", async () => {
    fetchMock.mockResolvedValueOnce(json({ code: "NOT_FOUND", message: "찾을 수 없습니다.", timestamp: "t" }, 404));
    renderForm();
    fireEvent.change(rateInput(), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("찾을 수 없습니다.")).toBeInTheDocument();
  });

  it("취소를 누르면 onCancel을 부른다", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
