"use client";

import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import type { UserResponse } from "@/lib/api-types";
import { updateMyRivalNotify } from "@/lib/users";
import { useTranslations } from "next-intl";

/**
 * `라이벌 알림 받기`(D56). 누르는 즉시 저장된다(공개 설정과 같은 스위치). 끄면 나에게 오는 역전 알림만 멈춘다.
 * 상태는 스위치 옆 글자(받음 / 받지 않음)로도 보인다.
 */
export function RivalNotifyForm({ user }: { user: UserResponse }) {
  const t = useTranslations("Settings");
  const tc = useTranslations("Common");
  const { updateUser } = useAuth();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (next: boolean) => updateMyRivalNotify(next),
    onSuccess: (updated) => {
      updateUser(updated);
      toast(t("rivalNotifySaved"));
    },
  });
  const checked = user.rivalNotify;
  const failure = mutation.error;
  const message = failure instanceof ApiError ? failure.message : failure ? tc("saveFailed") : null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-bold text-fg-sub">{t("rivalNotifyHeading")}</h2>
      <div className="flex items-center justify-between gap-3">
        <span id="rival-notify-label" className="text-sm font-semibold text-fg">
          {t("rivalNotifyLabel")}
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="text-xs text-fg-sub">
            {checked ? t("rivalNotifyOn") : t("rivalNotifyOff")}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-labelledby="rival-notify-label"
            aria-describedby="rival-notify-help"
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
      <p id="rival-notify-help" className="text-xs leading-relaxed text-fg-dim">
        {t("rivalNotifyHelp")}
      </p>
      <p role="alert" className="min-h-4 text-xs text-danger">
        {message}
      </p>
    </div>
  );
}
