"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { applyTheme, currentTheme } from "@/components/ThemeToggle";
import { LOCALES, saveLocale, type Locale } from "@/i18n/config";
import type { Theme } from "@/lib/theme";

const THEMES: readonly Theme[] = ["light", "dark"];
// 보이는 높이 34px(바깥 상자), 글자 12px. 눌리는 영역은 위아래로 2px씩 넓힌 38px(before 가상 요소도 버튼의 일부라 눌린다)이다.
// 바깥 상자에 overflow-hidden을 쓰면 넓힌 영역이 잘리므로, 둥근 모서리는 양끝 버튼이 직접 가진다.
const SEGMENT_BASE =
  "relative flex h-full flex-1 items-center justify-center whitespace-nowrap px-1 text-xs font-medium before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-[''] first:rounded-l-[7px] last:rounded-r-[7px]";
const SEGMENT_BOX = "flex h-[34px] rounded-lg border border-ctl";
const LABEL_CLASS = "px-0.5 pb-0.5 text-[11px] leading-4 text-fg-dim";

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
    <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-2">
      <div role="group" aria-label={t("theme")} className="min-w-0">
        <div className={LABEL_CLASS}>{t("theme")}</div>
        <div className={SEGMENT_BOX}>
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
        <div className={LABEL_CLASS}>{t("language")}</div>
        <div className={SEGMENT_BOX}>
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
