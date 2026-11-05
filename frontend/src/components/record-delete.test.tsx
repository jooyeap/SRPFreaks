import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { RecordDeleteProvider, UNDO_WINDOW_MS, useRecordDelete } from "@/components/RecordDeleteProvider";
import { RecordList } from "@/components/record/RecordList";
import { ToastProvider } from "@/components/Toast";
import { clearAccessToken } from "@/lib/auth-token";
import type { RecordResponse } from "@/lib/records";

const AUTH = {
  accessToken: "t",
  tokenType: "Bearer",
  expiresIn: 900,
  user: { id: 1, email: "a@example.com", nickname: null, role: "USER", createdAt: "2026-10-01T00:00:00Z" },
};
const record: RecordResponse = {
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
  playedAt: "2026-10-04T15:00:00Z",
  platform: null,
  memo: null,
  createdAt: "2026-10-05T01:00:00Z",
  updatedAt: "2026-10-05T01:00:00Z",
};
const other: RecordResponse = { ...record, id: 8, achievementRate: 80 };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const page = (content: RecordResponse[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 });

/** 삭제 버튼(기록마다)과 로그아웃 버튼, 그리고 "다른 화면"으로 옮기는 스위치가 있는 시험용 화면 */
function Harness() {
  const [screenName, setScreen] = useState<"a" | "b">("a");
  const { logout } = useAuth();
  const { requestDelete } = useRecordDelete();
  return (
    <div>
      <button onClick={() => setScreen(screenName === "a" ? "b" : "a")}>화면 이동</button>
      <button onClick={() => void logout()}>로그아웃</button>
      {screenName === "a" ? (
        <>
          <button onClick={() => requestDelete(record)}>삭제 7</button>
          <button onClick={() => requestDelete(other)}>삭제 8</button>
          <RecordList songDifficultyId={42} editingId={null} onEdit={() => {}} />
        </>
      ) : (
        <p>다른 화면</p>
      )}
    </div>
  );
}

