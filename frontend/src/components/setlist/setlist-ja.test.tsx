import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "use-intl/core";
import ja from "../../../messages/ja.json";
import ko from "../../../messages/ko.json";

// 공용 setup은 한국어 번역을 끼우므로, 이 파일에서만 일본어로 바꾼다.
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator({ locale: "ja", messages: ja, namespace } as never),
  useLocale: () => "ja",
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }), usePathname: () => "/me" }));

import { AuthProvider } from "@/components/AuthProvider";
import { SetlistTab } from "@/components/setlist/SetlistTab";
import type { SetlistItemResponse } from "@/lib/api-types";
import { clearAccessToken } from "@/lib/auth-token";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const AUTH = {
  accessToken: "t", tokenType: "Bearer", expiresIn: 900,
  user: { id: 1, email: "a@example.com", nickname: null, role: "USER", createdAt: "2026-10-01T00:00:00Z" },
};
function item(id: number, over: Partial<SetlistItemResponse> = {}): SetlistItemResponse {
  return {
    id, songDifficultyId: 100 + id, songId: 200 + id, title: `曲${id}`, part: "GUITAR", difficulty: "MASTER",
    level: 9.5, tier: 5.6, pattern: "복합", mine: null, done: false, createdAt: "2026-10-16T05:00:00Z", ...over,
  };
}

describe("세트리스트 (일본어)", () => {
  let listed: SetlistItemResponse[] = [];
  beforeEach(() => {
    clearAccessToken();
    listed = [];
    vi.stubGlobal("fetch", vi.fn<typeof fetch>((input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return Promise.resolve(json(AUTH));
      if (url.includes("/setlist/recommendations")) return Promise.resolve(json({ status: "UNAVAILABLE", ssChallenge: [], sFill: [], ssTotalPages: 0, sTotalPages: 0 }));
      if (url.includes("/setlist")) return Promise.resolve(json({ content: listed, page: 0, size: 30, totalElements: listed.length, totalPages: 1 }));
      return Promise.resolve(json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderTab() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><AuthProvider><SetlistTab userId={1} /></AuthProvider></QueryClientProvider>);
  }

  it("빈 목록 문구가 새 표현(プレイする)이다", async () => {
    renderTab();
    expect(await screen.findByText("追加した曲がありません。上の検索欄で、今日プレイする曲を探して追加してみましょう。")).toBeInTheDocument();
  });

  it("줄에 `定数 5.6`과 일본어 버튼이 나온다", async () => {
    listed = [item(1), item(2, { tier: null, done: true })];
    renderTab();
    const rows = within(await screen.findByRole("list", { name: "セットリスト" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("定数 5.6");
    expect(rows[1]).toHaveTextContent("定数 未定");
    expect(within(rows[0]).getAllByRole("button").map((b) => b.textContent)).toEqual(["入力", "外す"]);
    expect(within(rows[1]).getAllByRole("button").map((b) => b.textContent)).toEqual(["編集", "外す"]);
  });

  it("ko·ja 메시지 키 구성이 같다 (새 키 포함)", () => {
    expect(Object.keys(ja.Setlist).sort()).toEqual(Object.keys(ko.Setlist).sort());
  });
});
