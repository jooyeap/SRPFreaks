"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

/**
 * 확인 창 (삭제처럼 되돌릴 수 없는 동작 앞에 둔다). 브라우저 기본 <dialog>(showModal)를 쓴다:
 * 포커스 가두기, Esc로 닫기, 바깥 클릭 막기를 브라우저가 처리해 준다(RecordDialog와 같은 방식).
 * 열려 있을 때만 그린다(닫힌 창의 글자가 화면 읽기 프로그램에 남지 않는다). 취소 버튼에 먼저 포커스를 둬서 Enter로 바로 지워지지 않게 한다.
 * 다른 <dialog> 안에서 써도 된다(위에 겹쳐 열린다). 이 창의 클릭은 바깥 창의 "바깥 클릭" 판정과 겹치지 않는다(target이 다르다).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** 처리 중이면 버튼을 막고 `…중` 글자로 바꾼다 */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Common");
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) {
      return;
    }
    // 일부 환경(테스트용 가짜 브라우저)에는 showModal이 없어서 open 속성으로 대신한다
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    cancelRef.current?.focus();
  }, [open]);

  if (!open) {
    return null;
  }
  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-dialog-title"
      onClose={onCancel}
      onClick={(event) => {
        // 창 바깥(::backdrop) 클릭은 dialog 자신이 target이 된다. 처리 중에는 닫지 않는다
        if (event.target === ref.current && !pending) {
          onCancel();
        }
      }}
      className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-5 text-fg backdrop:bg-black/60"
    >
      <h2 id="confirm-dialog-title" className="text-lg font-extrabold">
        {title}
      </h2>
      <p className="mt-2 text-sm text-fg-sub">{message}</p>
      <div className="mt-5 flex gap-2.5">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="h-11 flex-1 rounded-xl border border-ctl text-sm font-bold text-fg-sub hover:text-fg disabled:opacity-60"
        >
          {t("cancel")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="h-11 flex-1 rounded-xl border border-danger text-sm font-bold text-danger disabled:opacity-60"
        >
          {pending ? t("pendingLabel", { label: confirmLabel }) : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
