import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TableEntryEditDialog, type TableEntryTarget } from "@/components/song/TableEntryEditDialog";
import type { TableEntryResponse } from "@/lib/api-types";

const entry: TableEntryResponse = {
  entryId: 1,
  songDifficultyId: 10,
  songId: 1,
  title: "테스트곡",
  addedVersion: "V5",
  part: "GUITAR",
  difficulty: "MASTER",
  level: 9.8,
  tierUncertain: false,
  recommend: "중",
  recommendUncertain: false,
  pattern: "단일",
  patternUncertain: false,
  mine: null,
};

const existing: TableEntryTarget = {
  tableId: 3,
  songDifficultyId: 10,
  title: "테스트곡",
  part: "GUITAR",
  difficulty: "MASTER",
  level: 9.8,
  tier: 5.8,
  entry,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("TableEntryEditDialog", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const onClose = vi.fn();
  let client: QueryClient;
  let invalidate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock.mockReset();
    onClose.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    invalidate = vi.spyOn(client, "invalidateQueries");
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderDialog(target: TableEntryTarget | null) {
    return render(
      <QueryClientProvider client={client}>
        <TableEntryEditDialog target={target} onClose={onClose} />
      </QueryClientProvider>,
    );
  }
  const sentBody = () => JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as unknown;

  it("target이 없으면 아무것도 그리지 않는다", () => {
    renderDialog(null);
    expect(screen.queryByLabelText("기준 난이도")).toBeNull();
  });

  it("지금 값이 미리 채워져 있고 제목은 '서열표 값 수정'이다", () => {
    renderDialog(existing);
    expect(screen.getByText("서열표 값 수정")).toBeInTheDocument();
    expect(screen.getByLabelText("기준 난이도")).toHaveValue("5.8");
    expect(screen.getByLabelText("추천도")).toHaveValue("중");
    expect(screen.getByLabelText("속성")).toHaveValue("단일");
  });

  it("저장하면 PUT으로 보낸 값으로 교체하고, 서열표와 레이팅 캐시를 새로 받은 뒤 닫는다", async () => {
    fetchMock.mockResolvedValue(json(entry));
    renderDialog(existing);

    fireEvent.change(screen.getByLabelText("기준 난이도"), { target: { value: "6.1" } });
    fireEvent.change(screen.getByLabelText("추천도"), { target: { value: "상" } });
    fireEvent.change(screen.getByLabelText("속성"), { target: { value: "레이팅 제외" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("/api/v1/admin/difficulty-tables/3/entries/10");
    expect(init?.method).toBe("PUT");
    expect(sentBody()).toEqual({ tierLabel: 6.1, recommend: "상", pattern: "레이팅 제외" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["difficulty-tables"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["skill"] });
  });

  it("값을 모두 비우고 저장하면 미정과 값 없음(null)으로 보낸다", async () => {
    fetchMock.mockResolvedValue(json(entry));
    renderDialog(existing);

    fireEvent.change(screen.getByLabelText("기준 난이도"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("추천도"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("속성"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sentBody()).toEqual({ tierLabel: null, recommend: null, pattern: null });
  });

  it("표에 없는 채보는 제목이 '서열표에 추가'이고 비어 있는 채로 시작한다", () => {
    renderDialog({ ...existing, tier: null, entry: null });
    expect(screen.getByText("서열표에 추가")).toBeInTheDocument();
    expect(screen.getByLabelText("기준 난이도")).toHaveValue("");
    expect(screen.getByLabelText("추천도")).toHaveValue("");
    expect(screen.getByRole("button", { name: "추가" })).toBeInTheDocument();
  });

  it("검사에 실패하면 서버에 보내지 않고 입력칸 아래에 문구를 보여 준다", async () => {
    renderDialog(existing);
    fireEvent.change(screen.getByLabelText("기준 난이도"), { target: { value: "5.85" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("기준 난이도는 소수 첫째 자리까지만 입력할 수 있습니다.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("서버가 필드 오류(tierLabel)를 주면 기준 난이도 칸 아래에 보여 주고 닫지 않는다", async () => {
    fetchMock.mockResolvedValue(
      json(
        { code: "VALIDATION_ERROR", message: "요청 값을 확인해 주세요.", timestamp: "t", fieldErrors: { tierLabel: "기준 난이도는 99.9 이하여야 합니다." } },
        400,
      ),
    );
    renderDialog(existing);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("기준 난이도는 99.9 이하여야 합니다.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("권한이 없으면(403) 서버 문구를 보여 준다", async () => {
    fetchMock.mockResolvedValue(json({ code: "FORBIDDEN", message: "권한이 없습니다.", timestamp: "t" }, 403));
    renderDialog(existing);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("권한이 없습니다.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("취소를 누르면 저장하지 않고 닫는다", () => {
    renderDialog(existing);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
