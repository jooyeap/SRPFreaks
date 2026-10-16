"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RecordForm, type RecordChart } from "@/components/record/RecordForm";
import { RecordList } from "@/components/record/RecordList";
import { formatRate } from "@/lib/format";
import { fetchRecordsOfChart, recordKeys, recordOriginText, type RecordResponse } from "@/lib/records";

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
export function RecordDialog({ chart, onClose }: { chart: RecordChart | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  // 입력 중인 값이 있으면 바깥 클릭으로 닫지 않는다(모바일에서 시트 밖을 잘못 눌러 입력이 사라지는 일 방지)
  const dirtyRef = useRef(false);
  const onDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

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
      onClose={onClose}
      // 창 바깥(::backdrop) 클릭은 dialog 자신이 target이 된다
      onClick={(event) => {
        if (event.target === ref.current && !dirtyRef.current) {
          onClose();
        }
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90vh] w-full max-w-none overflow-y-auto rounded-t-[20px] border border-line bg-card px-5 pb-5 pt-2.5 text-fg backdrop:bg-black/60 md:inset-0 md:m-auto md:max-w-md md:rounded-xl"
    >
      {chart ? (
        <>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-chip-line md:hidden" aria-hidden="true" />
          <RecordDialogBody key={chart.songDifficultyId} chart={chart} onClose={onClose} onDirtyChange={onDirtyChange} />
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
  onDirtyChange,
}: {
  chart: RecordChart;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
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

  return (
    <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="record-dialog-title" className="text-lg font-extrabold">
              {editing ? "기록 수정" : "기록 등록"}
            </h2>
            {/* 이미 기록이 있으면 수정이 기본이다. 새 플레이를 따로 남기고 싶을 때만 `새 기록 추가`로 바꾼다 */}
            {editing ? (
              <button
                type="button"
                onClick={() => setPicked("new")}
                className="min-h-9 shrink-0 rounded-lg border border-chip-line px-3.5 text-sm text-fg-sub hover:text-fg"
              >
                새 기록 추가
              </button>
            ) : hasRecords ? (
              <button
                type="button"
                onClick={() => setPicked(best)}
                className="min-h-9 shrink-0 rounded-lg border border-chip-line px-3.5 text-sm text-fg-sub hover:text-fg"
              >
                기존 기록 수정
              </button>
            ) : null}
          </div>
          <p className="mb-3 text-xs leading-relaxed text-fg-sub">
            {editing
              ? `수정 중인 기록: 달성률 ${formatRate(editing.achievementRate)}${editing.fullCombo ? " · FC" : ""} · ${recordOriginText(editing)}`
              : hasRecords
                ? "새 기록을 등록합니다. 기존 기록은 그대로 남습니다."
                : "이 채보의 첫 기록을 등록합니다."}
          </p>
          <RecordList songDifficultyId={chartId} editingId={editing?.id ?? null} onEdit={setPicked} />
          {loadingRecords ? (
            <p className="text-sm text-fg-sub">불러오는 중입니다.</p>
          ) : (
            // key: 수정 대상이 바뀌면 폼을 새로 만들어 입력 초기값이 맞게 한다
            <RecordForm
              key={editing?.id ?? "new"}
              chart={chart}
              record={editing ?? undefined}
              onSaved={onClose}
              onDeleted={onClose}
              onCancel={onClose}
              onDirtyChange={onDirtyChange}
            />
          )}
    </>
  );
}
