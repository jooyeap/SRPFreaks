"use client";

import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { SongDeleteControl } from "@/components/song/SongDeleteControl";
import { useHistoryClose } from "@/lib/use-history-close";
import { useExitPresence, useHeldWhileOpen } from "@/lib/use-exit-presence";

const ROW = "min-h-11 w-full rounded-lg border border-ctl px-3 py-2 text-left text-sm text-fg hover:bg-table-head";

/**
 * 곡 상세의 `관리` 창(ROOT·ADMIN 전용, 부모가 role을 보고 연다. 서버도 권한을 다시 검사한다).
 * 예전에는 서열표 값 수정·곡 정보 수정·채보 수정·채보 삭제·곡 삭제 버튼이 화면에 줄줄이 있었는데, 여기 한 곳으로 모았다.
 * 수정 항목을 누르면 이 창은 닫히고 각각의 수정 창이 열린다(창 위에 창을 겹치지 않는다).
 * 삭제는 SongDeleteControl이 이 창 안에서 확인 문구를 먼저 보여 준다.
 */
export function SongManageDialog({
  open,
  onClose,
  tableEditLabel,
  onEditTable,
  onEditSong,
  onEditChart,
  onAddChart,
  onEditJacket = null,
  songId,
  songTitle,
  chartId,
  chartLabel,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  /** 서열표 값 수정(또는 `서열표에 추가`) 항목의 글자. null이면 이 항목을 숨긴다(서열표를 못 받았거나 채보가 없을 때) */
  tableEditLabel: string | null;
  onEditTable: () => void;
  onEditSong: () => void;
  /** null이면 `채보 수정` 항목을 숨긴다(보고 있는 채보가 없을 때) */
  onEditChart: (() => void) | null;
  /** null이면 `채보 추가` 항목을 숨긴다(파트·난이도 8가지가 이미 모두 있을 때) */
  onAddChart: (() => void) | null;
  /** ROOT일 때만 넘긴다(2026-11-02). 있으면 `재킷 바꾸기` 항목을 보여 준다 */
  onEditJacket?: (() => void) | null;
  songId: number;
  songTitle: string;
  chartId: number | null;
  chartLabel: string | null;
  onDeleted: (target: "song" | "chart") => void;
}) {
  const t = useTranslations();
  const ref = useRef<HTMLDialogElement>(null);
  // 뒤로 가기를 누르면 이 창만 닫힌다(lib/history-layers.ts)
  useHistoryClose(open, onClose);
  // 닫힘 모션(D82, 모션 PR 4): open이 false가 된 뒤에도 나가는 모션이 끝날 때까지 창을 남긴다. history·포커스 판단은 계속 open 기준이다
  const exit = useExitPresence(open, { onRequestClose: onClose });
  // 부모가 닫으면서 값을 비워도(채보 없음 등) 나가는 동안은 열려 있던 모양 그대로 둔다. 함수는 매 렌더 새로 만들어지므로 붙잡지 않고(무한 렌더가 된다) 있는지 여부만 붙잡는다
  const held = useHeldWhileOpen(open, {
    tableEditLabel,
    hasEditChart: onEditChart !== null,
    hasAddChart: onAddChart !== null,
    hasEditJacket: !!onEditJacket,
    songId,
    songTitle,
    chartId,
    chartLabel,
  });
  const noop = () => {};
  const titleId = useId();

  // 다른 창들과 같은 방식: 열림 상태를 <dialog>의 showModal/close에 맞춘다
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (exit.present && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    } else if (!exit.present && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [exit.present]);

  // 수정 창을 열기 전에 이 창부터 닫는다
  const pick = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      {...exit.dialogProps}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90vh] w-full max-w-none overflow-y-auto rounded-t-[20px] border border-line bg-card px-5 pb-5 pt-2.5 text-fg backdrop:bg-black/60 md:inset-0 md:m-auto md:max-w-md md:rounded-xl"
    >
      {exit.present ? (
        <>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-chip-line md:hidden" aria-hidden="true" />
          <h2 id={titleId} className="mb-3 text-lg font-extrabold">
            {t("Song.manageTitle")}
          </h2>
          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-2" aria-label={t("Song.manageEditHeading")}>
              <h3 className="text-xs font-bold text-fg-sub">{t("Song.manageEditHeading")}</h3>
              {held.tableEditLabel !== null ? (
                <button type="button" onClick={pick(onEditTable)} className={ROW}>
                  {held.tableEditLabel}
                </button>
              ) : null}
              <button type="button" onClick={pick(onEditSong)} className={ROW}>
                {t("Song.editSong")}
              </button>
              {held.hasAddChart ? (
                <button type="button" onClick={pick(onAddChart ?? noop)} className={ROW}>
                  {t("Song.addChart")}
                </button>
              ) : null}
              {held.hasEditChart ? (
                <button type="button" onClick={pick(onEditChart ?? noop)} className={ROW}>
                  {t("Song.editChart")}
                </button>
              ) : null}
              {held.hasEditJacket ? (
                <button type="button" onClick={pick(onEditJacket ?? noop)} className={ROW}>
                  {t("Song.editJacket")}
                </button>
              ) : null}
            </section>
            <section className="flex flex-col gap-2" aria-label={t("Song.manageDeleteHeading")}>
              <h3 className="text-xs font-bold text-fg-sub">{t("Song.manageDeleteHeading")}</h3>
              <SongDeleteControl
                songId={held.songId}
                songTitle={held.songTitle}
                chartId={held.chartId}
                chartLabel={held.chartLabel}
                onDeleted={(target) => {
                  onClose();
                  onDeleted(target);
                }}
              />
            </section>
          </div>
          <button type="button" onClick={onClose} className="mt-4 h-12 w-full rounded-xl border border-ctl text-sm font-bold text-fg-sub hover:text-fg">
            {t("Common.close")}
          </button>
        </>
      ) : null}
    </dialog>
  );
}
