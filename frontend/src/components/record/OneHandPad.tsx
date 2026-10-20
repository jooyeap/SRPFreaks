"use client";

import { padInput, type PadKey } from "@/lib/one-hand";
import { useTranslations } from "next-intl";

const KEYS: readonly PadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

const KEY_CLASS =
  "flex h-14 items-center justify-center rounded-2xl border border-line bg-card font-num text-2xl font-bold text-fg active:bg-table-head";

/**
 * 한 손 입력 모드의 숫자 패드와 풀콤보 버튼 (DESIGN-UI 10장). 화면 아래쪽에 놓여 엄지로 누르기 쉽다.
 * 달성률 글자는 부모(RecordForm)가 들고 있고, 누를 때마다 padInput으로 다음 글자를 만들어 onChange로 돌려준다.
 * 풀콤보는 켜짐/꺼짐을 글자(`켜짐`/`꺼짐`)로도 보여 주고 aria-pressed로 알린다(색만으로 구분하지 않는다).
 * 달성률 100.00이면 풀콤보가 자동으로 켜져 있으므로(D9) 버튼을 막고 이유를 적는다.
 */
export function OneHandPad({
  value,
  onChange,
  fullCombo,
  fullComboLocked,
  onToggleFullCombo,
}: {
  value: string;
  onChange: (next: string) => void;
  fullCombo: boolean;
  fullComboLocked: boolean;
  onToggleFullCombo: () => void;
}) {
  const t = useTranslations();
  return (
    <div aria-label={t("Record.oneHandAria")} role="group" className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-label={key === "back" ? t("Record.backspace") : key === "." ? t("Record.decimalPoint") : key}
            onClick={() => onChange(padInput(value, key))}
            className={KEY_CLASS}
          >
            {key === "back" ? "⌫" : key}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={fullCombo}
        disabled={fullComboLocked}
        onClick={onToggleFullCombo}
        className="flex h-14 items-center justify-between rounded-2xl border border-line bg-card px-4 text-base font-bold text-fg disabled:opacity-70 aria-pressed:border-chip-on-bg aria-pressed:bg-chip-on-bg/10"
      >
        <span>{t("Record.fullCombo")}</span>
        <span className="font-num text-sm">{fullCombo ? t("Record.on") : t("Record.off")}</span>
      </button>
      {fullComboLocked ? <p className="text-xs text-fg-dim">{t("Record.fullComboNote")}</p> : null}
    </div>
  );
}
