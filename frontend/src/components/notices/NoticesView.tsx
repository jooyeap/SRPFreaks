"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { NoticeForm } from "@/components/notices/NoticeForm";
import { ApiError } from "@/lib/api";
import { formatPlayedDate } from "@/lib/format";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";
import { createNotice, fetchNotices, noticeKeys, NOTICES_PAGE_SIZE, type NoticeValues } from "@/lib/notices";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";

function messageOf(error: unknown, t: Translator): string | null {
  if (!error) {
    return null;
  }
  return error instanceof ApiError ? error.message : t("Common.saveFailed");
}

/**
 * 공지사항 목록 (D30). 게시판처럼 제목·작성일만 최근 순으로 보여 주고, 줄을 누르면 상세 페이지(/notices/{id})로 간다.
 * 쓰기 폼은 canWrite(ADMIN·ROOT)일 때만 보인다(권한은 서버가 다시 검사한다). 고치기·삭제는 상세 페이지에서 한다.
 */
export function NoticesView({ viewerId, canWrite }: { viewerId: number; canWrite: boolean }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  useScrollTopOnChange(page); // 다음·이전 페이지를 누르면 화면을 맨 위로 올린다

  const { data, isPending, isError, error } = useQuery({
    queryKey: noticeKeys.list(viewerId, page, NOTICES_PAGE_SIZE),
    queryFn: ({ signal }) => fetchNotices(page, NOTICES_PAGE_SIZE, signal),
    placeholderData: keepPreviousData,
  });

  const toast = useToast();
  const create = useMutation({
    mutationFn: (values: NoticeValues) => createNotice(values),
    onSuccess: async () => {
      toast(t("Notices.created"));
      // 목록과 감사 로그(관리 작업은 거기에 남는다)를 오래된 것으로 표시한다
      await queryClient.invalidateQueries({ queryKey: noticeKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-fg">{t("Notices.title")}</h1>

      {canWrite ? (
        <NoticeForm
          label={t("Notices.writeTitle")}
          submitLabel={t("Notices.submit")}
          pending={create.isPending}
          error={messageOf(create.error, t)}
          resetOnSuccess
          onSubmit={(values) => create.mutateAsync(values)}
        />
      ) : null}

      {isPending ? (
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-fg">
          {error instanceof ApiError ? error.message : t("Notices.loadFailed")}
        </p>
      ) : data.content.length === 0 ? (
        <p className="text-sm text-fg-sub">{t("Notices.empty")}</p>
      ) : (
        <>
          {/* 게시판 목록: 제목 한 줄 + 작성일. 본문은 상세 페이지에서만 보인다 */}
          <ul aria-label={t("Notices.listAria")} className="overflow-hidden rounded-2xl border border-line bg-card">
            {data.content.map((notice) => (
              <li key={notice.id} className="border-t border-line first:border-t-0">
                <Link href={`/notices/${notice.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 hover:bg-table-head">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-fg">{notice.title}</span>
                  <time dateTime={notice.createdAt} className="shrink-0 font-num text-xs text-fg-dim">
                    {formatPlayedDate(notice.createdAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
          <nav aria-label={t("Common.pageNav")} className="flex items-center justify-center gap-3 text-sm text-fg-sub">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              className="rounded-lg border border-chip-line px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
            >
              {t("Common.prev")}
            </button>
            <span className="font-num">
              {data.page + 1} / {Math.max(data.totalPages, 1)}
            </span>
            <button
              type="button"
              disabled={page + 1 >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-chip-line px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
            >
              {t("Common.next")}
            </button>
          </nav>
        </>
      )}
    </div>
  );
}
