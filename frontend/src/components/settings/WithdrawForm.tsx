"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
import { withdrawMyAccount } from "@/lib/users";
import { useTranslations } from "next-intl";

const DELETED = [
  { title: "Settings.delAccountTitle", body: "Settings.delAccountBody" },
  { title: "Settings.delRecordsTitle", body: "Settings.delRecordsBody" },
  { title: "Settings.delLoginTitle", body: "Settings.delLoginBody" },
  { title: "Settings.delRecoverTitle", body: "Settings.delRecoverBody" },
] as const;

/**
 * 회원 탈퇴 확인. 되돌릴 수 없는 작업이라 무엇이 지워지는지 먼저 보여 주고, 체크해야만 버튼이 켜진다.
 * 성공하면 서버가 쿠키를 지웠으므로, 이 기기의 로그인 상태만 logout()으로 정리하고 첫 화면으로 보낸다.
 */
export function WithdrawForm() {
  const t = useTranslations();
  const { logout } = useAuth();
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);

  const toast = useToast();
  const mutation = useMutation({
    mutationFn: withdrawMyAccount,
    onSuccess: async () => {
      await logout();
      toast(t("Settings.withdrawn")); // 안내는 화면이 바뀌어도 남는다(Provider가 레이아웃에 있다)
      router.replace("/");
    },
  });

  const failure = mutation.error;
  const message =
    failure instanceof ApiError ? failure.message : failure ? t("Settings.withdrawFailed") : null;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl border border-danger bg-card p-4" aria-label={t("Settings.deletedAria")}>
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-danger">
          <span aria-hidden="true">!</span>{t("Settings.irreversible")}
        </h2>
        <ul className="flex flex-col gap-2.5">
          {DELETED.map((item) => (
            <li key={item.title} className="text-sm leading-relaxed text-fg-sub">
              <span className="font-bold text-fg">{t(item.title)}</span> {t(item.body)}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card p-4" aria-label={t("Settings.scopeAria")}>
        <h2 className="text-sm font-bold text-fg-sub">{t("Settings.scopeAria")}</h2>
        <p className="text-xs leading-relaxed text-fg-sub">
          {t("Settings.scopeText")}
        </p>
      </section>

      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-card px-3.5 py-3">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="h-5 w-5 shrink-0 accent-current"
        />
        <span className="text-sm font-bold leading-snug text-fg">{t("Settings.confirmCheck")}</span>
      </label>

      <p role="alert" className="min-h-4 text-xs text-danger">
        {message}
      </p>

      <div className="flex gap-2.5">
        <Link
          href="/settings"
          className="flex h-12 w-24 shrink-0 items-center justify-center rounded-xl border border-ctl text-sm font-bold text-fg-sub"
        >
          {t("Common.cancel")}
        </Link>
        <button
          type="button"
          disabled={!confirmed || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="h-12 grow rounded-xl border border-danger text-sm font-extrabold text-danger enabled:hover:bg-table-head disabled:border-line disabled:bg-disabled disabled:text-fg-dim"
        >
          {mutation.isPending ? t("Settings.withdrawing") : t("Settings.withdrawBtn")}
        </button>
      </div>
      <p className="text-center text-xs text-fg-dim">{t("Settings.checkHint")}</p>
    </div>
  );
}
