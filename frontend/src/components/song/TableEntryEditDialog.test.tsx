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
  ratingEnabled: true,
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
    expect(screen.queryByLabelText("레이팅 상수 난이도")).toBeNull();
  });

  it("지금 값이 미리 채워져 있고 제목은 '서열표 값 수정'이다", () => {
    renderDialog(existing);
    expect(screen.getByText("서열표 값 수정")).toBeInTheDocument();
    expect(screen.getByLabelText("레이팅 상수 난이도")).toHaveValue("5.8");
    expect(screen.getByLabelText("추천도")).toHaveValue("중");
    expect(screen.getByLabelText("속성")).toHaveValue("단일");
  });

  it("저장하면 PUT으로 보낸 값으로 교체하고, 서열표와 레이팅 캐시를 새로 받은 뒤 닫는다", async () => {
    fetchMock.mockResolvedValue(json(entry));
    renderDialog(existing);

    fireEvent.change(screen.getByLabelText("레이팅 상수 난이도"), { target: { value: "6.1" } });
    fireEvent.change(screen.getByLabelText("추천도"), { target: { value: "상" } });
    fireEvent.change(screen.getByLabelText("속성"), { target: { value: "레이팅 제외" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("/api/v1/admin/difficulty-tables/3/entries/10");
    expect(init?.method).toBe("PUT");
    expect(sentBody()).toEqual({ tierLabel: 6.1, recommend: "상", pattern: "레이팅 제외", ratingEnabled: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["difficulty-tables"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["skill"] });
  });

  it("값을 모두 비우고 저장하면 미정과 값 없음(null)으로 보낸다", async () => {
    fetchMock.mockResolvedValue(json(entry));
    renderDialog(existing);

    fireEvent.change(screen.getByLabelText("레이팅 상수 난이도"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("추천도"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("속성"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sentBody()).toEqual({ tierLabel: null, recommend: null, pattern: null, ratingEnabled: true });
  });

  it("표에 없는 채보는 제목이 '서열표에 추가'이고 비어 있는 채로 시작한다", () => {
    renderDialog({ ...existing, tier: null, entry: null });
    expect(screen.getByText("서열표에 추가")).toBeInTheDocument();
    expect(screen.getByLabelText("레이팅 상수 난이도")).toHaveValue("");
    expect(screen.getByLabelText("추천도")).toHaveValue("");
    expect(screen.getByRole("button", { name: "추가" })).toBeInTheDocument();
  });

  describe("레이팅 반영 스위치", () => {
    const toggle = () => screen.getByRole("switch", { name: "레이팅 반영" });

    it("저장된 값대로 켜짐/꺼짐을 글자와 aria-checked로 보여 준다", () => {
      const { unmount } = renderDialog(existing);
      expect(toggle()).toHaveAttribute("aria-checked", "true");
      expect(screen.getByText("켜짐")).toBeInTheDocument();
      unmount();

      renderDialog({ ...existing, entry: { ...entry, ratingEnabled: false } });
      expect(toggle()).toHaveAttribute("aria-checked", "false");
      expect(screen.getByText("꺼짐")).toBeInTheDocument();
    });

    it("표에 없던 채보를 추가할 때는 꺼진 채로 시작한다", () => {
      renderDialog({ ...existing, tier: null, entry: null });
      expect(toggle()).toHaveAttribute("aria-checked", "false");
    });

    it("끄고 저장하면 ratingEnabled: false를 보낸다", async () => {
      fetchMock.mockResolvedValue(json({ ...entry, ratingEnabled: false }));
      renderDialog(existing);

      fireEvent.click(toggle());
      expect(toggle()).toHaveAttribute("aria-checked", "false");
      fireEvent.click(screen.getByRole("button", { name: "저장" }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(sentBody()).toMatchObject({ ratingEnabled: false });
    });

    it("켜 두었는데 레이팅 상수 난이도나 속성이 없으면 계산에 안 들어간다고 알려 준다", () => {
      renderDialog({ ...existing, tier: null, entry: { ...entry, ratingEnabled: true, pattern: null } });
      expect(screen.getByRole("status")).toHaveTextContent("계산에 들어가지 않습니다");

      fireEvent.change(screen.getByLabelText("레이팅 상수 난이도"), { target: { value: "6.0" } });
      fireEvent.change(screen.getByLabelText("속성"), { target: { value: "단일" } });
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("속성이 레이팅 제외이면 켜 두어도 안내를 보여 준다", () => {
      renderDialog({ ...existing, entry: { ...entry, pattern: "레이팅 제외" } });
      expect(screen.getByRole("status")).toHaveTextContent("계산에 들어가지 않습니다");
    });

    it("꺼져 있으면 값이 없어도 안내를 보여 주지 않는다", () => {
      renderDialog({ ...existing, tier: null, entry: { ...entry, ratingEnabled: false, pattern: null } });
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  it("검사에 실패하면 서버에 보내지 않고 입력칸 아래에 문구를 보여 준다", async () => {
    renderDialog(existing);
    fireEvent.change(screen.getByLabelText("레이팅 상수 난이도"), { target: { value: "5.85" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("레이팅 상수 난이도는 소수 첫째 자리까지만 입력할 수 있습니다.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("서버가 필드 오류(tierLabel)를 주면 레이팅 상수 난이도 칸 아래에 보여 주고 닫지 않는다", async () => {
    fetchMock.mockResolvedValue(
      json(
        { code: "VALIDATION_ERROR", message: "요청 값을 확인해 주세요.", timestamp: "t", fieldErrors: { tierLabel: "레이팅 상수 난이도는 99.9 이하여야 합니다." } },
        400,
      ),
    );
    renderDialog(existing);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("레이팅 상수 난이도는 99.9 이하여야 합니다.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("권한이 없으면(403) 서버 문구를 보여 준다", async () => {
    fetchMock.mockResolvedValue(json({ code: "FORBIDDEN", message: "권한이 없습니다.", timestamp: "t" }, 403));
    renderDialog(existing);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("권한이 없습니다.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("창 바깥을 누르면 닫지만, 창 안쪽 여백을 누르면 닫지 않는다", () => {
    const { container } = renderDialog(existing);
    const dialog = container.querySelector("dialog");
    expect(dialog).not.toBeNull();
    // jsdom은 레이아웃이 없어 getBoundingClientRect가 모두 0이다: (0, 0)은 창 안, 그 밖의 좌표는 창 바깥(::backdrop)이다
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 100, 200, 200));
    fireEvent.click(dialog as HTMLDialogElement, { clientX: 150, clientY: 150 });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialog as HTMLDialogElement, { clientX: 10, clientY: 10 });
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it("취소를 누르면 저장하지 않고 닫는다", () => {
    renderDialog(existing);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
