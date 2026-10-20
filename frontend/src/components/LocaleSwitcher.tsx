"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LOCALES, saveLocale, type Locale } from "@/i18n/config";

/**
 * 언어 전환 버튼(한국어 ↔ 日本語). 지금 언어가 아닌 쪽 이름을 보여 주고, 누르면 쿠키에 저장한 뒤 화면을 다시 받아 온다.
 * 언어는 주소가 아니라 쿠키(`srp.locale`)로 정하므로 링크·북마크는 그대로 쓰인다(src/i18n/config.ts).
 * router.refresh()는 서버 컴포넌트(<html lang>, 메시지)만 새로 그리고 화면의 입력값·스크롤은 지키므로, 기록 입력 중 눌러도 안전하다.
 * 버튼 글자는 항상 "상대 언어의 자기 이름"이라 언어를 몰라도 찾을 수 있다.
 */
export function LocaleSwitcher() {
  const t = useTranslations("Locale");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const target: Locale = LOCALES.find((candidate) => candidate !== locale) ?? "ko";
  const language = t(target);

  function switchLocale() {
    saveLocale(target);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={switchLocale}
      lang={target}
      aria-label={t("switchTo", { language })}
      title={t("switchTo", { language })}
      className="min-h-9 shrink-0 rounded-lg border border-chip-line px-2.5 text-xs font-medium text-fg-sub hover:text-fg"
    >
      {language}
    </button>
  );
}
