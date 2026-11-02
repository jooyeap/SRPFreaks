"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { canUseImport } from "@/lib/features";
import { ImportProcessor, type DoneInfo } from "@/components/import/ImportProcessor";
import { clearHandoff, consumeFragment, isFreshArrival, useHandoff } from "@/lib/import-handoff";
import { playKey, previewRecentPlays } from "@/lib/record-import";
import { useTranslations } from "next-intl";

/**
 * 공식 페이지의 북마클릿이 넘긴 플레이가 있으면, 어느 화면에서든 모달로 "이어서 처리"를 안내한다 (D40).
 * 값은 주소 조각(#srp=)으로 오므로 이 컴포넌트가 먼저 받아서 보관소에 쌓고 주소에서 지운다.
 * 모달의 표시 여부는 상태를 따로 두지 않고 "받은 시각(updatedAt)이 닫은 시각보다 뒤인가"로 계산한다
 * (새로 받으면 다시 뜨고, 닫으면 다음에 받을 때까지 조용하다).
 * 로그인한 사용자는 모달 안에서 바로 미리보기·저장·결과 확인까지 한다(ImportProcessor), 화면 이동 없이 원래 보던 화면 위에서 끝난다.
 * 저장 전에 창을 닫거나 브라우저를 종료해도 플레이는 보관소(6시간)에 남아서, 다음 화면 로드 때 이 모달이 다시 뜬다.
 * "완료" 상태는 저장 뒤 pending이 비어도 결과 화면을 유지하려고 여기서 들고 있는다.
 */
export function ImportHandoff() {
  const t = useTranslations();
  const { status, user } = useAuth();
  const handoff = useHandoff();
  const [dismissedAt, setDismissedAt] = useState(0);
  const [done, setDone] = useState<DoneInfo | null>(null);
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
  const loggedIn = status === "authenticated" && !!user;
  const pendingOpen = handoff.pending.length > 0 && handoff.updatedAt > dismissedAt;
  // 남아 있던 플레이는 먼저 조용히 미리보기만 해서, 저장할 기록이 하나도 없으면 안내 없이 비운다(있을 때만 모달을 띄운다)
  // (방금 받은 것이 아니라 저장소에서 읽어 온 것 = 이전에 처리하지 못하고 남은 것, 예: 비정상 종료)
  const restored = !isFreshArrival(handoff);
  const peekKeys = handoff.pending.map(playKey).join("\n");
  // 처리 모달이 같은 키로 미리보기를 이미 받아 둔 경우(방금 받은 플레이)에는 확인 대상이 아니다
  const peekEnabled = loggedIn && pendingOpen && restored && done === null;
  const peek = useQuery({
    queryKey: ["import-preview", user?.id ?? 0, peekKeys],
    queryFn: () => previewRecentPlays(handoff.pending),
    enabled: peekEnabled,
    staleTime: 0,
    gcTime: 0,
  });
  const nothingToSave = peekEnabled && peek.isSuccess && !peek.data.results.some((r) => r.saved);
  useEffect(() => {
    if (nothingToSave) clearHandoff();
  }, [nothingToSave]);
  const waitingPeek = peekEnabled && !peek.isError && (peek.isPending || nothingToSave);
  const open = eligible && status !== "loading" && ((pendingOpen && !waitingPeek) || (loggedIn && done !== null));

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

  const close = () => {
    setDismissedAt(Date.now());
    setDone(null);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="import-handoff-title"
      onClose={close}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-5 text-fg backdrop:bg-black/60"
    >
      {loggedIn && user ? (
        <ImportProcessor userId={user.id} done={done} onDone={setDone} onClose={close} />
      ) : (
        <>
          <h2 id="import-handoff-title" className="text-lg font-extrabold">
            {t("Import.handoffTitle")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-sub">{t("Import.handoffBody", { count: handoff.pending.length })}</p>
          <div className="mt-5 flex gap-2.5">
            <button type="button" onClick={close} className="h-11 rounded-xl border border-ctl px-4 text-sm font-bold text-fg-sub hover:text-fg">
              {t("Import.later")}
            </button>
            <Link href="/login" onClick={close} className="flex h-11 flex-1 items-center justify-center rounded-xl bg-chip-on-bg text-sm font-extrabold text-chip-on-fg">
              {t("Import.login")}
            </Link>
          </div>
        </>
      )}
    </dialog>
  );
}
