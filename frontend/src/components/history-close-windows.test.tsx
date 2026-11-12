import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HelpTip } from "@/components/HelpTip";
import { resetHistoryLayersForTest } from "@/lib/history-layers";

const layerKey = () => (typeof window.history.state === "object" && window.history.state !== null ? ((window.history.state as Record<string, unknown>).__srpLayer ?? null) : null);
const hasKey = () => typeof window.history.state === "object" && window.history.state !== null && "__srpLayer" in window.history.state;

// 창·시트가 뒤로 가기(popstate)로 닫히는지, 컴포넌트마다 한 번씩 확인한다(공용 훅의 세부 규칙은 lib/history-layers.test.tsx)

function ConfirmHarness({ onCancel, initiallyOpen = false }: { onCancel: () => void; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        열기
      </button>
      <ConfirmDialog
        open={open}
        title="삭제할까요?"
        message="되돌릴 수 없습니다."
        confirmLabel="삭제"
        onConfirm={() => setOpen(false)}
        onCancel={() => {
          onCancel();
          setOpen(false);
        }}
      />
    </>
  );
}

describe("창·시트의 뒤로 가기 닫기", () => {
  beforeEach(() => {
    resetHistoryLayersForTest();
    window.history.replaceState(null, "", "/a");
    window.history.pushState(null, "", "/b");
  });
  afterEach(() => resetHistoryLayersForTest());

  it("확인 창: 열면 history가 한 칸 늘고, 뒤로 가기를 누르면 onCancel로 닫힌다", async () => {
    const onCancel = vi.fn();
    render(<ConfirmHarness onCancel={onCancel} />);
    const before = window.history.length;
    fireEvent.click(screen.getByText("열기"));
    expect(screen.getByText("삭제할까요?")).toBeInTheDocument();
    expect(window.history.length).toBe(before + 1);

    window.history.back();
    await waitFor(() => expect(screen.queryByText("삭제할까요?")).not.toBeInTheDocument());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/b");
  });

  it("확인 창: 취소 버튼으로 닫아도 쌓은 칸이 정리되어 뒤로 가기는 이전 화면으로 간다", async () => {
    render(<ConfirmHarness onCancel={() => undefined} />);
    fireEvent.click(screen.getByText("열기"));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(hasKey()).toBe(false));
    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe("/a"));
  });

  it("? 설명 상자: 뒤로 가기를 누르면 상자만 닫힌다", async () => {
    render(<HelpTip title="제목" body="본문" ariaLabel="설명 보기" />);
    fireEvent.click(screen.getByRole("button", { name: "설명 보기" }));
    expect(screen.getByRole("dialog", { name: "제목" })).toBeInTheDocument();

    window.history.back();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(window.location.pathname).toBe("/b");
  });

  it("React 개발 모드(처음부터 열려 있어 effect가 두 번 도는 경우)에서도 칸이 한 칸만 쌓이고 뒤로 가기로 닫힌다", async () => {
    const before = window.history.length;
    render(
      <StrictMode>
        <ConfirmHarness onCancel={() => undefined} initiallyOpen />
      </StrictMode>,
    );
    // 개발 모드는 마운트 때 effect를 두 번 돌려 첫 층(번호 -1)의 칸을 걷어낸 뒤 두 번째 층(번호 -2)의 칸을 쌓는다. 걷어내는 중에는
    // 첫 칸이 아직 현재 칸이라 "키가 있다"만 보면 너무 일찍 통과하고, 아래 back()이 걷어내는 back()과 겹친다. 두 번째 층의 칸이 쌓일 때까지 기다린다.
    await waitFor(() => expect(String(layerKey())).toMatch(/-2$/));
    expect(window.history.length).toBe(before + 1);
    expect(screen.getByText("삭제할까요?")).toBeInTheDocument();

    window.history.back();
    await waitFor(() => expect(screen.queryByText("삭제할까요?")).not.toBeInTheDocument());
    expect(window.location.pathname).toBe("/b");
  });
});