describe("본인 기록 삭제 되돌리기", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let client: QueryClient;
  let serverRecords: RecordResponse[];
  let deleteStatus: number;

  const deletes = () => fetchMock.mock.calls.filter((c) => c[1]?.method === "DELETE");

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    clearAccessToken();
    fetchMock.mockReset();
    serverRecords = [record, other];
    deleteStatus = 204;
    vi.stubGlobal("fetch", fetchMock);
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return Promise.resolve(json(AUTH));
      if (url.endsWith("/auth/logout")) return Promise.resolve(new Response(null, { status: 204 }));
      if (init?.method === "DELETE") {
        if (deleteStatus === 204) {
          const id = Number(url.split("/").pop());
          serverRecords = serverRecords.filter((r) => r.id !== id);
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        return Promise.resolve(json({ code: "INTERNAL_ERROR", message: "서버 오류", timestamp: "t" }, deleteStatus));
      }
      if (url.includes("/records?")) return Promise.resolve(json(page(serverRecords)));
      return Promise.resolve(json({}, 404));
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  function renderApp() {
    return render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <ToastProvider>
            <RecordDeleteProvider>
              <Harness />
            </RecordDeleteProvider>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>,
    );
  }
  const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
  async function ready() {
    renderApp();
    await screen.findByText("91.25");
  }

  it("삭제를 누르면 목록에서 바로 사라지고, 5초 전에는 서버 호출이 없다. 5초 뒤에 DELETE를 보낸다", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "삭제 7" }));
    expect(screen.queryByText("91.25")).toBeNull();
    expect(screen.getByText("80.00")).toBeInTheDocument(); // 다른 기록은 그대로
    expect(screen.getByRole("status")).toHaveTextContent("기록을 삭제했어요");
    expect(screen.getByRole("button", { name: "되돌리기" })).toBeInTheDocument();
    await advance(UNDO_WINDOW_MS - 100);
    expect(deletes()).toHaveLength(0);
    await advance(200);
    expect(deletes()).toHaveLength(1);
    expect(String(deletes()[0][0])).toBe("/api/v1/records/7");
    await waitFor(() => expect(screen.queryByText("91.25")).toBeNull()); // 확정 뒤 목록을 다시 받아도 없다
  });

  it("관련 쿼리 무효화는 서버가 삭제를 확정한 뒤에 한다", async () => {
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "삭제 7" }));
    await advance(UNDO_WINDOW_MS - 100);
    expect(invalidate).not.toHaveBeenCalled();
    await advance(200);
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(keys).toEqual(expect.arrayContaining(['["skill"]', '["setlist"]', '["difficulty-tables"]', '["song-list"]']));
  });

  it("되돌리기를 누르면 요청 없이 기록이 다시 나타난다", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "삭제 7" }));
    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
    expect(screen.getByText("91.25")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    await advance(UNDO_WINDOW_MS + 1000);
    expect(deletes()).toHaveLength(0);
  });

  it("같은 기록을 두 번 눌러도 토스트와 요청은 하나다", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "삭제 7" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제 7" }));
    expect(screen.getAllByRole("button", { name: "되돌리기" })).toHaveLength(1);
    await advance(UNDO_WINDOW_MS + 100);
    expect(deletes()).toHaveLength(1);
  });

  it("연속 삭제는 각자 자기 되돌리기와 5초를 가진다", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "삭제 7" }));
    await advance(2000);
    fireEvent.click(screen.getByRole("button", { name: "삭제 8" }));
    const undos = screen.getAllByRole("button", { name: "되돌리기" });
    expect(undos).toHaveLength(2);
    fireEvent.click(undos[1]); // 두 번째만 되돌린다
    expect(screen.getByText("80.00")).toBeInTheDocument();
    expect(screen.queryByText("91.25")).toBeNull();
    await advance(3100); // 첫 삭제는 누른 지 5초가 지났다
    expect(deletes().map((c) => String(c[0]))).toEqual(["/api/v1/records/7"]);
  });

  it("화면을 옮겨도 대기와 토스트가 유지되고 5초 뒤 삭제된다", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "삭제 7" }));
    fireEvent.click(screen.getByRole("button", { name: "화면 이동" }));
    expect(screen.getByText("다른 화면")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "되돌리기" })).toBeInTheDocument();
    await advance(2000);
    expect(deletes()).toHaveLength(0);
    await advance(3100);
    expect(deletes()).toHaveLength(1);
    // 되돌아와도 확정된 삭제라 기록이 없다
    fireEvent.click(screen.getByRole("button", { name: "화면 이동" }));
    await waitFor(() => expect(screen.getByText("80.00")).toBeInTheDocument());
    expect(screen.queryByText("91.25")).toBeNull();
  });

  it("pagehide에서는 대기 중인 삭제를 바로 keepalive로 보낸다", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "삭제 7" }));
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    await waitFor(() => expect(deletes()).toHaveLength(1));
    expect(deletes()[0][1]?.keepalive).toBe(true);
    expect(screen.queryByRole("button", { name: "되돌리기" })).toBeNull(); // 보낸 뒤에는 되돌릴 수 없다
    await advance(UNDO_WINDOW_MS + 1000);
    expect(deletes()).toHaveLength(1); // 타이머가 한 번 더 보내지 않는다
  });

  it("탭이 hidden이 되면(visibilitychange) 바로 보낸다", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "삭제 7" }));
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(deletes()).toHaveLength(1));
  });

  it("5초 뒤 요청이 실패하면 기록을 되살리고 오류 토스트와 다시 시도를 보인다", async () => {
    await ready();
    deleteStatus = 500;
    fireEvent.click(screen.getByRole("button", { name: "삭제 7" }));
    await advance(UNDO_WINDOW_MS + 100);
    expect(await screen.findByText("91.25")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("기록을 삭제하지 못했어요");
    deleteStatus = 204;
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(screen.queryByText("91.25")).toBeNull();
    expect(screen.getByRole("button", { name: "되돌리기" })).toBeInTheDocument(); // 다시 5초 대기
    await advance(UNDO_WINDOW_MS + 100);
    expect(deletes()).toHaveLength(2);
  });

  it("대기 중에 로그아웃하면 삭제를 보내지 않고 취소한다(다른 계정에 영향 없음)", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "삭제 7" }));
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "되돌리기" })).toBeNull());
    await advance(UNDO_WINDOW_MS + 1000);
    expect(deletes()).toHaveLength(0);
  });

  it("대기 중인 기록이 있는 채보에 다른 기록이 저장돼 목록이 다시 받아져도 숨김은 유지된다", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "삭제 7" }));
    await act(() => client.invalidateQueries({ queryKey: ["records"] })); // 저장 뒤 무효화와 같은 일
    expect(screen.queryByText("91.25")).toBeNull();
  });
});
