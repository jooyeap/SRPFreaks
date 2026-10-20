import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/config";
import { loadMessages } from "@/i18n/messages";

/**
 * 요청마다 언어와 번역 문구를 정한다(next-intl이 서버에서 부른다).
 * 쿠키를 읽으므로 이 앱의 화면은 요청마다 그려지는(dynamic) 화면이 된다. 대부분 로그인 후 클라이언트에서 데이터를 받는 화면이라 영향이 작다.
 */
export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerStore.get("accept-language"));
  return { locale, messages: loadMessages(locale) };
});
