import type { Locale } from "@/i18n/config";
import ja from "../../messages/ja.json";
import ko from "../../messages/ko.json";

/** 한국어가 원본이다. 일본어는 같은 키를 가져야 하고(i18n.test.ts가 확인한다), 없는 키는 한국어로 보인다. */
export type Messages = typeof ko;

export function loadMessages(locale: Locale): Messages {
  return locale === "ja" ? (ja as Messages) : ko;
}
