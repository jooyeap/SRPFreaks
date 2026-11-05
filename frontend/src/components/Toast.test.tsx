import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ToastProvider, useToast, type ToastOptions } from "@/components/Toast";

function Button({ text, options }: { text: string; options?: ToastOptions }) {
  const toast = useToast();
  return <button onClick={() => toast(text, options)}>알림</button>;
}

describe("Toast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("안내를 띄우고 몇 초 뒤 사라진다 (role=status)", () => {
    render(
      <ToastProvider>
        <Button text="기록을 저장했습니다." />
      </ToastProvider>,
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: "알림" }));
    expect(screen.getByRole("status")).toHaveTextContent("기록을 저장했습니다.");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("데스크톱(md 이상)에서는 오른쪽 아래, 모바일은 가운데이고 클릭을 막지 않는다", () => {
    render(
      <ToastProvider>
        <Button text="완료" />
      </ToastProvider>,
    );
    const region = screen.getByRole("status").parentElement;
    expect(region).toHaveClass("justify-center", "md:justify-end", "pointer-events-none");
  });

  it("Provider 밖에서 불러도 오류 없이 아무 일도 하지 않는다", () => {
    render(<Button text="없음" />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: "알림" }))).not.toThrow();
  });

  it("성공은 초록 ✓ + role=status, 오류는 빨강 ! + role=alert, 안내는 파랑 i + role=status다", () => {
    const cases: { kind: ToastOptions["kind"]; role: "status" | "alert"; icon: string; border: string }[] = [
      { kind: undefined, role: "status", icon: "✓", border: "border-done" },
      { kind: "success", role: "status", icon: "✓", border: "border-done" },
      { kind: "error", role: "alert", icon: "!", border: "border-danger" },
      { kind: "info", role: "status", icon: "i", border: "border-check-line" },
    ];
    for (const c of cases) {
      const { unmount } = render(
        <ToastProvider>
          <Button text="문구" options={{ kind: c.kind }} />
        </ToastProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "알림" }));
      const region = screen.getByRole(c.role);
      expect(region).toHaveTextContent("문구");
      expect(region).toHaveTextContent(c.icon);
      expect(region.firstElementChild).toHaveClass(c.border);
      // 다른 영역에는 나오지 않는다
      if (c.role === "alert") expect(screen.getByRole("status")).toBeEmptyDOMElement();
      else expect(screen.queryByRole("alert")).toBeNull();
      unmount();
    }
  });

  it("동작 버튼을 누르면 콜백을 부르고 토스트를 닫는다", () => {
    const onAction = vi.fn();
    render(
      <ToastProvider>
        <Button text="삭제했습니다." options={{ action: { label: "되돌리기", onAction } }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "알림" }));
    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("동작 버튼이 없으면 버튼도 없다", () => {
    render(
      <ToastProvider>
        <Button text="완료" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "알림" }));
    expect(screen.queryByRole("button", { name: "되돌리기" })).toBeNull();
  });

  it("durationMs로 떠 있는 시간을 바꾼다", () => {
    render(
      <ToastProvider>
        <Button text="오래" options={{ durationMs: 6000 }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "알림" }));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("오래");
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("countdown 옵션이 있을 때만 남은 시간 막대가 있고, 기존 호출에는 없다", () => {
    const { rerender } = render(
      <ToastProvider>
        <Button text="보통" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "알림" }));
    expect(document.querySelector("[data-countdown]")).toBeNull();
    rerender(
      <ToastProvider>
        <Button text="막대" options={{ countdown: true, durationMs: 5000 }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "알림" }));
    const bar = document.querySelector("[data-countdown='bar']");
    expect(bar).not.toBeNull();
    expect(bar?.firstElementChild).toHaveStyle({ animationDuration: "5000ms" });
    expect(bar?.firstElementChild).toHaveClass("bg-done"); // 색은 토큰 유틸리티만
  });

  it("countdown 토스트는 서로 대체되지 않고 쌓이며 각자 자기 시간에 사라진다", () => {
    function Two() {
      const toast = useToast();
      return (
        <>
          <button onClick={() => toast("하나", { countdown: true, durationMs: 5000 })}>1</button>
          <button onClick={() => toast("둘", { countdown: true, durationMs: 5000 })}>2</button>
          <button onClick={() => toast("보통")}>3</button>
        </>
      );
    }
    render(
      <ToastProvider>
        <Two />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "1" }));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "3" })); // 보통 안내가 와도 countdown은 그대로
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("하나");
    expect(status).toHaveTextContent("둘");
    expect(status).toHaveTextContent("보통");
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(status).not.toHaveTextContent("하나");
    expect(status).toHaveTextContent("둘");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(status).toBeEmptyDOMElement();
  });

  it("반환된 함수로 토스트를 닫을 수 있다", () => {
    function Closer() {
      const toast = useToast();
      const [close, setClose] = useState<(() => void) | null>(null);
      return (
        <>
          <button onClick={() => setClose(() => toast("닫힐 것", { countdown: true, durationMs: 5000 }))}>열기</button>
          <button onClick={() => close?.()}>닫기</button>
        </>
      );
    }
    render(
      <ToastProvider>
        <Closer />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "열기" }));
    expect(screen.getByRole("status")).toHaveTextContent("닫힐 것");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("움직임 줄이기 설정이면 막대 대신 남은 초 숫자를 보인다", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      render(
        <ToastProvider>
          <Button text="숫자" options={{ countdown: true, durationMs: 5000 }} />
        </ToastProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "알림" }));
      expect(document.querySelector("[data-countdown='bar']")).toBeNull();
      const num = document.querySelector("[data-countdown='number']");
      expect(num).toHaveTextContent("5");
      act(() => {
        vi.advanceTimersByTime(2100);
      });
      expect(num).toHaveTextContent("3");
    } finally {
      window.matchMedia = original;
    }
  });
});

// 토스트 아이콘 글자와 문구가 카드 바탕 위에서 4.5 이상인지, 라이트·다크 모두 globals.css의 실제 값으로 계산한다.
describe("Toast 글자 대비 (globals.css 값)", () => {
  const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");
  const varsOf = (selector: string): Record<string, string> => {
    const open = css.indexOf("{", css.indexOf(selector));
    const body = css.slice(open + 1, css.indexOf("}", open)).replace(/\/\*[\s\S]*?\*\//g, "");
    const out: Record<string, string> = {};
    for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
    return out;
  };
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const themes: [string, Record<string, string>][] = [
    ["다크", varsOf(":root {")],
    ["라이트", varsOf(':root[data-theme="light"] {')],
  ];
  for (const [name, v] of themes) {
    it(`${name}: 문구와 세 아이콘 색이 카드 바탕에서 4.5 이상이다`, () => {
      for (const token of ["--fg", "--done-text", "--danger", "--check-fg"]) {
        expect(ratio(v[token], v["--card"]), `${name} ${token}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
