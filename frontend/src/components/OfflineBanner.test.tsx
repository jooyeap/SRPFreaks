import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineBanner } from "@/components/OfflineBanner";

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}

describe("OfflineBanner", () => {
  afterEach(() => vi.restoreAllMocks());

  it("연결되어 있으면 아무것도 그리지 않는다", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("연결이 끊기면 안내가 나타나고, 다시 연결되면 사라진다", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<OfflineBanner />);

    act(() => setOnline(false));
    expect(screen.getByRole("status")).toHaveTextContent("인터넷에 연결되어 있지 않습니다. 연결되면 다시 시도해 주세요.");

    act(() => setOnline(true));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("처음부터 끊겨 있어도 안내를 보인다", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<OfflineBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
