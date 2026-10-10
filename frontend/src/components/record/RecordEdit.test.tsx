import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { RecordDialog } from "@/components/record/RecordDialog";
import type { RecordChart } from "@/components/record/RecordForm";
import { clearAccessToken } from "@/lib/auth-token";
import type { RecordResponse } from "@/lib/records";

const chart: RecordChart = { songDifficultyId: 42, title: "테스트곡", part: "GUITAR", difficulty: "MASTER", level: 9.5 };
const AUTH = {
  accessToken: "t",
  tokenType: "Bearer",
  expiresIn: 900,
  user: { id: 1, email: "a@example.com", nickname: null, role: "USER", createdAt: "2026-10-01T00:00:00Z" },
};
const saved: RecordResponse = {
  id: 7,
  songDifficultyId: 42,
  songId: 1,
  title: "테스트곡",
  part: "GUITAR",
  difficulty: "MASTER",
  level: 9.5,
  noteOption: "SUPER_RANDOM_PLUS",
  achievementRate: 91.25,
  fullCombo: false,
  stage: "S",
  playedAt: "2026-10-04T15:00:00Z", // 서울 2026-10-05
  platform: null,
  memo: "예전 메모",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("기록 수정 / 삭제", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const onClose = vi.fn();
  let client: QueryClient;

  beforeEach(() => {
    clearAccessToken();
    fetchMock.mockReset();
    onClose.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    // 경로별 기본 응답: 시작 복구(refresh), 내 기록 목록
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return Promise.resolve(json(AUTH));
      if (url.includes("/records?")) {
        return Promise.resolve(json({ content: [saved], page: 0, size: 20, totalElements: 1, totalPages: 1 }));
      }
      if (init?.method === "PUT") return Promise.resolve(json({ ...saved, achievementRate: 95 }));
      if (init?.method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(json({}, 404));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderDialog() {
    return render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <RecordDialog chart={chart} onClose={onClose} />
        </AuthProvider>
      </QueryClientProvider>,
    );
  }
  // 기록이 있으면 창이 가장 높은 기록의 수정 화면으로 바로 열린다
  async function openEdit() {
    await screen.findByRole("heading", { name: "기록 수정" });
    await screen.findByLabelText("달성률");
  }
  const callsOf = (method: string) => fetchMock.mock.calls.filter((c) => c[1]?.method === method);

  it("기록이 있으면 가장 높은 기록의 수정 화면으로 바로 열리고 폼이 기록 값으로 채워진다", async () => {
    renderDialog();
    expect(await screen.findByRole("heading", { name: "이 채보의 내 기록" })).toBeInTheDocument();
    await openEdit();
    expect(screen.getByLabelText("달성률")).toHaveValue("91.25");
    expect(screen.getByLabelText("플레이 날짜")).toHaveValue("2026-10-05");
    expect(screen.getByLabelText("메모 (선택)")).toHaveValue("예전 메모");
    expect(screen.getAllByLabelText("달성 단계 S")).toHaveLength(2); // 기록 목록 줄 + 폼의 달성 표시 미리보기
    expect(screen.getByRole("button", { name: "이 기록 삭제" })).toBeInTheDocument();
  });

  it("가장 높은 기록이 여러 개 중에서 골라진다 (낮은 기록은 목록의 수정으로 고친다)", async () => {
    const low: RecordResponse = { ...saved, id: 8, achievementRate: 80 };
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return Promise.resolve(json(AUTH));
      if (url.includes("/records?")) {
        return Promise.resolve(json({ content: [low, saved], page: 0, size: 20, totalElements: 2, totalPages: 1 }));
      }
      return Promise.resolve(json({}, 404));
    });
    renderDialog();
    await openEdit();
    expect(screen.getByLabelText("달성률")).toHaveValue("91.25"); // 목록 앞(더 최근)이 80이어도 최고 기록이 열린다
    fireEvent.click(screen.getByRole("button", { name: "80.00 기록 수정" }));
    await waitFor(() => expect(screen.getByLabelText("달성률")).toHaveValue("80.00"));
  });

  it("낮은 값으로도 수정할 수 있다 (PUT)", async () => {
    renderDialog();
    await openEdit();
    fireEvent.change(screen.getByLabelText("달성률"), { target: { value: "50.5" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(JSON.parse(String(callsOf("PUT")[0][1]?.body))).toMatchObject({ achievementRate: 50.5 });
  });

  it("`새 기록 추가`를 누르면 빈 등록 폼으로 바뀌고, `기존 기록 수정`으로 돌아간다", async () => {
    renderDialog();
    await openEdit();
    fireEvent.click(screen.getByRole("button", { name: "새 기록 추가" }));
    expect(await screen.findByRole("heading", { name: "기록 등록" })).toBeInTheDocument();
    expect(screen.getByLabelText("달성률")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "기존 기록 수정" }));
    expect(await screen.findByRole("heading", { name: "기록 수정" })).toBeInTheDocument();
    expect(screen.getByLabelText("달성률")).toHaveValue("91.25");
  });

  it("입력한 값이 있으면 창 바깥을 눌러도 닫히지 않고, 달성률 칸에 커서가 있다", async () => {
    renderDialog();
    await openEdit();
    expect(screen.getByLabelText("달성률")).toHaveFocus();
    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent.click(dialog); // 바깥(::backdrop) 클릭은 dialog 자신이 target이다. 아직 값이 같으니 닫힌다
    expect(onClose).toHaveBeenCalledTimes(1);
    onClose.mockClear();
    fireEvent.change(screen.getByLabelText("달성률"), { target: { value: "95" } });
    fireEvent.click(dialog);
    await waitFor(() => expect(onClose).not.toHaveBeenCalled());
  });

  it("저장하면 PUT /records/{id}로 보내고 창을 닫는다", async () => {
    renderDialog();
    await openEdit();
    fireEvent.change(screen.getByLabelText("달성률"), { target: { value: "95" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [url, init] = callsOf("PUT")[0];
    expect(url).toBe("/api/v1/records/7");
    expect(JSON.parse(String(init?.body))).toMatchObject({ achievementRate: 95, noteOption: "SUPER_RANDOM_PLUS" });
  });

  it("삭제는 한 번 더 확인한 뒤에만 DELETE를 보낸다", async () => {
    renderDialog();
    await openEdit();
    fireEvent.click(screen.getByRole("button", { name: "이 기록 삭제" }));
    expect(callsOf("DELETE")).toHaveLength(0);
    const confirm = screen.getByRole("dialog", { name: "기록 삭제" });
    expect(within(confirm).getByText("이 기록을 삭제할까요? 되돌릴 수 없습니다.")).toBeInTheDocument();

    fireEvent.click(within(confirm).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(callsOf("DELETE")[0][0]).toBe("/api/v1/records/7");
  });

  it("삭제 확인에서 취소하면 아무것도 지우지 않는다", async () => {
    renderDialog();
    await openEdit();
    fireEvent.click(screen.getByRole("button", { name: "이 기록 삭제" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "기록 삭제" })).getByRole("button", { name: "취소" }));
    expect(callsOf("DELETE")).toHaveLength(0);
    expect(screen.queryByRole("dialog", { name: "기록 삭제" })).toBeNull();
    expect(screen.getByRole("button", { name: "이 기록 삭제" })).toBeInTheDocument();
  });

  it("삭제가 서버 오류로 실패하면 문구를 보여 주고 창을 닫지 않는다", async () => {
    renderDialog();
    await openEdit();
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(
        init?.method === "DELETE" ? json({ code: "NOT_FOUND", message: "찾을 수 없습니다.", timestamp: "t" }, 404) : json({}),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "이 기록 삭제" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "기록 삭제" })).getByRole("button", { name: "삭제" }));
    expect(await screen.findByText("찾을 수 없습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "기록 삭제" })).toBeNull(); // 확인 창은 닫혀서 오류 문구가 가려지지 않는다
    expect(onClose).not.toHaveBeenCalled();
  });
});
