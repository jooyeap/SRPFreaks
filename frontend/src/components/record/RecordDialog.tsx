"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { RecentCharts } from "@/components/record/RecentCharts";
import { RecordForm, type RecordChart } from "@/components/record/RecordForm";
import { SaveResultCard, type SaveOutcome } from "@/components/record/SaveResultCard";
import { RecordList } from "@/components/record/RecordList";
import { formatRate } from "@/lib/format";
import { useWakeLock } from "@/lib/wake-lock";
import { fetchRecordsOfChart, recordKeys, recordOriginText, type RecordResponse } from "@/lib/records";
import { useTranslations } from "next-intl";

/** 달성률이 가장 높은 기록(서열표에 보이는 기록). 같으면 목록 앞(더 최근) */
function bestOf(records: readonly RecordResponse[] | undefined): RecordResponse | null {
  return (records ?? []).reduce<RecordResponse | null>(
    (best, r) => (best === null || r.achievementRate > best.achievementRate ? r : best),
    null,
  );
}

/**
 * 기록 등록 창. 브라우저 기본 <dialog>를 쓴다.
 * showModal()을 쓰면 브라우저가 (1) 창 밖을 클릭할 수 없게 막고 (2) 포커스를 창 안에 가두고 (3) Esc로 닫는 동작을
 * 직접 처리해 준다. 이 세 가지를 직접 만들면 접근성 버그가 생기기 쉬워서 기본 기능에 맡겼다.
 * 모바일은 아래에서 올라오는 시트, 데스크톱(md 이상)은 가운데 창이다 (DESIGN-UI 10장).
 */
export function RecordDialog({
  chart,
  onClose,
  nextChartAfterSave,
}: {
  chart: RecordChart | null;
  onClose: () => void;
  /**
   * 저장한 뒤 이어서 입력할 다음 채보를 돌려주면 창을 닫지 않고 그 채보로 바꾼다(한 손 모드에서 세트리스트를 차례로 입력할 때).
   * 생략하거나 null을 돌려주면 평소처럼 창을 닫는다. 삭제는 항상 창을 닫는다.
   */
  nextChartAfterSave?: (saved: RecordChart) => RecordChart | null;
}) {
  const t = useTranslations();
  const ref = useRef<HTMLDialogElement>(null);
  // 입력 중인 값이 있으면 바깥 클릭으로 닫지 않는다(모바일에서 시트 밖을 잘못 눌러 입력이 사라지는 일 방지)
  const dirtyRef = useRef(false);
  const onDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);
  const toast = useToast();
  // "최근 입력한 곡"으로 옮겨 간 채보. 창을 닫으면 비워서 다음에 열 때는 부모가 준 채보로 열린다
  const [switched, setSwitched] = useState<RecordChart | null>(null);
  // 저장 직후 결과 카드. 세트리스트로 이어 입력할 때(다음 채보가 있을 때)는 흐름을 끊지 않으려고 카드 없이 바로 넘어간다
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const active = chart ? (switched ?? chart) : null;
  // 기록 창이 열려 있는 동안 화면이 꺼지지 않게 한다(게임 사이에 달성률을 옮겨 적는 동안)
  useWakeLock(active !== null);
  const close = useCallback(() => {
    setSwitched(null);
    setOutcome(null);
    onClose();
  }, [onClose]);
  const handleSaved = useCallback(
    (_saved: RecordResponse, result: SaveOutcome) => {
      const next = active && nextChartAfterSave ? nextChartAfterSave(active) : null;
      if (next) {
        // 저장이 끝나 입력 중인 값이 없으므로 바로 바꾼다 (RecordDialogBody의 key가 바뀌어 폼이 새로 만들어진다)
        setSwitched(next);
      } else {
        // 창을 닫지 않고 같은 창에서 결과를 보여 준다. 입력 중인 값은 없다(저장됨)
        dirtyRef.current = false;
        setOutcome(result);
      }
    },
    [active, nextChartAfterSave],
  );
  const switchTo = useCallback(
    (next: RecordChart) => {
      // 입력 중인 값이 있으면 옮기지 않는다 (바깥 클릭으로 닫히지 않게 하는 것과 같은 이유)
      if (dirtyRef.current) {
        toast(t("Record.hasInput"));
        return;
      }
      setSwitched(next);
    },
    [toast, t],
  );

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (chart && !dialog.open) {
      // 일부 환경(테스트용 가짜 브라우저)에는 showModal이 없어서 open 속성으로 대신한다
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
      // 열 때 달성률 칸으로 커서를 둔다(브라우저 기본은 첫 버튼). 폼이 아직 없으면(기록을 불러오는 중) 폼이 직접 맞춘다
      dialog.querySelector<HTMLInputElement>("#achievementRate")?.focus();
    } else if (!chart && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [chart]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="record-dialog-title"
      // Esc(cancel 이벤트)와 닫힘(close 이벤트) 모두 부모 상태를 맞춘다
      onClose={close}
      // 창 바깥(::backdrop) 클릭은 dialog 자신이 target이 된다
      onClick={(event) => {
        if (event.target === ref.current && !dirtyRef.current) {
          close();
        }
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90vh] w-full max-w-none overflow-y-auto rounded-t-[20px] border border-line bg-card px-5 pb-5 pt-2.5 text-fg backdrop:bg-black/60 md:inset-0 md:m-auto md:max-w-md md:rounded-xl"
    >
      {active ? (
        <>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-chip-line md:hidden" aria-hidden="true" />
          {outcome ? (
            <SaveResultCard outcome={outcome} onClose={close} />
          ) : (
            <>
              <RecentCharts currentChartId={active.songDifficultyId} onPick={switchTo} />
              <RecordDialogBody key={active.songDifficultyId} chart={active} onClose={close} onSaved={handleSaved} onDirtyChange={onDirtyChange} />
            </>
          )}
        </>
      ) : null}
    </dialog>
  );
}

