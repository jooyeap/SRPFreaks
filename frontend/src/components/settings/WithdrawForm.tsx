"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
import { withdrawMyAccount } from "@/lib/users";

const DELETED = [
  { title: "계정", body: "Google 계정 연결과 닉네임이 삭제됩니다." },
  { title: "기록", body: "입력한 모든 기록(달성률, 풀콤보 여부)이 삭제됩니다. 레이팅과 티어도 함께 사라집니다." },
  { title: "로그인", body: "모든 기기에서 로그아웃됩니다." },
  { title: "복구", body: "삭제한 뒤에는 되돌리거나 내려받을 수 없습니다." },
];

/**
 * 회원 탈퇴 확인. 되돌릴 수 없는 작업이라 무엇이 지워지는지 먼저 보여 주고, 체크해야만 버튼이 켜진다.
 * 성공하면 서버가 쿠키를 지웠으므로, 이 기기의 로그인 상태만 logout()으로 정리하고 첫 화면으로 보낸다.
 */
export function WithdrawForm() {
  const { logout } = useAuth();
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);

  const mutation = useMutation({
    mutationFn: withdrawMyAccount,
    onSuccess: async () => {
      await logout();
      router.replace("/");
    },
  });

  const failure = mutation.error;
  const message =
    failure instanceof ApiError ? failure.message : failure ? "탈퇴하지 못했습니다. 잠시 후 다시 시도해 주세요." : null;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-[14px] border border-danger bg-card p-4" aria-label="삭제되는 내용">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-danger">
          <span aria-hidden="true">!</span>되돌릴 수 없습니다
        </h2>
        <ul className="flex flex-col gap-2.5">
          {DELETED.map((item) => (
            <li key={item.title} className="text-sm leading-relaxed text-fg-sub">
              <span className="font-bold text-fg">{item.title}</span> {item.body}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-card p-4" aria-label="삭제 범위">
        <h2 className="text-sm font-bold text-fg-sub">삭제 범위</h2>
        <p className="text-xs leading-relaxed text-fg-sub">
          이 서비스에 저장된 회원님의 모든 정보가 삭제됩니다. 운영자의 관리 작업 기록에 남아 있던 이 계정의 식별 정보도 지워집니다. 같은 Google 계정으로 다시 가입하면 새 계정으로 시작합니다.
        </p>
      </section>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-3">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="h-5 w-5 shrink-0 accent-current"
        />
        <span className="text-sm font-bold leading-snug text-fg">위 내용을 확인했고, 계정과 기록을 모두 삭제합니다.</span>
      </label>

      <p role="alert" className="min-h-4 text-xs text-danger">
        {message}
      </p>

      <div className="flex gap-2.5">
        <Link
          href="/settings"
          className="flex h-12 w-24 shrink-0 items-center justify-center rounded-xl border border-chip-line text-sm font-bold text-fg-sub"
        >
          취소
        </Link>
        <button
          type="button"
          disabled={!confirmed || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="h-12 grow rounded-xl border border-danger text-sm font-extrabold text-danger enabled:hover:bg-table-head disabled:border-line disabled:bg-disabled disabled:text-fg-dim"
        >
          {mutation.isPending ? "탈퇴하는 중입니다." : "탈퇴하기"}
        </button>
      </div>
      <p className="text-center text-xs text-fg-dim">확인에 체크해야 탈퇴하기가 켜집니다.</p>
    </div>
  );
}
