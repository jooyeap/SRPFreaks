"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatPlayedDate } from "@/lib/format";
import { fetchNotices, noticeKeys } from "@/lib/notices";

const PREVIEW_SIZE = 3;

/**
 * 홈의 공지사항: 최근 공지 3건(제목 + 작성일)과 `전체 보기` 링크. 줄을 누르면 공지 화면(/notices)으로 간다.
 * 본문은 공지 화면에서만 보인다(홈은 제목만). 공지를 못 불러와도 홈 전체를 막지 않도록 오류일 때는 작은 안내만 둔다.
 * 공지 화면의 첫 페이지(10건)와 쿼리 키 크기만 다르다: 홈은 3건만 받는다.
 */
export function HomeNotices({ viewerId }: { viewerId: number }) {
  const { data, isPending, isError } = useQuery({
    queryKey: noticeKeys.list(viewerId, 0, PREVIEW_SIZE),
    queryFn: ({ signal }) => fetchNotices(0, PREVIEW_SIZE, signal),
  });

  return (
    <section aria-label="공지사항" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[17px] font-bold text-fg">공지사항</h2>
        <Link href="/notices" className="text-xs text-fg-sub hover:text-fg">
          전체 보기
        </Link>
      </div>
      {isPending ? (
        <p className="text-sm text-fg-sub">불러오는 중입니다.</p>
      ) : isError ? (
        <p className="text-sm text-fg-sub">공지사항을 불러오지 못했습니다.</p>
      ) : data.content.length === 0 ? (
        <p className="text-sm text-fg-sub">등록된 공지가 없습니다.</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-card">
          {data.content.map((notice) => (
            <li key={notice.id} className="border-t border-row-line first:border-t-0">
              <Link href={`/notices/${notice.id}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5 hover:bg-table-head">
                <span className="min-w-0 truncate text-sm font-semibold text-fg">{notice.title}</span>
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
