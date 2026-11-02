"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { NotificationResponse, RivalNotificationResponse, TierNotificationResponse } from "@/lib/api-types";
import { difficultyLabel, formatRate, formatScore, formatTier, partLabel } from "@/lib/format";
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
 * 헤더의 알림 종(D56, D61). 라이벌 역전 알림과 서열표 변경 알림이 한 목록에 시간순으로 섞이고, 줄 앞 칩(`라이벌`/`서열표`)으로 구분한다. 로그인했을 때만 그린다. 안 읽은 개수는 1분마다, 창에 다시 들어올 때 다시 읽는다
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
  const readOne = useMutation({
    mutationFn: (item: NotificationResponse) => markNotificationRead(item.kind, item.id),
    onSuccess: refresh,
  });

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
    if (!item.read) readOne.mutate(item);
    setOpen(false);
    router.push(notificationHref(item));
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
          <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 min-w-4 rounded bg-chip-on-bg px-1 text-center text-[10px] font-extrabold leading-4 text-chip-on-fg">
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
                list.data.content.map((item) => (
                  <NotificationItem key={`${item.kind}-${item.id}`} item={item} now={list.dataUpdatedAt} onOpen={() => go(item)} />
                ))
              )}
            </ul>
            <p className="text-center text-xs text-fg-dim">{t("keep")}</p>
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * 알림을 눌렀을 때 갈 곳. 라이벌 = 그 사람과의 곡별 승패, 서열표 = 곡 상세(묶음이면 서열표 변경 탭).
 * `item.kind`로 나누면 TypeScript가 각 갈래에서 item의 종류를 좁혀 준다(actorUserId는 라이벌에만 있다).
 */
export function notificationHref(item: NotificationResponse): string {
  if (item.kind === "TIER") {
    return item.bundled && item.songCount > 1 ? "/notices#tier-changes" : `/songs/${item.songId}`;
  }
  return `/players/${item.actorUserId}/compare?view=charts`;
}

/** 점수 차이 표기: 둘째 자리, 오르면 `+`를 붙인다(내리면 숫자에 `-`가 붙는다). */
export function formatScoreDiff(diff: number): string {
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}`;
}

/**
 * `n분 전`의 기준 시각(now)은 목록을 받아 온 시각(dataUpdatedAt)을 쓴다. 그리는 중에 Date.now()를 부르면
 * 그릴 때마다 값이 달라지는 "순수하지 않은" 렌더가 되어 lint(react-hooks/purity)가 막는다.
 */
function NotificationItem({ item, now, onOpen }: { item: NotificationResponse; now: number; onOpen: () => void }) {
  const t = useTranslations("Notify");
  const when = relativeMinutes(item.visibleAt, now);
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
            <span className="mr-1.5 inline-block rounded border border-chip-line px-1.5 align-[1px] text-[11px] font-bold leading-4 text-fg-sub">
              {item.kind === "TIER" ? t("kindTier") : t("kindRival")}
            </span>
            {item.kind === "TIER" ? <TierText item={item} /> : <RivalText item={item} />}
          </span>
          <span className="mt-0.5 block text-xs text-fg-dim">
            {item.kind === "TIER" ? <TierSub item={item} /> : <RivalSub item={item} />}
            {" · "}
            {whenText}
            {item.read ? null : <> · <span className="text-fg">{t("new")}</span></>}
          </span>
        </span>
      </button>
    </li>
  );
}

const bold = { b: (c: React.ReactNode) => <b>{c}</b> };

function isBundle(item: NotificationResponse): boolean {
  return item.bundled && item.songCount > 1;
}

function RivalText({ item }: { item: RivalNotificationResponse }) {
  const t = useTranslations("Notify");
  const nickname = item.actorNickname ?? t("unknown");
  return isBundle(item)
    ? t.rich("bundled", { ...bold, nickname, n: item.songCount })
    : t.rich("single", { ...bold, nickname, title: item.title, chart: `${partLabel(item.part)} ${difficultyLabel(item.difficulty)}` });
}

function RivalSub({ item }: { item: RivalNotificationResponse }) {
  const t = useTranslations("Notify");
  const nickname = item.actorNickname ?? t("unknown");
  return isBundle(item)
    ? t("bundledSub", { title: item.title, n: item.songCount - 1 })
    : t("singleSub", { nickname, theirs: formatRate(item.actorRate), mine: formatRate(item.myRate) });
}

function TierText({ item }: { item: TierNotificationResponse }) {
  const t = useTranslations("Notify");
  const tc = useTranslations();
  return isBundle(item)
    ? t.rich("tierBundled", { ...bold, n: item.songCount })
    : t.rich("tierSingle", {
        ...bold,
        title: item.title,
        chart: `${partLabel(item.part)} ${difficultyLabel(item.difficulty)}`,
        before: formatTier(item.beforeTier, tc),
        after: formatTier(item.afterTier, tc),
      });
}

function TierSub({ item }: { item: TierNotificationResponse }) {
  const t = useTranslations("Notify");
  const tc = useTranslations();
  if (isBundle(item)) {
    return t("tierBundledSub", { title: item.title, n: item.songCount - 1 });
  }
  // 기준 난이도가 미정이면 점수도 없다(`미정`으로 보이고 차이는 쓰지 않는다)
  const score = (v: number | null) => (v === null ? tc("Common.undecided") : formatScore(v));
  const values = { before: score(item.beforeScore), after: score(item.afterScore) };
  return item.scoreDiff === null
    ? t("tierScoreNoDiff", values)
    : t("tierScore", { ...values, diff: formatScoreDiff(item.scoreDiff) });
}
