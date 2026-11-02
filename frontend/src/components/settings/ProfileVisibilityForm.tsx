"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
import { playerKeys } from "@/lib/players";
import type { UserResponse } from "@/lib/api-types";
import { updateMyVisibility } from "@/lib/users";
import { useTranslations } from "next-intl";

/**
 * 유저 목록 공개 설정 (D26). 기본은 비공개이고 본인이 켠다. 켜는 즉시 저장되고(저장 버튼 없음), 끄면 목록에서 바로 사라진다.
 * 닉네임이 없으면 켤 수 없다(서버도 400으로 막는다). 이미 켜져 있는 경우의 끄기는 막지 않는다.
 */
export function ProfileVisibilityForm({ user }: { user: UserResponse }) {
  const t = useTranslations();
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (next: boolean) => updateMyVisibility(next),
    onSuccess: (updated) => {
      updateUser(updated);
      toast(t("Settings.visibilitySaved"));
      // 공개 여부가 바뀌면 유저 목록 결과도 달라지므로, 받아 둔 목록 캐시를 버린다
      void queryClient.invalidateQueries({ queryKey: playerKeys.all });
    },
  });

  const checked = user.profilePublic;
  const blocked = !checked && user.nickname === null; // 닉네임이 없어서 켤 수 없는 상태
  const failure = mutation.error;
  const message =
    failure instanceof ApiError ? failure.message : failure ? t("Common.saveFailed") : null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-bold text-fg-sub">{t("Settings.visibilityHeading")}</h2>
      <div className="flex items-center justify-between gap-3">
        <span id="visibility-label" className="text-sm font-semibold text-fg">
          {t("Settings.visibilityLabel")}
        </span>
        {/* 색만으로 상태를 전하지 않도록 오른쪽에 글자(공개 / 비공개)를 함께 둔다 */}
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="text-xs text-fg-sub">
            {checked ? t("Settings.visibilityOn") : t("Settings.visibilityOff")}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-labelledby="visibility-label"
            aria-describedby="visibility-help visibility-error"
            disabled={mutation.isPending || blocked}
            onClick={() => mutation.mutate(!checked)}
            className={`relative h-6 w-11 shrink-0 rounded-lg border border-ctl transition-colors disabled:opacity-50 ${
              checked ? "bg-chip-on-bg" : "bg-table-head"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all ${
                checked ? "left-5.5 bg-chip-on-fg" : "left-0.5 bg-fg-dim"
              }`}
            />
          </button>
        </span>
      </div>
      <p id="visibility-help" className="text-xs leading-relaxed text-fg-dim">
        {t("Settings.visibilityHelp")} {t("Settings.visibilityRival")}
      </p>
      {/* 라이벌(D56)로 공개 범위가 넓어졌다는 안내. 지금 공개 중인 사람에게만 보인다 */}
      {checked ? (
        <p className="rounded-lg border border-check-line bg-check-bg px-3 py-2 text-xs leading-relaxed text-check-fg">
          {t("Settings.visibilityChanged")}
        </p>
      ) : null}
      {blocked ? <p className="text-xs text-fg-sub">{t("Settings.needNickname")}</p> : null}
      <p id="visibility-error" role="alert" className="min-h-4 text-xs text-danger">
        {message}
      </p>
    </div>
  );
}
