"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Role } from "@/lib/api-types";
import { ASSIGNABLE_ROLES, roleLabel } from "@/lib/admin";
import { useHistoryClose } from "@/lib/use-history-close";
import { useExitPresence } from "@/lib/use-exit-presence";

/**
 * 역할 변경 작은 창 (데스크톱 사용자 표, D79). 브라우저 기본 <dialog>(showModal)를 쓴다(ConfirmDialog와 같은 방식).
 * 고를 수 있는 역할은 USER·ADMIN뿐이고(ROOT 지정 없음), 지금 역할과 같으면 저장 버튼이 막혀 있다.
 * 저장하면 부르는 쪽이 기존 역할 변경 요청(PATCH /admin/users/{id}/role)을 보낸다. 요청·권한·검사는 그대로다.
 */
export function RoleChangeDialog({
  open,
  name,
  current,
  pending,
  error,
  onSave,
  onCancel,
}: {
  open: boolean;
  name: string;
  current: Role;
  pending: boolean;
  error: string | null;
  onSave: (role: Role) => void;
  onCancel: () => void;
}) {
  const t = useTranslations();
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [role, setRole] = useState<Role>(current);
  // 뒤로 가기를 누르면 이 창만 닫힌다
  useHistoryClose(open, onCancel);
  // 닫힘 모션(D82, 모션 PR 4): open이 false가 된 뒤에도 나가는 모션이 끝날 때까지 창을 남긴다. history·포커스 판단은 계속 open 기준이다
  const exit = useExitPresence(open, { onRequestClose: onCancel });
  // 부모가 늘 그려 두므로(닫힌 동안은 null) 다시 열 때 고른 역할이 남지 않게 닫힌 뒤에는 현재 역할로 되돌린다
  if (!exit.present && role !== current) setRole(current);

  useEffect(() => {
    const dialog = ref.current;
    if (!exit.present || !dialog) {
      return;
    }
    // 일부 환경(테스트용 가짜 브라우저)에는 showModal이 없어서 open 속성으로 대신한다
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    cancelRef.current?.focus();
  }, [exit.present]);

  if (!exit.present) {
    return null;
  }
  return (
    <dialog
      ref={ref}
      aria-labelledby="role-dialog-title"
      onClose={onCancel}
      {...exit.dialogProps}
      onClick={(event) => {
        if (event.target === ref.current && !pending) {
          onCancel();
        }
      }}
      className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-5 text-fg backdrop:bg-black/60"
    >
      <h2 id="role-dialog-title" className="text-lg font-extrabold">
        {t("Admin.actionUserRoleChange")}
      </h2>
      <p className="mt-1 font-num text-sm text-fg-sub">{name}</p>
      <div role="radiogroup" aria-label={t("Admin.roleAria", { name })} className="mt-3 flex flex-wrap gap-2">
        {ASSIGNABLE_ROLES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={role === value}
            onClick={() => setRole(value)}
            className={`min-h-11 rounded-full border px-4 text-sm font-bold ${
              role === value ? "border-transparent bg-chip-on-bg text-chip-on-fg" : "border-ctl text-fg-sub hover:text-fg"
            }`}
          >
            {roleLabel(value, t)}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-fg">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex gap-2.5">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="h-11 flex-1 rounded-xl border border-ctl text-sm font-bold text-fg-sub hover:text-fg disabled:opacity-60"
        >
          {t("Common.cancel")}
        </button>
        <button
          type="button"
          onClick={() => onSave(role)}
          disabled={pending || role === current}
          aria-label={t("Admin.roleSaveAria", { name })}
          className="h-11 flex-1 rounded-xl bg-chip-on-bg text-sm font-extrabold text-chip-on-fg disabled:opacity-40"
        >
          {pending ? t("Common.saving") : t("Common.save")}
        </button>
      </div>
    </dialog>
  );
}
