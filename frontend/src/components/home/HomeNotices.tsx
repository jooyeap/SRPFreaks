"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { NewBadge } from "@/components/NewBadge";
import { formatPlayedDate } from "@/lib/format";
import { fetchNotices, noticeKeys } from "@/lib/notices";
import { useTranslations } from "next-intl";

const PREVIEW_SIZE = 1;

/** 이 일수 안에 올라온 공지만 "새 공지"로 보고 홈에 보인다(2026-11-02). 읽음 표시를 저장하지 않으므로 날짜로만 정한다 */
export const NEW_NOTICE_DAYS = 7;

/** 공지가 새 공지인지: 올린 지 NEW_NOTICE_DAYS일 이내. now는 테스트에서 시각을 고정하려고 받는다. */
export function isNewNotice(createdAt: string, now: number = Date.now()): boolean {
  const age = now - new Date(createdAt).getTime();
  return age <= NEW_NOTICE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * 홈의 공지사항: **새 공지(최근 7일)가 있을 때만** 가장 최근 1건(제목 + 작성일)과 `전체 보기` 링크를 보인다. 줄을 누르면 공지 화면(/notices)으로 간다.
 * 새 공지가 없거나 공지가 하나도 없으면 홈에서는 자리를 차지하지 않는다(공지 전체는 메뉴의 공지에서 본다).
 * 본문은 공지 화면에서만 보인다(홈은 제목만). 공지를 못 불러와도 홈 전체를 막지 않도록 오류일 때는 작은 안내만 둔다.
 * 불러오는 동안도 비워 둔다(없을 수 있는 칸이라 안내 글자를 깜빡이지 않는다).
 */
export function HomeNotices({ viewerId }: { viewerId: number }) {
  const t = useTranslations("Home");
  const tc = useTranslations("Common");
  const { data, isPending, isError } = useQuery({
    queryKey: noticeKeys.list(viewerId, 0, PREVIEW_SIZE),
    queryFn: ({ signal }) => fetchNotices(0, PREVIEW_SIZE, signal),
  });

  // 오류가 아닐 때: 불러오는 중이거나, 공지가 없거나, 가장 최근 공지도 오래됐으면 그리지 않는다
  if (!isError && (isPending || data.content.length === 0 || !isNewNotice(data.content[0].createdAt))) {
    return null;
  }

  return (
    <section aria-label={t("noticesAria")} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[17px] font-bold text-fg">{t("noticesTitle")}</h2>
        <Link href="/notices" className="text-xs text-fg-sub hover:text-fg">
          {tc("viewAll")}
        </Link>
      </div>
      {isError ? (
        <p className="text-sm text-fg-sub">{t("noticesLoadFailed")}</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-card">
          {data?.content.slice(0, 1).map((notice) => (
            <li key={notice.id} className="border-t border-row-line first:border-t-0">
              <Link href={`/notices/${notice.id}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5 hover:bg-table-head">
                <span className="flex min-w-0 items-center gap-2">
                  <NewBadge />
                  <span className="truncate text-sm font-semibold text-fg">{notice.title}</span>
                </span>
                <time dateTime={notice.createdAt} className="shrink-0 font-num text-xs text-fg-dim">
                  {formatPlayedDate(notice.createdAt)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
