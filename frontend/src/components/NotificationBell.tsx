"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { NotificationResponse } from "@/lib/api-types";
import { difficultyLabel, formatRate, partLabel } from "@/lib/format";
import {
  NOTIFICATION_POLL_MS,
  badgeText,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  notificationKeys,
  relativeMinutes,
} from "@/lib/rivals";
import { useTranslations } from "next-intl";

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

/**
 * 헤더의 알림 종(D56). 로그인했을 때만 그린다. 안 읽은 개수는 1분마다, 창에 다시 들어올 때 다시 읽는다
 * (서버는 이때 "10분이 지난 알림"을 처리하므로 따로 주기 작업이 없다).
 * 모바일(lg 미만)은 아래에서 올라오는 시트, 데스크톱은 종 아래 펼침. Esc·바깥 누르기로 닫는다.
 * 안 읽은 줄은 배경 + 점 + `새 알림` 글자로 보인다(색만 쓰지 않는다).
 */
export function NotificationBell() {
  const { status, user } = useAuth();
  if (status !== "authenticated" || !user) {
    return null;
  }
  return <Bell viewerId={user.id} />;
}

function Bell({ viewerId }: { viewerId: number }) {
  const t = useTranslations("Notify");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const count = useQuery({
    queryKey: notificationKeys.count(viewerId),
    queryFn: ({ signal }) => fetchUnreadCount(signal),
    refetchInterval: NOTIFICATION_POLL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const list = useQuery({
    queryKey: notificationKeys.list(viewerId),
    queryFn: ({ signal }) => fetchNotifications(0, signal),
    enabled: open,
    retry: false,
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  };
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh });
  const readOne = useMutation({ mutationFn: (id: number) => markNotificationRead(id), onSuccess: refresh });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const n = count.data?.count ?? 0;
  const badge = badgeText(n);
  const go = (item: NotificationResponse) => {
    if (!item.read) readOne.mutate(item.id);
    setOpen(false);
    router.push(`/players/${item.actorUserId}/compare?view=charts`);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={badge ? t("bellAriaCount", { n }) : t("bellAria")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex size-9 items-center justify-center rounded-lg border border-chip-line text-fg-sub hover:text-fg"
      >
        <BellIcon />
        {badge ? (
          <span aria-hidden="true" className="font-num absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-chip-on-bg px-1 text-center text-[11px] font-bold leading-[18px] text-chip-on-fg">
            {badge}
          </span>
        ) : null}
      </button>
      {open ? (
        <>
          <div aria-hidden="true" className="motion-fade fixed inset-0 z-40 bg-black/60 lg:hidden" />
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t("title")}
            className="motion-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[80svh] flex-col gap-2 rounded-t-2xl border-t border-line bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-0 lg:top-full lg:mt-2 lg:max-h-[70vh] lg:w-[380px] lg:rounded-2xl lg:border lg:p-3 lg:shadow-xl"
          >
            <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-chip-line lg:hidden" />
            <div className="flex items-center gap-2">
              <b className="flex-1 text-base text-fg">{t("title")}</b>
              <button
                type="button"
                disabled={readAll.isPending || n === 0}
                onClick={() => readAll.mutate()}
                className="min-h-9 rounded-lg border border-chip-line px-3 text-xs text-fg-sub hover:text-fg disabled:opacity-50"
              >
                {t("readAll")}
              </button>
            </div>
            <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto">
              {list.isPending ? (
                <li className="p-3 text-sm text-fg-sub">{t("loading")}</li>
              ) : list.isError ? (
                <li role="alert" className="p-3 text-sm text-fg">{t("failed")}</li>
              ) : list.data.content.length === 0 ? (
                <li className="p-3 text-sm text-fg-sub">{t("empty")}</li>
              ) : (
                list.data.content.map((item) => <NotificationItem key={item.id} item={item} onOpen={() => go(item)} />)
              )}
            </ul>
            <p className="text-center text-xs text-fg-dim">{t("keep")}</p>
          </div>
        </>
      ) : null}
    </div>
  );
}

function NotificationItem({ item, onOpen }: { item: NotificationResponse; onOpen: () => void }) {
  const t = useTranslations("Notify");
  const nickname = item.actorNickname ?? t("unknown");
  const b = { b: (c: React.ReactNode) => <b>{c}</b> };
  const when = relativeMinutes(item.visibleAt, Date.now());
  const whenText = when.unit === "now" ? t("now") : t(when.unit, { n: when.n });
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full gap-2.5 rounded-xl p-3 text-left hover:bg-table-head ${item.read ? "" : "bg-table-head"}`}
      >
        <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read ? "border border-chip-line" : "bg-fg"}`} />
        <span className="min-w-0">
          <span className={`block text-[13px] leading-relaxed ${item.read ? "text-fg-sub" : "text-fg"}`}>
            {item.bundled && item.songCount > 1
              ? t.rich("bundled", { ...b, nickname, n: item.songCount })
              : t.rich("single", { ...b, nickname, title: item.title, chart: `${partLabel(item.part)} ${difficultyLabel(item.difficulty)}` })}
          </span>
          <span className="mt-0.5 block text-xs text-fg-dim">
            {item.bundled && item.songCount > 1
              ? t("bundledSub", { title: item.title, n: item.songCount - 1 })
              : t("singleSub", { nickname, theirs: formatRate(item.actorRate), mine: formatRate(item.myRate) })}
            {" · "}
            {whenText}
            {item.read ? null : <> · <span className="text-fg">{t("new")}</span></>}
          </span>
        </span>
      </button>
    </li>
  );
}
