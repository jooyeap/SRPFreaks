"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { applyTheme, currentTheme } from "@/components/ThemeToggle";
import { LOCALES, saveLocale, type Locale } from "@/i18n/config";
import type { Theme } from "@/lib/theme";

const THEMES: readonly Theme[] = ["light", "dark"];
const SEGMENT_BASE = "flex min-h-11 flex-1 items-center justify-center whitespace-nowrap px-1 text-xs font-medium";

/** 분할 버튼 한 칸. 현재 값은 채워진 배경 + aria-pressed로 알려 색만으로 구분하지 않는다(글자도 그대로 보인다). */
function segmentClass(selected: boolean): string {
  return `${SEGMENT_BASE} ${selected ? "bg-chip-on-bg font-bold text-chip-on-fg" : "text-fg-sub hover:text-fg"}`;
}

/**
 * 더보기 시트(모바일) 맨 아래 설정 띠: [화면 테마: 라이트 | 다크] [언어: 한국어 | 日本語]를 두 칸 나란히 둔다.
 * 이동 메뉴와 설정 줄이 섞이지 않게 시트 아래로 모았고, 로그인 여부와 상관없이 같은 컴포넌트를 쓴다.
 * 전환 로직은 기존 것을 그대로 부른다: 테마는 ThemeToggle의 applyTheme(data-theme + localStorage), 언어는 LocaleSwitcher와 같은 saveLocale + router.refresh().
 * 누르는 즉시 적용되고 저장 버튼은 없다. 시트는 눌렀을 때만 그려져 서버 렌더와 어긋날 일이 없으므로 테마를 상태로 들고 있어도 된다.
 */
export function MoreSettingsStrip() {
  const t = useTranslations("Nav");
  const tc = useTranslations("Common");
  const tl = useTranslations("Locale");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>(() => currentTheme());

  function chooseTheme(next: Theme) {
    applyTheme(next);
    setTheme(next);
  }

  function chooseLocale(next: Locale) {
    if (next === locale) {
      return;
    }
    saveLocale(next);
    router.refresh();
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
      <div role="group" aria-label={t("theme")} className="min-w-0">
        <div className="px-0.5 pb-1 text-[11px] text-fg-dim">{t("theme")}</div>
        <div className="flex overflow-hidden rounded-lg border border-ctl">
          {THEMES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => chooseTheme(value)}
              className={segmentClass(theme === value)}
            >
              {tc(value === "light" ? "themeLight" : "themeDark")}
            </button>
          ))}
        </div>
      </div>
      <div role="group" aria-label={t("language")} className="min-w-0">
        <div className="px-0.5 pb-1 text-[11px] text-fg-dim">{t("language")}</div>
        <div className="flex overflow-hidden rounded-lg border border-ctl">
          {LOCALES.map((value) => (
            <button
              key={value}
              type="button"
              lang={value}
              aria-pressed={locale === value}
              onClick={() => chooseLocale(value)}
              className={segmentClass(locale === value)}
            >
              {tl(value)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
