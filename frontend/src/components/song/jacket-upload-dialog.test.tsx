import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ko from "../../../messages/ko.json";
import { JacketUploadDialog } from "@/components/song/JacketUploadDialog";
import { ToastProvider } from "@/components/Toast";
import { jacketQualitySteps } from "@/lib/jacket-resize";

const fetchMock = vi.fn<typeof fetch>();

function renderDialog(resize: (file: Blob) => Promise<Blob>, hasJacket = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onClose = vi.fn();
  render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <JacketUploadDialog open onClose={onClose} songId={7} songTitle="Saiph" hasJacket={hasJacket} resize={resize} />
        </ToastProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { onClose };
}

function pick() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["x"], "a.png", { type: "image/png" })] } });
}

describe("곡 상세 재킷 바꾸기 (ROOT)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("이미지를 고르면 줄인 미리보기를 보여 주고, 저장하면 곡 번호와 WebP를 보낸다", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ saved: 1, replaced: 0 }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const { onClose } = renderDialog(async () => new Blob(["webp"], { type: "image/webp" }));
    const save = screen.getByRole("button", { name: "저장" });
    expect(save).toBeDisabled();
    pick();
    expect(await screen.findByRole("img", { name: "Saiph 재킷 미리보기" })).toHaveAttribute("src", "blob:preview");
    fireEvent.click(save);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls.find(([u]) => String(u).includes("/admin/song-jackets")) ?? [];
    expect(String(url)).toMatch(/\/admin\/song-jackets$/);
    const body = init?.body as FormData;
    expect(body.get("songIds")).toBe("7");
    expect((body.get("images") as File).type).toBe("image/webp");
  });

  it("줄여도 50KB를 넘으면 안내하고 저장하지 않는다", async () => {
    renderDialog(async () => {
      throw new Error("too-large");
    });
    pick();
    expect(await screen.findByRole("alert")).toHaveTextContent("이미지를 줄여도 50KB를 넘습니다.");
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("재킷이 있으면 지우기 버튼이 DELETE를 보낸다", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
    const { onClose } = renderDialog(async () => new Blob(), true);
    fireEvent.click(screen.getByRole("button", { name: "재킷 지우기" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes("/admin/song-jackets/7"));
    expect(call?.[1]?.method).toBe("DELETE");
  });

  it("품질은 0.8부터 낮춰 가며 시도한다", () => {
    expect(jacketQualitySteps()[0]).toBe(0.8);
    expect(jacketQualitySteps()).toEqual([...jacketQualitySteps()].sort((a, b) => b - a));
  });
});
