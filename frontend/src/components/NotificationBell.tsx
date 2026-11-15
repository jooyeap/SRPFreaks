"use client";

import { tierArrivalHref } from "@/lib/tier-arrival";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { NotificationResponse, RivalNotificationResponse, TierNotificationResponse } from "@/lib/api-types";
import { formatRate, formatScore, formatTier } from "@/lib/format";
import {
  NOTIFICATION_POLL_MS,
  badgeText,
  fetchNotifications,
  formatScoreDiff as formatSignedDiff,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  notificationKeys,
  relativeMinutes,
} from "@/lib/rivals";
import { useTranslations } from "next-intl";
import { runAfterHistorySettled } from "@/lib/history-layers";
import {
  NOTIFICATION_GROUP_PREVIEW,
  groupNotifications,
  hiddenSongCount,
  type NotificationGroup,
} from "@/lib/notification-groups";
import { useHistoryClose } from "@/lib/use-history-close";
import { EXIT_SHEET_MS, useExitPresence } from "@/lib/use-exit-presence";
import { ChartChip, DiffChip, ScoreChip, TextChip } from "@/components/notification/NotificationParts";
import { RivalBundleDetail } from "@/components/notification/RivalBundleDetail";

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
 * 안 읽은 줄은 배경 + 큰 파란 점 + `새 알림` 글자로 보인다(색만 쓰지 않는다).
 * 줄 구조(D86): 칩(`라이벌`/`서열표`) → 곡명(굵게) → 난이도 칩 → 점수 칩. 라이벌 묶음 줄은 곡명 미리보기와 `곡 목록 보기`를 두고,
 * 누르면 창 안에서 묶음의 곡 목록 화면(RivalBundleDetail)으로 바뀐다.
 * 창은 헤더 안에 있어서 헤더의 `whitespace-nowrap`을 물려받는다. 그대로 두면 알림 문장이 한 줄로 이어져 잘리고 가로 스크롤이 생기므로
 * 창에 `whitespace-normal`을 두고(TermHelp와 같은 이유), 띄어쓰기 없는 긴 글자도 `overflow-wrap:anywhere`로 줄바꿈한다.
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
  // 라이벌 묶음 알림의 곡 목록 화면(D86). null이면 알림 목록. 창을 다시 열면 목록부터 보인다(종 버튼에서 비운다)
  const [detail, setDetail] = useState<RivalNotificationResponse | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // 뒤로 가기를 누르면 알림 창만 닫힌다(lib/history-layers.ts)
  useHistoryClose(open, () => setOpen(false));
  // 닫힘 모션(D82, 모션 PR 4): 시트(모바일)는 내려가고 펼침(데스크톱)은 위로 사라진다. open이 false가 된 뒤에도 그 시간만 남기고, 그동안은 눌림을 받지 않는다
  const exit = useExitPresence(open, { ms: EXIT_SHEET_MS });
  const closingAttr = exit.closing ? "true" : undefined;

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
  // 알림 창을 닫고 알림이 가리키는 곳으로 간다
  const leave = (item: NotificationResponse) => {
    setOpen(false);
    // 창이 쌓아 둔 history 칸을 먼저 걷어낸 뒤에 이동한다(바로 push하면 칸 정리와 겹쳐 새 화면이 걷히거나 칸이 하나 남는다. lib/history-layers.ts)
    runAfterHistorySettled(() => router.push(notificationHref(item)));
  };
  const go = (item: NotificationResponse) => {
    if (!item.read) readOne.mutate(item);
    if (item.kind === "RIVAL" && isBundle(item)) {
      // 묶음 줄은 이동하지 않고 곡 목록 화면을 연다. 그 사람과의 곡별 승패는 그 화면 아래 버튼으로 간다
      setDetail(item);
      return;
    }
    leave(item);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={badge ? t("bellAriaCount", { n }) : t("bellAria")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setDetail(null);
          setOpen((v) => !v);
        }}
        className="relative inline-flex size-9 items-center justify-center rounded-lg border border-ctl text-fg-sub hover:text-fg"
      >
        <BellIcon />
        {badge ? (
          <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 min-w-4 rounded bg-chip-on-bg px-1 text-center text-[10px] font-extrabold leading-4 text-chip-on-fg">
            {badge}
          </span>
        ) : null}
      </button>
      {exit.present ? (
        <>
          <div aria-hidden="true" data-closing={closingAttr} className="motion-fade fixed inset-0 z-40 bg-black/60 lg:hidden" />
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t("title")}
            data-closing={closingAttr}
            className="motion-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[80svh] flex-col gap-2 whitespace-normal rounded-t-2xl border-t border-line bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-0 lg:top-full lg:mt-2 lg:max-h-[70vh] lg:w-[380px] lg:rounded-2xl lg:border lg:p-3 lg:shadow-xl"
          >
            <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-chip-line lg:hidden" />
            {detail ? (
              <RivalBundleDetail
                viewerId={viewerId}
                item={detail}
                nickname={detail.actorNickname ?? t("unknown")}
                onBack={() => setDetail(null)}
                onCompare={() => leave(detail)}
              />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <b className="flex-1 text-base text-fg">{t("title")}</b>
                  <button
                    type="button"
                    disabled={readAll.isPending || n === 0}
                    onClick={() => readAll.mutate()}
                    className="min-h-9 rounded-lg border border-ctl px-3 text-xs text-fg-sub hover:text-fg disabled:opacity-50"
                  >
                    {t("readAll")}
                  </button>
                </div>
                <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto overflow-x-hidden">
                  {list.isPending ? (
                    <li className="p-3 text-sm text-fg-sub">{t("loading")}</li>
                  ) : list.isError ? (
                    <li role="alert" className="p-3 text-sm text-fg">{t("failed")}</li>
                  ) : list.data.content.length === 0 ? (
                    <li className="p-3 text-sm text-fg-sub">{t("empty")}</li>
                  ) : (
                    groupNotifications(list.data.content).map((group, i, groups) => {
                      const first = group.items[0];
                      // 서열표 알림이 이어지는 곳 맨 앞에 소제목을 둔다(시간 순서는 그대로, 라이벌과 구역만 나눈다)
                      const sectionHead = first.kind === "TIER" && (i === 0 || groups[i - 1].items[0].kind !== "TIER");
                      return (
                        <Fragment key={`${first.kind}-${group.key}`}>
                          {sectionHead ? (
                            <li>
                              <h3 className="px-3 pb-0.5 pt-2 text-xs font-bold text-fg-sub">{t("tierSection")}</h3>
                            </li>
                          ) : null}
                          {group.items.length === 1 ? (
                            // 한 줄뿐이면 묶지 않는다(접을 것이 없다). 머리 줄이 없어 줄에 상대 닉네임을 같이 보인다. 서열표 알림(D61)은 늘 이 경우다
                            <NotificationItem item={first} now={list.dataUpdatedAt} onOpen={() => go(first)} lone />
                          ) : (
                            <NotificationGroupView group={group} now={list.dataUpdatedAt} onOpen={go} />
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </ul>
              </>
            )}
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
    return item.bundled && item.songCount > 1 ? "/notices#tier-changes" : tierArrivalHref(item);
  }
  return `/players/${item.actorUserId}/compare?view=charts`;
}

/** 점수 차이 표기: 둘째 자리, 오르면 `+`를 붙인다(내리면 숫자에 `-`가 붙는다). */
export function formatScoreDiff(diff: number): string {
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}`;
}

/**
 * 같은 사람이 연달아 보낸 알림 묶음(2026-11-12). 머리 줄(`닉네임님 · N곡`, 안 읽은 줄이 있으면 `새 알림 N`)을 누르면 펼치고 접는다.
 * 처음 상태: 안 읽은 줄이 있는 묶음은 펼침, 모두 읽은 묶음은 접힘. 상태는 이 컴포넌트가 처음 그려질 때만 정하고(useState 초기값),
 * 읽음 처리로 목록이 다시 와도 사용자가 펼치고 접은 상태를 뒤집지 않는다. 열쇠가 첫 줄 id라 목록이 다시 와도 같은 묶음이다.
 * 펼치면 처음 3줄만 보이고, 나머지는 `N곡 더 보기`를 눌러야 보인다. 줄을 누르는 동작(읽음 처리 + 비교 화면 이동)은 NotificationItem 그대로다.
 * 접힘·펼침은 화살표 글자만이 아니라 `aria-expanded`와 줄 개수 글자(`N곡`)로도 전해진다. 누르는 영역은 실제 높이 44px(min-h-11)로 둔다.
 */
function NotificationGroupView({ group, now, onOpen }: { group: NotificationGroup; now: number; onOpen: (item: NotificationResponse) => void }) {
  const t = useTranslations("Notify");
  const [open, setOpen] = useState(group.unreadCount > 0);
  const [showAll, setShowAll] = useState(false);
  const nickname = group.actorNickname ?? t("unknown");
  const b = { b: (c: React.ReactNode) => <b>{c}</b> };
  const hidden = hiddenSongCount(group);
  const shown = showAll ? group.items : group.items.slice(0, NOTIFICATION_GROUP_PREVIEW);
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-xl px-3 text-left hover:bg-table-head"
      >
        <span aria-hidden="true" className="w-2 shrink-0 text-xs text-fg-dim">{open ? "▾" : "▸"}</span>
        <span className={`min-w-0 flex-1 text-[13px] [overflow-wrap:anywhere] ${group.unreadCount > 0 ? "text-fg" : "text-fg-sub"}`}>
          {t.rich("groupHead", { ...b, nickname, n: group.songTotal })}
        </span>
        {group.unreadCount > 0 ? <span className="shrink-0 text-xs text-fg">{t("groupUnread", { n: group.unreadCount })}</span> : null}
      </button>
      {open ? (
        <>
          <ul className="flex flex-col gap-1 pl-3">
            {shown.map((item) => (
              <NotificationItem key={`${item.kind}-${item.id}`} item={item} now={now} onOpen={() => onOpen(item)} />
            ))}
          </ul>
          {!showAll && group.items.length > NOTIFICATION_GROUP_PREVIEW ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="ml-3 mt-1 flex min-h-11 w-[calc(100%-0.75rem)] items-center rounded-xl border border-ctl px-3 text-left text-xs text-fg-sub hover:text-fg"
            >
              {t("moreSongs", { n: hidden })}
            </button>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

/**
 * 알림 한 줄(D86, 시안 ②). 읽는 순서: 칩(`라이벌`/`서열표`) → 곡명(굵게) → 난이도 칩 → 점수 칩 → 시각.
 * 안 읽은 줄은 배경(check-bg) + 큰 파란 점 + `새 알림` 글자(묶음 안에서는 머리 줄이 `새 알림 N`을 보이므로 화면 읽기용 글자만)로 보인다.
 * 읽은 줄은 빈 점. 줄 전체가 하나의 버튼이고 높이는 44px 이상이다. 곡명·닉네임이 길면 잘라 내지 않고 줄바꿈한다(break-keep + overflow-wrap).
 * `lone` = 묶음의 머리 줄 없이 혼자 보이는 줄이다. 머리 줄이 닉네임을 알려 주지 못하므로 상대 점수 칩에 닉네임을 쓰고 `새 알림` 글자를 보인다.
 * `n분 전`의 기준 시각(now)은 목록을 받아 온 시각(dataUpdatedAt)을 쓴다. 그리는 중에 Date.now()를 부르면
 * 그릴 때마다 값이 달라지는 "순수하지 않은" 렌더가 되어 lint(react-hooks/purity)가 막는다.
 */
function NotificationItem({ item, now, onOpen, lone = false }: { item: NotificationResponse; now: number; onOpen: () => void; lone?: boolean }) {
  const t = useTranslations("Notify");
  const when = relativeMinutes(item.visibleAt, now);
  const whenText = when.unit === "now" ? t("now") : t(when.unit, { n: when.n });
  const bundle = isBundle(item);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`motion-press flex min-h-11 w-full min-w-0 gap-2.5 rounded-xl p-3 text-left hover:bg-table-head ${item.read ? "" : "bg-check-bg"}`}
      >
        <span aria-hidden="true" className={`mt-1 size-3 shrink-0 rounded-full ${item.read ? "border border-ctl" : "bg-check-line"}`} />
        <span className="min-w-0 flex-1 break-keep [overflow-wrap:anywhere]">
          <span className={`block text-[13px] leading-5 ${item.read ? "text-fg-sub" : "text-fg"}`}>
            <span className="mr-1.5 inline-block rounded border border-chip-line px-1.5 align-[1px] text-[11px] font-bold leading-4 text-fg-sub">
              {item.kind === "TIER" ? t("kindTier") : t("kindRival")}
            </span>
            {item.kind === "TIER" ? <TierTitle item={item} /> : <RivalTitle item={item} />}
          </span>
          {item.kind === "RIVAL" && bundle ? <RivalBundlePreview item={item} /> : null}
          <span className="mt-1 flex flex-wrap items-center gap-1">
            {item.kind === "TIER" ? <TierChips item={item} /> : bundle ? null : <RivalChips item={item} lone={lone} />}
            <span className="text-xs text-fg-dim">{whenText}</span>
            {item.read ? null : lone ? <span className="text-xs text-fg">{t("new")}</span> : <span className="sr-only">{t("new")}</span>}
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

/** 줄의 첫 문장: 라이벌 묶음이면 `HJY님이 3곡을 역전했습니다`, 아니면 곡명(굵게). 긴 문장 대신 곡명이 먼저 보이게 한다. */
function RivalTitle({ item }: { item: RivalNotificationResponse }) {
  const t = useTranslations("Notify");
  const nickname = item.actorNickname ?? t("unknown");
  return isBundle(item) ? <span>{t.rich("bundled", { ...bold, nickname, n: item.songCount })}</span> : <b className="font-bold text-fg">{item.title}</b>;
}

/**
 * 묶음 줄의 곡명 미리보기(최대 3개)와 `곡 목록 보기 ›`. 서버가 곡명을 못 준 옛 묶음은 첫 곡뿐이라 `첫 곡 외 N곡`이 된다.
 * `곡 목록 보기`는 줄 전체 버튼 안의 글자일 뿐이다(줄을 누르면 목록 화면이 열린다).
 */
function RivalBundlePreview({ item }: { item: RivalNotificationResponse }) {
  const t = useTranslations("Notify");
  const titles = item.previewTitles && item.previewTitles.length > 0 ? item.previewTitles : [item.title];
  const more = item.songCount - titles.length;
  return (
    <span className="mt-0.5 block text-xs leading-5 text-fg-sub">
      {titles.join(" · ")}
      {more > 0 ? ` ${t("previewMore", { n: more })}` : ""}
      <span className="mt-0.5 block font-bold text-check-fg">{t("bundleOpen")}</span>
    </span>
  );
}

/** 라이벌 점수 칩: 난이도 · 상대 · 내 · 차이(내 − 상대, 부호가 글자로 보인다). 묶음 안에서는 머리 줄이 닉네임을 알려 주므로 `상대`라고 쓴다. */
function RivalChips({ item, lone }: { item: RivalNotificationResponse; lone: boolean }) {
  const t = useTranslations("Notify");
  const diff = formatSignedDiff(item.myRate - item.actorRate);
  return (
    <>
      <ChartChip part={item.part} difficulty={item.difficulty} />
      <ScoreChip label={lone ? (item.actorNickname ?? t("unknown")) : t("theirsLabel")} value={formatRate(item.actorRate)} strong />
      <ScoreChip label={t("mineLabel")} value={formatRate(item.myRate)} />
      {diff ? <DiffChip text={diff.text} sign={diff.sign} /> : null}
    </>
  );
}

function TierTitle({ item }: { item: TierNotificationResponse }) {
  const t = useTranslations("Notify");
  return isBundle(item) ? <span>{t.rich("tierBundled", { ...bold, n: item.songCount })}</span> : <b className="font-bold text-fg">{item.title}</b>;
}

/** 서열표 점수 칩: 난이도 · `기준 5.4 → 5.5` · `점수 +16.00`. 묶음이면 `첫 곡 외 N채보`. 기준 난이도가 미정이면 점수도 없다(`미정`으로 보이고 차이는 쓰지 않는다). */
function TierChips({ item }: { item: TierNotificationResponse }) {
  const t = useTranslations("Notify");
  const tc = useTranslations();
  if (isBundle(item)) {
    return <span className="text-xs text-fg-sub">{t("tierBundledSub", { title: item.title, n: item.songCount - 1 })}</span>;
  }
  const score = (v: number | null) => (v === null ? tc("Common.undecided") : formatScore(v));
  const diffTone = item.scoreDiff === null ? "even" : item.scoreDiff > 0 ? "up" : item.scoreDiff < 0 ? "down" : "even";
  return (
    <>
      <ChartChip part={item.part} difficulty={item.difficulty} />
      <TextChip>{t("tierChangeChip", { before: formatTier(item.beforeTier, tc), after: formatTier(item.afterTier, tc) })}</TextChip>
      {item.scoreDiff === null ? (
        <TextChip>{t("tierScoreChipNoDiff", { before: score(item.beforeScore), after: score(item.afterScore) })}</TextChip>
      ) : (
        <DiffChip text={t("tierScoreChip", { diff: formatScoreDiff(item.scoreDiff) })} sign={diffTone} />
      )}
    </>
  );
}
