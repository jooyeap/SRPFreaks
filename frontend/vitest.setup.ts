import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { createTranslator } from "use-intl/core";
import { afterEach, vi } from "vitest";
import ko from "./messages/ko.json";
import { resetOpenKeysForTest } from "./src/lib/open-keys";

// 화면 컴포넌트는 next-intl의 useTranslations를 쓴다. 테스트에서는 Provider 없이도 한국어 문구가 나오도록, 한국어 원본(messages/ko.json)으로
// 번역하는 가짜를 끼운다. 그래서 기존 테스트의 "한국어 글자로 찾기"는 그대로 동작한다. 일본어 화면은 locale.test.tsx처럼 Provider로 따로 확인한다.
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => createTranslator({ locale: "ko", messages: ko, namespace } as never),
  useLocale: () => "ko",
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
}));

// 테스트가 끝날 때마다 그려 둔 화면을 치운다 (다음 테스트에 영향이 없게)
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
  sessionStorage.clear();
  resetOpenKeysForTest(); // 펼친 폴더 기억(lib/open-keys.ts)이 다음 테스트로 새지 않게
});
