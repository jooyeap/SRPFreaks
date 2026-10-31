"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import type { SettingResponse } from "@/lib/api-types";
import { adminKeys, fetchSettings, SETTING_AFFECTED_KEYS, settingMeta, updateSetting, validateSettingValue } from "@/lib/admin";
import { formatPlayedDate } from "@/lib/format";
import { useTranslations } from "next-intl";
import { BACK_BUTTON_CLASS, BackArrow } from "@/components/BackArrow";

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-fg";

/**
 * 운영 설정 (ROOT 전용). 레이팅 계수, 재킷 표시, 연락처를 바꾼다.
 * 서버는 바꾼 값으로 레이팅 계산 설정을 실제로 만들어 보고 저장하므로(계산에 쓸 수 없는 값은 거절),
 * 화면은 숫자/정수/켬·끔 같은 뻔한 실수만 먼저 막는다. 레이팅 설정을 바꾸면 모든 사용자의 점수가 달라진다.
 */
export function SettingsAdminView({ viewerId }: { viewerId: number }) {
  const t = useTranslations();
  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.settings(viewerId),
    queryFn: ({ signal }) => fetchSettings(signal),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/admin" aria-label={t("Admin.backAria")} title={t("Admin.backAria")} className={BACK_BUTTON_CLASS}>
          <BackArrow />
        </Link>
        <h1 className="text-xl font-semibold text-fg">{t("Admin.settingsTitle")}</h1>
        <p className="text-sm text-fg-sub">
          {t("Admin.settingsLead")}
        </p>
      </div>

      {isPending ? (
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-fg">
          {error instanceof ApiError ? error.message : t("Admin.settingsLoadFailed")}
        </p>
      ) : (
        <ul aria-label={t("Admin.settingsListAria")} className="flex flex-col gap-3">
          {data.content.map((setting) => (
            <SettingRow key={setting.key} setting={setting} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SettingRow({ setting }: { setting: SettingResponse }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const meta = settingMeta(setting.key);
  const label = meta.label ? t(meta.label) : setting.key;
  const description = meta.description ? t(meta.description) : "";
  const [value, setValue] = useState(setting.value);
  const [invalid, setInvalid] = useState<string | null>(null);
  const inputId = `setting-${setting.key}`;

  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (next: string) => updateSetting(setting.key, next),
    onSuccess: async (saved) => {
      setValue(saved.value);
      toast(t("Admin.settingSaved"));
      await Promise.all(SETTING_AFFECTED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });

  const changed = value.trim() !== setting.value;
  const serverMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? t("Common.saveFailed")
        : null;

  const submit = () => {
    const problem = validateSettingValue(setting.key, value, t);
    setInvalid(problem);
    if (problem === null) {
      mutation.mutate(value.trim());
    }
  };

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={inputId} className="text-sm font-bold text-fg">
          {label}
        </label>
        <p className="font-num text-xs text-fg-dim">{setting.key}</p>
        {description ? <p className="text-xs text-fg-sub">{description}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {meta.kind === "boolean" ? (
          <select id={inputId} value={value} onChange={(e) => setValue(e.target.value)} className={FIELD}>
            <option value="true">{t("Admin.on")}</option>
            <option value="false">{t("Admin.off")}</option>
          </select>
        ) : meta.kind === "choice" ? (
          <select id={inputId} value={value} onChange={(e) => setValue(e.target.value)} className={FIELD}>
            {(meta.choices ?? []).map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={inputId}
            type="text"
            inputMode={meta.kind === "text" ? "text" : "decimal"}
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={invalid ? true : undefined}
            className={`${FIELD} min-w-0 flex-1 font-num`}
          />
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!changed || mutation.isPending}
          aria-label={t("Admin.settingSaveAria", { label })}
          className="h-10 rounded-xl bg-chip-on-bg px-5 text-sm font-extrabold text-chip-on-fg disabled:opacity-40"
        >
          {mutation.isPending ? t("Common.saving") : t("Common.save")}
        </button>
      </div>
      {invalid ? (
        <p role="alert" className="text-sm text-fg">
          {invalid}
        </p>
      ) : null}
      {serverMessage ? (
        <p role="alert" className="text-sm text-fg">
          {t("Admin.settingRejected", { message: serverMessage })}
        </p>
      ) : null}
      <p className="text-xs text-fg-dim">
        {t.rich("Admin.lastChanged", {
          who: setting.updatedByNickname ?? t("Admin.initialValue"),
          date: formatPlayedDate(setting.updatedAt),
          n: (c) => <span className="font-num">{c}</span>,
        })}
      </p>
    </li>
  );
}
