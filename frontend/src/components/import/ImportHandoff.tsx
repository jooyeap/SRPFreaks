"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { canUseImport } from "@/lib/features";
import { consumeFragment, useHandoff } from "@/lib/import-handoff";

/**
 * 공식 페이지의 북마클릿이 넘긴 플레이가 있으면, 어느 화면에서든 모달로 "이어서 처리"를 안내한다 (D40).
 * 값은 주소 조각(#srp=)으로 오므로 이 컴포넌트가 먼저 받아서 보관소에 쌓고 주소에서 지운다.
 * 모달의 표시 여부는 상태를 따로 두지 않고 "받은 시각(updatedAt)이 닫은 시각보다 뒤인가"로 계산한다
 * (새로 받으면 다시 뜨고, 닫으면 다음에 받을 때까지 조용하다).
 * 모달은 /import 화면에서는 띄우지 않는다(이미 그 화면에서 처리한다).
 */
export function ImportHandoff() {
  const { status, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const handoff = useHandoff();
  const [dismissedAt, setDismissedAt] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    consumeFragment();
    // 같은 탭을 재사용해 다음 쪽을 보내면 주소의 조각만 바뀐다(페이지는 다시 불러오지 않는다)
    const onHashChange = () => {
      consumeFragment();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const eligible = status === "anonymous" || canUseImport(user?.role);
  const open = eligible && status !== "loading" && handoff.pending.length > 0 && handoff.updatedAt > dismissedAt && pathname !== "/import";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    // 일부 환경(테스트용 가짜 브라우저)에는 showModal이 없어서 open 속성으로 대신한다
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }, [open]);

  if (!open) return null;

  const close = () => setDismissedAt(Date.now());
  const loggedIn = status === "authenticated";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="import-handoff-title"
      onClose={close}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-5 text-fg backdrop:bg-black/60"
    >
      <h2 id="import-handoff-title" className="text-lg font-extrabold">
        공식 페이지에서 받은 플레이가 있습니다
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-fg-sub">
        {handoff.pending.length}곡을 받았습니다. {loggedIn ? "내용을 확인하고 저장하면 내 기록에 반영됩니다. 아직 저장되지 않았습니다." : "로그인한 뒤 이어서 처리할 수 있습니다. 아직 저장되지 않았습니다."}
      </p>
      <div className="mt-5 flex gap-2.5">
        <button type="button" onClick={close} className="h-11 rounded-xl border border-chip-line px-4 text-sm font-bold text-fg-sub hover:text-fg">
          나중에
        </button>
        {loggedIn ? (
          <button
            type="button"
            onClick={() => {
              close();
              router.push("/import");
            }}
            className="h-11 flex-1 rounded-xl bg-chip-on-bg text-sm font-extrabold text-chip-on-fg"
          >
            이어서 처리
          </button>
        ) : (
          <Link href="/login" onClick={close} className="flex h-11 flex-1 items-center justify-center rounded-xl bg-chip-on-bg text-sm font-extrabold text-chip-on-fg">
            로그인
          </Link>
        )}
      </div>
    </dialog>
  );
}
