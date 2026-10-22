import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ja from "../../messages/ja.json";
import ko from "../../messages/ko.json";

// 이 파일은 전역 가짜(vitest.setup.ts)가 아니라 진짜 next-intl로 한국어/일본어 화면을 확인한다.
vi.unmock("next-intl");
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }), usePathname: () => "/" }));

import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { OfflineBanner } from "@/components/OfflineBanner";

function renderWith(locale: "ko" | "ja", ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ja" ? ja : ko}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("LocaleSwitcher", () => {
  beforeEach(() => {
    refresh.mockReset();
    document.cookie = "srp.locale=; Max-Age=0; Path=/";
  });

  it("한국어일 때는 日本語, 일본어일 때는 한국어 버튼을 보여 준다", () => {
    const first = renderWith("ko", <LocaleSwitcher />);
    expect(screen.getByRole("button", { name: "언어를 日本語(으)로 바꾸기" })).toHaveTextContent("日本語");
    first.unmount();
    renderWith("ja", <LocaleSwitcher />);
    expect(screen.getByRole("button", { name: "言語を한국어に切り替える" })).toHaveTextContent("한국어");
  });

  it("누르면 쿠키에 저장하고 화면을 새로 받아 온다", () => {
    renderWith("ko", <LocaleSwitcher />);
    fireEvent.click(screen.getByRole("button"));
    expect(document.cookie).toContain("srp.locale=ja");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("일본어 문구로 그려진다 (OfflineBanner)", () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    renderWith("ja", <OfflineBanner />);
    expect(screen.getByRole("status")).toHaveTextContent("インターネットに接続されていません");
    vi.unstubAllGlobals();
  });
});
