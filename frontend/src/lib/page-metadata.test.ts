import { describe, expect, it, vi } from "vitest";
import ko from "../../messages/ko.json";
import { pageMetadata } from "@/lib/page-metadata";

// 서버 전용 번역 함수라 테스트에서는 한국어 메시지 파일로 대신한다
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) =>
    key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], ko) as string,
}));

describe("pageMetadata", () => {
  it("화면 이름 뒤에 사이트 이름을 붙인다", async () => {
    expect(await pageMetadata("Nav.songs")).toEqual({ title: "곡 | SRPFreaks" });
    expect(await pageMetadata("Meta.table")).toEqual({ title: "서열표 | SRPFreaks" });
  });
});
