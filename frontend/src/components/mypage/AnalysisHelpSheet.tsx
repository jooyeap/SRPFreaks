"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RATED_CHART_COUNT } from "@/lib/chart-tier";
import { useHistoryClose } from "@/lib/use-history-close";

/** 항목 번호 1~8. 제목·본문 키는 `AnalysisHelp.i{번호}Title` / `i{번호}Body`. */
const ITEMS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
type ItemNo = (typeof ITEMS)[number];

/**
 * 분석 탭의 `?` 버튼과 시트 `어떻게 계산되나요?`(2026-11-13). 항목 8개를 제목만 접어 두고, 누른 항목만 펼친다(여러 개를 동시에 펼쳐도 된다).
 * 문구 안의 줄바꿈(\n)은 번역 파일에 그대로 있고 `white-space: pre-line`으로 보여 준다(`word-break: keep-all`로 단어 중간에서 끊지 않는다).
 * 숫자는 문구에 쓰지 않고 값에서 받아 채운다: {max} = 레이팅 목록 곡 수(상수), {min} = 약점 최소 곡 수(응답의 minChartsPerBand),
 * {n} = 같은 티어 최소 인원(응답의 minBandUsers). 옛 응답처럼 {n}이 없으면 `(기준 {n}명)`이 빠진 문구(`i7BodyNoN`)를 쓴다.
 * 시트는 <dialog> 방식(모바일은 아래 시트, md 이상은 가운데 창)이고, 열려 있는 동안 뒤로 가기를 누르면 시트만 닫힌다(useHistoryClose).
 * 값은 서버가 계산한 것이 아니라 설명 글자뿐이라 계산·저장은 없다.
 */
export function AnalysisHelpSheet({ minCharts, minBandUsers }: { minCharts: number; minBandUsers?: number | null }) {
  const t = useTranslations("AnalysisHelp");
  const tc = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<ItemNo>>(new Set());
  const ref = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useHistoryClose(open, () => setOpen(false));

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function toggle(no: ItemNo) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(no)) {
        next.delete(no);
      } else {
        next.add(no);
      }
      return next;
    });
  }

  const hasN = typeof minBandUsers === "number";
  function body(no: ItemNo): string {
    if (no === 7) {
      return hasN ? t("i7Body", { n: minBandUsers }) : t("i7BodyNoN");
    }
    return t(`i${no}Body`, { max: RATED_CHART_COUNT, min: minCharts });
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={t("openAria")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="-m-3 grid h-11 w-11 shrink-0 place-items-center"
      >
        <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full border border-ctl font-num text-xs font-bold text-fg-dim">
          ?
        </span>
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90vh] w-full max-w-none overflow-y-auto rounded-t-[20px] border border-line bg-card px-5 pb-5 pt-2.5 text-fg backdrop:bg-black/60 md:inset-0 md:m-auto md:max-w-md md:rounded-xl"
      >
        {open ? (
          <>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-chip-line md:hidden" aria-hidden="true" />
            <h2 id={titleId} className="mb-3 text-lg font-extrabold">
              {t("title")}
            </h2>
            <ul className="flex flex-col">
              {ITEMS.map((no) => {
                const isOpen = expanded.has(no);
                const panelId = `${titleId}-p${no}`;
                return (
                  <li key={no} className="border-t border-line first:border-t-0">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => toggle(no)}
                      className="flex min-h-11 w-full items-center gap-2 py-2 text-left"
                    >
                      <span aria-hidden="true" className="w-5 shrink-0 font-num text-sm font-bold text-fg-dim">
                        {no}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-bold text-fg">{t(`i${no}Title`)}</span>
                      <span aria-hidden="true" className="shrink-0 text-fg-dim">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                    {isOpen ? (
                      <div id={panelId} className="pb-3 pl-7">
                        <p className="whitespace-pre-line break-keep text-[13px] leading-[1.75] text-fg-sub">{body(no)}</p>
                        {no === 2 ? <BarFigure /> : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={close} className="flex min-h-11 items-center px-1 text-[13px] text-fg-sub hover:text-fg">
                {tc("close")}
              </button>
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}

/** 항목 2의 작은 그림. 막대 끝 = 내 평균, 흰 선 = 같은 티어 평균. 도형은 장식(aria-hidden)이고 뜻은 아래 글자가 모두 담는다. */
function BarFigure() {
  const t = useTranslations("AnalysisHelp");
  return (
    <div className="mt-2 rounded-xl border border-line bg-table-head p-3">
      <div aria-hidden="true" className="relative h-6 overflow-hidden rounded border border-line bg-card">
        <div style={{ width: "87%" }} className="h-full border-r border-weak bg-weak-tint" />
        <span style={{ left: "89.5%" }} className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-fg" />
      </div>
      <p className="mt-2 text-xs leading-[1.75] text-fg-sub">{t("figEnd")}</p>
      <p className="text-xs leading-[1.75] text-fg-sub">{t("figLine")}</p>
      <p className="mt-1 whitespace-pre-line break-keep font-num text-xs font-bold leading-[1.75] text-fg">{t("figExample")}</p>
    </div>
  );
}
