import { describe, expect, it } from "vitest";
import { isLocale, localeCookieString, pickLocaleFromAcceptLanguage, resolveLocale } from "@/i18n/config";

describe("언어 정하기", () => {
  it("지원하는 언어만 인정한다", () => {
    expect(isLocale("ko")).toBe(true);
    expect(isLocale("ja")).toBe(true);
    expect(isLocale("en")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("브라우저 언어(Accept-Language)에서 q가 큰 순서로 지원하는 언어를 고른다", () => {
    expect(pickLocaleFromAcceptLanguage("ja,en-US;q=0.9,ko;q=0.8")).toBe("ja");
    expect(pickLocaleFromAcceptLanguage("en-US,en;q=0.9,ja;q=0.5,ko;q=0.8")).toBe("ko"); // ko(0.8) > ja(0.5)
    expect(pickLocaleFromAcceptLanguage("ja-JP")).toBe("ja"); // 지역 표기는 앞부분만 본다
  });

  it("지원하지 않거나 비어 있으면 한국어(기본)다", () => {
    expect(pickLocaleFromAcceptLanguage("en-US,fr;q=0.8")).toBe("ko");
    expect(pickLocaleFromAcceptLanguage("")).toBe("ko");
    expect(pickLocaleFromAcceptLanguage(null)).toBe("ko");
    expect(pickLocaleFromAcceptLanguage("ja;q=0")).toBe("ko"); // q=0은 "원하지 않음"
  });

  it("쿠키가 있으면 쿠키가 우선이고, 값이 이상하면 헤더로 정한다", () => {
    expect(resolveLocale("ko", "ja")).toBe("ko");
    expect(resolveLocale("ja", "ko")).toBe("ja");
    expect(resolveLocale("xx", "ja")).toBe("ja");
    expect(resolveLocale(undefined, "ja")).toBe("ja");
  });

  it("쿠키 문자열은 전체 경로·1년·SameSite=Lax다 (민감 정보가 아니라 httpOnly는 아니다)", () => {
    expect(localeCookieString("ja")).toBe("srp.locale=ja; Path=/; Max-Age=31536000; SameSite=Lax");
  });
});
