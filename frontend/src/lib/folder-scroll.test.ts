import { afterEach, describe, expect, it, vi } from "vitest";
import { alignListHead, requestFolderScrollAdjust, stickyTopOffset, takeFolderScrollAdjust } from "@/lib/folder-scroll";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  takeFolderScrollAdjust();
});

function rect(top: number, height = 0): DOMRect {
  return { top, bottom: top + height, left: 0, right: 0, width: 0, height, x: 0, y: top, toJSON: () => ({}) };
}

describe("이동 직후 스크롤 맞춤 표시", () => {
  it("요청하면 한 번만 꺼낼 수 있다", () => {
    expect(takeFolderScrollAdjust()).toBe(false);
    requestFolderScrollAdjust();
    expect(takeFolderScrollAdjust()).toBe(true);
    expect(takeFolderScrollAdjust()).toBe(false);
  });
});

describe("stickyTopOffset", () => {
  it("붙어 있는 요소가 없으면 0 (지금 사이트 헤더는 스크롤되면 사라진다)", () => {
    document.body.innerHTML = "<header></header>";
    expect(stickyTopOffset()).toBe(0);
  });
  it("위에 붙은 sticky/fixed 요소의 아래 끝을 잰다 (하드코딩하지 않는다)", () => {
    document.body.innerHTML = '<header id="h"></header><p id="s" role="status"></p>';
    const header = document.getElementById("h") as HTMLElement;
    const status = document.getElementById("s") as HTMLElement;
    header.style.position = "sticky";
    status.style.position = "sticky";
    vi.spyOn(header, "getBoundingClientRect").mockReturnValue(rect(0, 56));
    vi.spyOn(status, "getBoundingClientRect").mockReturnValue(rect(0, 40));
    expect(stickyTopOffset()).toBe(56);
  });
  it("sticky여도 위쪽 끝에 붙어 있지 않으면(스크롤로 내려간 상태) 세지 않는다", () => {
    document.body.innerHTML = '<header id="h"></header>';
    const header = document.getElementById("h") as HTMLElement;
    header.style.position = "sticky";
    vi.spyOn(header, "getBoundingClientRect").mockReturnValue(rect(80, 56));
    expect(stickyTopOffset()).toBe(0);
  });
});

describe("alignListHead", () => {
  it("목록 머리가 화면 위로 지나가 있으면 머리가 맨 위(헤더 바로 아래)에 오도록 즉시 올린다", () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    Object.defineProperty(window, "scrollY", { value: 900, configurable: true, writable: true });
    document.body.innerHTML = '<header id="h"></header><div id="head"></div>';
    const header = document.getElementById("h") as HTMLElement;
    header.style.position = "sticky";
    vi.spyOn(header, "getBoundingClientRect").mockReturnValue(rect(0, 50));
    const head = document.getElementById("head") as HTMLElement;
    vi.spyOn(head, "getBoundingClientRect").mockReturnValue(rect(-400));
    expect(alignListHead(head)).toBe(true);
    // 머리의 페이지 위치 = 900 - 400 = 500, 헤더가 50px 가리므로 450
    expect(scrollTo).toHaveBeenCalledWith({ top: 450, behavior: "instant" });
    vi.unstubAllGlobals();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true, writable: true });
  });
  it("머리가 보이거나 그 아래에 있으면 스크롤하지 않는다", () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    document.body.innerHTML = '<div id="head"></div>';
    const head = document.getElementById("head") as HTMLElement;
    vi.spyOn(head, "getBoundingClientRect").mockReturnValue(rect(300));
    expect(alignListHead(head)).toBe(false);
    expect(scrollTo).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
