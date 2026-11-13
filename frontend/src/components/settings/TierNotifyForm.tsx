"use client";

import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import type { UserResponse } from "@/lib/api-types";
import { updateMyTierNotify } from "@/lib/users";
import { useTranslations } from "next-intl";

/**
 * `서열표 변경 알림 받기`(D61). 라이벌 알림 스위치(RivalNotifyForm)와 같은 모양이고 누르는 즉시 저장된다.
 * 끄면 새 알림을 만들지 않고, 다시 켜면 그때부터의 변경만 알린다(꺼 둔 동안의 변경은 알리지 않는다).
 * 상태는 스위치 옆 글자(받음 / 받지 않음)로도 보인다.
 */
export function TierNotifyForm({ user }: { user: UserResponse }) {
  const t = useTranslations("Settings");
  const tc = useTranslations("Common");
  const { updateUser } = useAuth();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (next: boolean) => updateMyTierNotify(next),
    onSuccess: (updated) => {
      updateUser(updated);
      toast(t("rivalNotifySaved"));
    },
  });
  const checked = user.tierNotify;
  const failure = mutation.error;
  const message = failure instanceof ApiError ? failure.message : failure ? tc("saveFailed") : null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-bold text-fg-sub">{t("tierNotifyHeading")}</h2>
      <div className="flex items-center justify-between gap-3">
        <span id="tier-notify-label" className="text-sm font-semibold text-fg">
          {t("tierNotifyLabel")}
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="text-xs text-fg-sub">
            {checked ? t("rivalNotifyOn") : t("rivalNotifyOff")}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-labelledby="tier-notify-label"
            aria-describedby="tier-notify-help"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(!checked)}
            className={`relative h-6 w-11 shrink-0 rounded-lg border border-chip-line transition-colors disabled:opacity-50 ${
              checked ? "bg-chip-on-bg" : "bg-table-head"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all ${checked ? "left-5.5 bg-chip-on-fg" : "left-0.5 bg-fg-dim"}`}
            />
          </button>
        </span>
      </div>
      <p id="tier-notify-help" className="text-xs leading-relaxed text-fg-dim">
        {t("tierNotifyHelp")}
      </p>
      <p role="alert" className="min-h-4 text-xs text-danger">
        {message}
      </p>
    </div>
  );
}
