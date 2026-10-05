"use client";

import { useEffect, useRef, useState } from "react";
import { RecordForm, type RecordChart } from "@/components/record/RecordForm";
import { RecordList } from "@/components/record/RecordList";
import type { RecordResponse } from "@/lib/records";

/**
 * 기록 등록 창. 브라우저 기본 <dialog>를 쓴다.
 * showModal()을 쓰면 브라우저가 (1) 창 밖을 클릭할 수 없게 막고 (2) 포커스를 창 안에 가두고 (3) Esc로 닫는 동작을
 * 직접 처리해 준다. 이 세 가지를 직접 만들면 접근성 버그가 생기기 쉬워서 기본 기능에 맡겼다.
 * 모바일은 아래에서 올라오는 시트, 데스크톱(md 이상)은 가운데 창이다 (DESIGN-UI 10장).
 */
export function RecordDialog({ chart, onClose }: { chart: RecordChart | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  // 수정 중인 기록. 어느 채보의 것인지(chartId)를 함께 들고 있어서, 다른 채보로 열면 이전 채보의 기록이 자동으로 무시된다.
  const chartId = chart?.songDifficultyId ?? null;
  const [editingState, setEditingState] = useState<{ chartId: number; record: RecordResponse } | null>(null);
  const editing = editingState && editingState.chartId === chartId ? editingState.record : null;
  const setEditing = (record: RecordResponse | null) =>
    setEditingState(record && chartId !== null ? { chartId, record } : null);

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
        if (event.target === ref.current) {
          onClose();
        }
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90vh] w-full max-w-none overflow-y-auto rounded-t-xl border border-line bg-card p-4 text-fg backdrop:bg-black/60 md:inset-0 md:m-auto md:max-w-md md:rounded-xl"
    >
      {chart ? (
        <>
          <h2 id="record-dialog-title" className="mb-3 text-lg font-semibold">
            {editing ? "기록 수정" : "기록 등록"}
          </h2>
          <RecordList songDifficultyId={chart.songDifficultyId} editingId={editing?.id ?? null} onEdit={setEditing} />
          {/* key: 수정 대상이 바뀌면 폼을 새로 만들어 입력 초기값이 맞게 한다 */}
          <RecordForm
            key={editing?.id ?? "new"}
            chart={chart}
            record={editing ?? undefined}
            onSaved={onClose}
            onDeleted={onClose}
            onCancel={editing ? () => setEditing(null) : onClose}
          />
        </>
      ) : null}
    </dialog>
  );
}
