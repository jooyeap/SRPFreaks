/**
 * 다국어 설정(한국어 · 일본어). 서버/브라우저 어디서나 쓰는 순수 값과 함수만 둔다.
 *
 * 언어는 주소(/ja/...)가 아니라 쿠키로 고른다. 주소에 언어를 넣으면 기존 링크, PWA 홈 화면 아이콘, 로그인 쿠키 경로(Path=/api/v1/auth)가
 * 모두 영향을 받기 때문이다. 쿠키에 값이 없으면(첫 방문) 브라우저 언어(Accept-Language)로 정한다.
 */
export const LOCALES = ["ko", "ja"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ko";

/** 언어를 저장하는 쿠키 이름. 민감한 값이 아니라서 JS에서 읽고 써도 된다(httpOnly 아님). */
export const LOCALE_COOKIE = "srp.locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Accept-Language 헤더(예: `ja,en-US;q=0.9,ko;q=0.8`)에서 지원하는 언어를 고른다.
 * q 값이 큰 순서로 보고, 지원하는 첫 언어를 쓴다. 지역 표기(ja-JP)는 앞부분(ja)만 본다. 없으면 기본 언어(한국어).
 */
export function pickLocaleFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) {
    return DEFAULT_LOCALE;
  }
  const candidates = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const q = qParam ? Number(qParam.slice(2)) : 1;
      return { language: tag.trim().toLowerCase().split("-")[0], q: Number.isNaN(q) ? 0 : q, index };
    })
    .filter((c) => c.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { language } of candidates) {
    if (isLocale(language)) {
      return language;
    }
  }
  return DEFAULT_LOCALE;
}

/** 쿠키 값과 헤더로 이번 요청의 언어를 정한다. 쿠키가 우선이다. */
export function resolveLocale(cookieValue: string | undefined, acceptLanguage: string | null | undefined): Locale {
  return isLocale(cookieValue) ? cookieValue : pickLocaleFromAcceptLanguage(acceptLanguage);
}

/** 브라우저에서 언어 쿠키를 쓴다(1년). 로그인 정보가 아니므로 SameSite=Lax면 충분하다. */
export function localeCookieString(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

/** 브라우저에서 고른 언어를 쿠키에 저장한다. 화면 컴포넌트가 document를 직접 고치지 않게 여기로 뺐다. */
export function saveLocale(locale: Locale): void {
  document.cookie = localeCookieString(locale);
}
