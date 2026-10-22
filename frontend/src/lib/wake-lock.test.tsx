import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "@/lib/wake-lock";

function Probe({ active }: { active: boolean }) {
  useWakeLock(active);
  return null;
}

describe("useWakeLock", () => {
  const release = vi.fn(() => Promise.resolve());
  const request = vi.fn(() => Promise.resolve({ release }));

  beforeEach(() => {
    release.mockClear();
    request.mockClear();
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
  });
  afterEach(() => {
    Reflect.deleteProperty(navigator, "wakeLock");
  });

  it("active가 true인 동안 화면 꺼짐 방지를 걸고, 끄면 놓는다", async () => {
    const { rerender } = render(<Probe active />);
    await act(async () => {});
    expect(request).toHaveBeenCalledWith("screen");

    rerender(<Probe active={false} />);
    await act(async () => {});
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("active가 false면 걸지 않는다", async () => {
    render(<Probe active={false} />);
    await act(async () => {});
    expect(request).not.toHaveBeenCalled();
  });

  it("화면이 숨겨졌다 다시 보이면 다시 건다", async () => {
    render(<Probe active />);
    await act(async () => {});
    expect(request).toHaveBeenCalledTimes(1);

    const state = vi.spyOn(document, "visibilityState", "get");
    state.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    state.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => {});
    expect(request).toHaveBeenCalledTimes(2);
    state.mockRestore();
  });

  it("지원하지 않는 브라우저나 거부되어도 오류 없이 넘어간다", async () => {
    Reflect.deleteProperty(navigator, "wakeLock");
    expect(() => render(<Probe active />)).not.toThrow();

    Object.defineProperty(navigator, "wakeLock", {
      value: { request: vi.fn(() => Promise.reject(new Error("NotAllowedError"))) },
      configurable: true,
    });
    render(<Probe active />);
    await act(async () => {});
  });

  it("거부 중 창이 닫히면 늦게 도착한 잠금도 바로 놓는다", async () => {
    let resolve: (value: { release: typeof release }) => void = () => {};
    request.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { unmount } = render(<Probe active />);
    unmount();
    resolve({ release });
    await act(async () => {});
    expect(release).toHaveBeenCalledTimes(1);
  });
});