/**
 * 창 안쪽(제목 줄 + 기록 목록 + 폼). chart가 있을 때만 그려져서 AuthProvider·쿼리가 필요한 코드는 여기에만 있다.
 * 어느 기록을 고치는지(picked)는 이 컴포넌트의 상태라서 창이 닫히거나 다른 채보로 열리면(key) 저절로 초기화된다.
 * 기록이 이미 있으면 가장 높은 기록(서열표에 보이는 것)의 수정으로 바로 열린다:
 * "새 기록 추가"로 낮은 값을 넣어도 서열표에는 높은 기록이 남아서 "수정이 안 된다"고 느끼기 때문이다.
 */
function RecordDialogBody({
  chart,
  onClose,
  onSaved,
  onDirtyChange,
}: {
  chart: RecordChart;
  onClose: () => void;
  onSaved: (saved: RecordResponse, outcome: SaveOutcome) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const t = useTranslations();
  const chartId = chart.songDifficultyId;
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const [picked, setPicked] = useState<RecordResponse | "new" | null>(null);
  const records = useQuery({
    queryKey: recordKeys.ofChart(userId, chartId),
    queryFn: ({ signal }) => fetchRecordsOfChart(chartId, signal),
    enabled: user !== null,
  });
  const loadingRecords = user !== null && records.isPending; // 불러오는 동안 폼을 먼저 그리면 입력이 사라진다
  const best = bestOf(records.data?.content);
  const editing = picked === "new" ? null : (picked ?? best);
  const hasRecords = (records.data?.content.length ?? 0) > 0;
  // 이미 기록이 있는 채보는 폼 전에 "기존 기록 수정 / 새 기록 등록"을 먼저 고르게 한다(고르기 전에는 폼이 없다)
  const choosing = picked === null && hasRecords && !loadingRecords;

  return (
    <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="record-dialog-title" className="text-lg font-extrabold">
              {choosing ? t("Record.dialogAdd") : editing ? t("Record.dialogEdit") : t("Record.dialogAdd")}
            </h2>
            {/* 이미 기록이 있으면 수정이 기본이다. 새 플레이를 따로 남기고 싶을 때만 `새 기록 추가`로 바꾼다 */}
            {choosing ? null : editing ? (
              <button
                type="button"
                onClick={() => setPicked("new")}
                className="min-h-9 shrink-0 rounded-lg border border-chip-line px-3.5 text-sm text-fg-sub hover:text-fg"
              >
                {t("Record.addNew")}
              </button>
            ) : hasRecords ? (
              <button
                type="button"
                onClick={() => setPicked(best)}
                className="min-h-9 shrink-0 rounded-lg border border-chip-line px-3.5 text-sm text-fg-sub hover:text-fg"
              >
                {t("Record.editExisting")}
              </button>
            ) : null}
          </div>
          <p className="mb-3 text-xs leading-relaxed text-fg-sub">
            {choosing
              ? t("Record.alreadyHas")
              : editing
              ? t("Record.editingBanner", { rate: formatRate(editing.achievementRate), fc: editing.fullCombo ? " · FC" : "", origin: recordOriginText(editing, t) })
              : hasRecords
                ? t("Record.newKeepsOld")
                : t("Record.firstRecord")}
          </p>
          {choosing && best ? (
            <div className="mb-3 flex flex-col gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setPicked(best)}
                className="flex min-h-14 flex-col items-start justify-center rounded-lg border border-chip-on-bg px-4 py-2 text-left hover:bg-chip-on-bg/10"
              >
                <span className="text-sm font-semibold text-fg">{t("Record.editExisting")}</span>
                <span className="text-xs text-fg-sub">
                  {t("Record.bestRecord", { rate: formatRate(best.achievementRate), fc: best.fullCombo ? " · FC" : "", origin: recordOriginText(best, t) })}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPicked("new")}
                className="flex min-h-14 flex-col items-start justify-center rounded-lg border border-chip-line px-4 py-2 text-left hover:bg-chip-on-bg/10"
              >
                <span className="text-sm font-semibold text-fg">{t("Record.registerNew")}</span>
                <span className="text-xs text-fg-sub">{t("Record.newPlayNote")}</span>
              </button>
            </div>
          ) : null}
          <RecordList songDifficultyId={chartId} editingId={editing?.id ?? null} onEdit={setPicked} />
          {choosing ? null : loadingRecords ? (
            <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
          ) : (
            // key: 수정 대상이 바뀌면 폼을 새로 만들어 입력 초기값이 맞게 한다
            <RecordForm
              key={editing?.id ?? "new"}
              chart={chart}
              record={editing ?? undefined}
              userId={user?.id}
              onSaved={onSaved}
              onDeleted={onClose}
              onCancel={onClose}
              onDirtyChange={onDirtyChange}
            />
          )}
    </>
  );
}
