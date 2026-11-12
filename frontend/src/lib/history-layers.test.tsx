import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetHistoryLayersForTest, runAfterHistorySettled } from "@/lib/history-layers";
import { useHistoryClose } from "@/lib/use-history-close";

/** 창 하나: 버튼으로 열고, 열려 있으면 `{name} 창`과 닫기 버튼이 보인다 */
function Layer({ name, onNavigate }: { name: string; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  useHistoryClose(open, () => setOpen(false));
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>{`${name} 열기`}</button>
      {open ? (
        <section aria-label={`${name} 창`}>
          <button type="button" onClick={() => setOpen(false)}>{`${name} 닫기`}</button>
          {onNavigate ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                runAfterHistorySettled(onNavigate);
              }}
            >
              {`${name} 이동`}
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function pushPage(path: string) {
  window.history.pushState(null, "", path);
}
const hasKey = () => typeof window.history.state === "object" && window.history.state !== null && "__srpLayer" in window.history.state;

describe("useHistoryClose (창·시트 뒤로 가기)", () => {
  beforeEach(() => {
    resetHistoryLayersForTest();
    window.history.replaceState(null, "", "/a");
    pushPage("/b");
  });
  afterEach(() => resetHistoryLayersForTest());

  it("창을 열면 history가 한 칸 늘고, 뒤로 가기(popstate)로 창만 닫히고 주소는 그대로다", async () => {
    render(<Layer name="가" />);
    const before = window.history.length;
    fireEvent.click(screen.getByText("가 열기"));
    expect(screen.getByRole("region", { name: "가 창" })).toBeInTheDocument();
    expect(window.history.length).toBe(before + 1);
    expect(hasKey()).toBe(true);

    window.history.back();
    await waitFor(() => expect(screen.queryByRole("region", { name: "가 창" })).not.toBeInTheDocument());
    expect(window.location.pathname).toBe("/b");
  });

  it("닫기 버튼으로 닫으면 쌓은 칸을 걷어내서, 이어지는 뒤로 가기는 원래대로 이전 화면으로 간다", async () => {
    render(<Layer name="가" />);
    fireEvent.click(screen.getByText("가 열기"));
    fireEvent.click(screen.getByText("가 닫기"));
    expect(screen.queryByRole("region", { name: "가 창" })).not.toBeInTheDocument();
    await waitFor(() => expect(hasKey()).toBe(false));
    expect(window.location.pathname).toBe("/b");

    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe("/a"));
  });

  it("겹친 창은 위에서부터 하나씩 닫힌다", async () => {
    render(
      <>
        <Layer name="가" />
        <Layer name="나" />
      </>,
    );
    fireEvent.click(screen.getByText("가 열기"));
    fireEvent.click(screen.getByText("나 열기"));
    expect(screen.getByRole("region", { name: "가 창" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "나 창" })).toBeInTheDocument();

    window.history.back();
    await waitFor(() => expect(screen.queryByRole("region", { name: "나 창" })).not.toBeInTheDocument());
    expect(screen.getByRole("region", { name: "가 창" })).toBeInTheDocument();

    window.history.back();
    await waitFor(() => expect(screen.queryByRole("region", { name: "가 창" })).not.toBeInTheDocument());
    expect(window.location.pathname).toBe("/b");
  });

  it("아래 창이 먼저 닫혀도(칸을 못 걷어내도) 위 창을 닫으면 죽은 칸을 건너뛰어 이전 화면 앞에서 멈춘다", async () => {
    render(
      <>
        <Layer name="가" />
        <Layer name="나" />
      </>,
    );
    fireEvent.click(screen.getByText("가 열기"));
    fireEvent.click(screen.getByText("나 열기"));
    fireEvent.click(screen.getByText("가 닫기"));
    fireEvent.click(screen.getByText("나 닫기"));
    // 모든 칸이 정리되어 우리 칸이 남지 않는다
    await waitFor(() => expect(hasKey()).toBe(false));
    expect(window.location.pathname).toBe("/b");
    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe("/a"));
  });

  it("닫고 바로 다른 창을 열어도(관리 창 → 수정 창) 칸이 어긋나지 않는다", async () => {
    render(
      <>
        <Layer name="가" />
        <Layer name="나" />
      </>,
    );
    fireEvent.click(screen.getByText("가 열기"));
    // 같은 동작 안에서 닫고 연다
    act(() => {
      fireEvent.click(screen.getByText("가 닫기"));
      fireEvent.click(screen.getByText("나 열기"));
    });
    expect(screen.getByRole("region", { name: "나 창" })).toBeInTheDocument();
    await waitFor(() => expect(hasKey()).toBe(true));
    window.history.back();
    await waitFor(() => expect(screen.queryByRole("region", { name: "나 창" })).not.toBeInTheDocument());
    expect(window.location.pathname).toBe("/b");
  });

  it("창이 열려 있는 채 화면을 이동해 창이 사라져도 오류가 나지 않고, 죽은 칸은 뒤로 가기에서 건너뛴다", async () => {
    const { unmount } = render(<Layer name="가" />);
    fireEvent.click(screen.getByText("가 열기"));
    // 링크 이동처럼 새 화면 칸이 위에 쌓이고, 그 화면에서 창이 사라진다
    pushPage("/c");
    unmount();
    expect(window.location.pathname).toBe("/c");

    // 뒤로 가기: 죽은 칸(/b에 쌓았던 칸)에 닿으면 한 번 더 뒤로 가서 건너뛰므로, 결국 /b의 원래 칸에서 멈춘다
    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe("/b"));
    await waitFor(() => expect(hasKey()).toBe(false));
  });

  it("기록 상태가 없는 새로고침·직접 진입 상태에서도 열고 닫는 데 오류가 없다", async () => {
    window.history.replaceState(undefined, "", "/direct");
    render(<Layer name="가" />);
    fireEvent.click(screen.getByText("가 열기"));
    fireEvent.click(screen.getByText("가 닫기"));
    await waitFor(() => expect(hasKey()).toBe(false));
    expect(window.location.pathname).toBe("/direct");
  });

  it("창에서 이동할 때는 칸을 먼저 걷어낸 뒤 이동한다(칸이 하나도 남지 않는다)", async () => {
    const go = vi.fn(() => {
      // 이동 시점에는 우리 칸이 이미 걷혀 있어야 한다
      expect(hasKey()).toBe(false);
      pushPage("/next");
    });
    render(<Layer name="가" onNavigate={go} />);
    fireEvent.click(screen.getByText("가 열기"));
    fireEvent.click(screen.getByText("가 이동"));
    await waitFor(() => expect(go).toHaveBeenCalledTimes(1));
    expect(window.location.pathname).toBe("/next");

    // /b(창을 열기 전 칸)가 한 번만 남아 있다: 뒤로 가기 한 번으로 /b
    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe("/b"));
    expect(hasKey()).toBe(false);
  });

  it("쌓을 칸이 없으면(창을 열지 않았으면) 이동 코드를 바로 실행한다", async () => {
    const go = vi.fn();
    runAfterHistorySettled(go);
    await waitFor(() => expect(go).toHaveBeenCalledTimes(1));
  });

  it("내부 링크를 눌러 창을 닫으면 칸을 되돌리지 않아 링크 이동을 방해하지 않는다", async () => {
    render(
      <>
        <Layer name="가" />
        <a href="/linked">링크</a>
      </>,
    );
    fireEvent.click(screen.getByText("가 열기"));
    const back = vi.spyOn(window.history, "back");
    // 링크 클릭(캡처 단계에서 "이동하려는 뜻"으로 기억) 직후 바깥 누르기와 같이 창이 닫힌다
    const link = screen.getByText("링크");
    link.addEventListener("click", (event) => event.preventDefault()); // jsdom이 실제로 이동하지 않게
    fireEvent.click(link);
    fireEvent.click(screen.getByText("가 닫기"));
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });
});
