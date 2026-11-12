"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatPlayedDate } from "@/lib/format";
import { HIT_HEAD } from "@/lib/hit-area";
import { ANONYMOUS_VIEWER_ID, LANDING_NOTICES_SIZE } from "@/lib/landing-home";
import { fetchNotices, noticeKeys } from "@/lib/notices";
import { useTranslations } from "next-intl";

/**
 * 로그인 전 홈의 최근 공지 3개(E2). 공개 읽기 GET /notices를 3건만 받는다. 줄은 HomeNotices와 같은 모양(제목 + 작성일)이고,
 * 본문은 공지 화면에서만 보인다. 로그인 홈의 HomeNotices는 "새 공지(7일)가 있을 때만 1건"이라는 다른 규칙이라 따로 둔다.
 * 불러오는 중·오류·공지 없음이면 카드를 통째로 숨긴다.
 */
export function LandingNotices() {
  const t = useTranslations("Home");
  const tc = useTranslations("Common");
  const { data } = useQuery({
    queryKey: noticeKeys.list(ANONYMOUS_VIEWER_ID, 0, LANDING_NOTICES_SIZE),
    queryFn: ({ signal }) => fetchNotices(0, LANDING_NOTICES_SIZE, signal),
  });

  if (!data || data.content.length === 0) return null;

  return (
    <section aria-label={t("noticesAria")} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[17px] font-bold text-fg">{t("noticesTitle")}</h2>
        <Link href="/notices" className={`text-xs text-fg-sub hover:text-fg ${HIT_HEAD}`}>
          {tc("viewAll")}
        </Link>
      </div>
      <ul className="overflow-hidden rounded-2xl border border-line bg-card">
        {data.content.slice(0, LANDING_NOTICES_SIZE).map((notice) => (
          <li key={notice.id} className="border-t border-row-line first:border-t-0">
            <Link href={`/notices/${notice.id}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5 hover:bg-table-head">
              <span className="truncate text-sm font-semibold text-fg">{notice.title}</span>
              <time dateTime={notice.createdAt} className="shrink-0 font-num text-xs text-fg-dim">
                {formatPlayedDate(notice.createdAt)}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
