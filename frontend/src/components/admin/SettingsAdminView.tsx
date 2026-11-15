"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/Toast";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import type { SettingResponse } from "@/lib/api-types";
import {
  adminKeys,
  fetchSettings,
  SETTING_AFFECTED_KEYS,
  SETTING_GROUPS,
  settingGroup,
  settingMeta,
  updateSetting,
  validateSettingValue,
  type SettingGroup,
} from "@/lib/admin";
import type { Translator } from "@/i18n/translator";
import { formatPlayedDate } from "@/lib/format";
import { useTranslations } from "next-intl";
import { AdminBackLink } from "@/components/admin/AdminBackLink";

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-fg";
const CHIP = "min-h-11 rounded-full border px-4 text-sm font-bold";
const CHIP_ON = "border-transparent bg-chip-on-bg text-chip-on-fg";
const CHIP_OFF = "border-ctl text-fg-sub hover:text-fg";

/** 묶음 칩의 화면 이름. */
function groupLabel(group: SettingGroup, t: Translator): string {
  switch (group) {
    case "rating":
      return t("Admin.settingsGroupRating");
    case "list":
      return t("Admin.settingsGroupList");
    case "peer":
      return t("Admin.settingsGroupPeer");
    case "setlistRival":
      return t("Admin.settingsGroupSetlistRival");
    default:
      return t("Admin.settingsGroupOther");
  }
}

/**
 * 운영 설정 (ROOT 전용). 레이팅 계수, 재킷 표시, 연락처를 바꾼다.
 * 서버는 바꾼 값으로 레이팅 계산 설정을 실제로 만들어 보고 저장하므로(계산에 쓸 수 없는 값은 거절),
 * 화면은 숫자/정수/켬·끔 같은 뻔한 실수만 먼저 막는다. 레이팅 설정을 바꾸면 모든 사용자의 점수가 달라진다.
 */
export function SettingsAdminView({ viewerId }: { viewerId: number }) {
  const t = useTranslations();
  // 묶음 칩은 받아 온 설정을 화면에서 거르기만 한다(서버 요청은 그대로). ""는 전체.
  const [group, setGroup] = useState<SettingGroup | "">("");
  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.settings(viewerId),
    queryFn: ({ signal }) => fetchSettings(signal),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <AdminBackLink />
        <h1 className="text-xl font-semibold text-fg">{t("Admin.settingsTitle")}</h1>
        <p className="text-sm text-fg-sub">
          {t("Admin.settingsLead")}
        </p>
      </div>

      <div role="group" aria-label={t("Admin.settingsGroupAria")} className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={group === ""} onClick={() => setGroup("")} className={`${CHIP} ${group === "" ? CHIP_ON : CHIP_OFF}`}>
          {t("Admin.settingsGroupAll")}
        </button>
        {SETTING_GROUPS.map((g) => (
          <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)} className={`${CHIP} ${group === g ? CHIP_ON : CHIP_OFF}`}>
            {groupLabel(g, t)}
          </button>
        ))}
      </div>

      {isPending ? (
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-fg">
          {error instanceof ApiError ? error.message : t("Admin.settingsLoadFailed")}
        </p>
      ) : (
        <ul aria-label={t("Admin.settingsListAria")} className="flex flex-col gap-3">
          {data.content
            .filter((setting) => group === "" || settingGroup(setting.key) === group)
            .map((setting) => (
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
    <li className={`flex flex-col gap-2 rounded-2xl border p-4 ${changed ? "border-chip-on-bg bg-table-head" : "border-line bg-card"}`}>
      <div className="flex flex-col gap-0.5">
        <label htmlFor={inputId} className="text-sm font-bold text-fg">
          {label}
        </label>
        <p className="font-num text-xs text-fg-dim">{setting.key}</p>
        {description ? <p className="text-xs text-fg-sub">{description}</p> : null}
      </div>
      {/* 값을 바꾸는 중이면 그 카드만 강조하고 이전 값 → 새 값을 글자로 보여 준다(색만으로 알리지 않는다). 저장하면 사라진다 */}
      {changed ? (
        <p className="font-num text-xs font-bold text-fg">
          {t("Admin.settingChanging", { from: displayValue(setting.value, meta.kind, t), to: displayValue(value.trim(), meta.kind, t) })}
        </p>
      ) : null}
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

/** 변경 표시에 보여 줄 값. 켬/끔 설정은 true/false 대신 화면 이름(켬/끔)으로 보여 준다. */
function displayValue(value: string, kind: string, t: Translator): string {
  if (kind === "boolean") {
    if (value === "true") return t("Admin.on");
    if (value === "false") return t("Admin.off");
  }
  return value;
}
