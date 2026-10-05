import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 테스트가 끝날 때마다 그려 둔 화면을 치운다 (다음 테스트에 영향이 없게)
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});
