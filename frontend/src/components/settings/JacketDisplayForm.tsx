"use client";

import { setShowJackets, useJacketsEnabled, useShowJacketsSetting } from "@/lib/jackets";
import { useTranslations } from "next-intl";

/**
 * 개인 설정 `재킷 표시`(D54, 기본 켜짐). 이 기기 브라우저에만 저장한다(한 손 모드처럼 서버에 보내지 않는다).
 * 운영 설정 `ui.show_song_images`가 꺼져 있으면 재킷이 아무에게도 보이지 않으므로 이 칸도 그리지 않는다.
 */
export function JacketDisplayForm() {
  const t = useTranslations("Settings");
  const enabled = useJacketsEnabled();
  const checked = useShowJacketsSetting();
  if (!enabled) return null;
  return (
    <section aria-label={t("jacketHeading")} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="text-xs font-bold text-fg-sub">{t("jacketHeading")}</h2>
      <div className="flex items-center justify-between gap-3">
        <span id="jacket-label" className="text-sm font-semibold text-fg">
          {t("jacketLabel")}
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="text-xs text-fg-sub">
            {checked ? t("jacketOn") : t("jacketOff")}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-labelledby="jacket-label"
            aria-describedby="jacket-help"
            onClick={() => setShowJackets(!checked)}
            className={`relative h-6 w-11 shrink-0 rounded-lg border border-chip-line transition-colors ${checked ? "bg-chip-on-bg" : "bg-table-head"}`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all ${checked ? "left-5.5 bg-chip-on-fg" : "left-0.5 bg-fg-dim"}`}
            />
          </button>
        </span>
      </div>
      <p id="jacket-help" className="text-xs leading-relaxed text-fg-dim">
        {t("jacketHelp")}
      </p>
    </section>
  );
}
