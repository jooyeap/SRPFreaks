"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { NoticeForm } from "@/components/notices/NoticeForm";
import { TierChangesFeed } from "@/components/notices/TierChangesFeed";
import { ApiError } from "@/lib/api";
import { formatPlayedDate } from "@/lib/format";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { usePageSize } from "@/lib/page-size";
import { createNotice, fetchNotices, noticeKeys, NOTICES_PAGE_SIZE, type NoticeValues } from "@/lib/notices";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";

function messageOf(error: unknown, t: Translator): string | null {
  if (!error) {
    return null;
  }
  return error instanceof ApiError ? error.message : t("Common.saveFailed");
}

type NoticeTab = "notices" | "tier-changes";

/**
 * 공지 화면은 두 탭이다(2026-11-01, D58): `공지사항`(운영자가 쓰는 글) / `서열표 변경`(서열표 변경 기록을 자동으로 보여 주는 목록).
 * 서열표 변경은 공지로 따로 쓰지 않는다. 공지에 분류를 붙이지 않는 D30은 그대로다.
 */
export function NoticesView({ viewerId, canWrite }: { viewerId: number; canWrite: boolean }) {
  const t = useTranslations();
  const [tab, setTab] = useState<NoticeTab>("notices");
  const tabs: readonly { value: NoticeTab; label: string }[] = [
    { value: "notices", label: t("Notices.tabNotices") },
    { value: "tier-changes", label: t("Notices.tabTierChanges") },
  ];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-fg">{t("Notices.title")}</h1>
      <div role="tablist" aria-label={t("Notices.tabsAria")} className="flex gap-1 rounded-xl border border-line bg-table-head p-1">
        {tabs.map((item) => {
          const selected = tab === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              id={`notices-tab-${item.value}`}
              aria-selected={selected}
              aria-controls="notices-panel"
              onClick={() => setTab(item.value)}
              // 선택은 굵은 글씨와 테두리로도 보인다(색만으로 구분하지 않는다)
              className={`min-h-10 flex-1 rounded-lg px-2 text-sm sm:px-4 ${
                selected ? "bg-card font-bold text-fg shadow-sm ring-1 ring-chip-line" : "text-fg-sub hover:text-fg"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id="notices-panel" aria-labelledby={`notices-tab-${tab}`}>
        {tab === "notices" ? <NoticeList viewerId={viewerId} canWrite={canWrite} /> : <TierChangesFeed />}
      </div>
    </div>
  );
}

/**
 * 공지사항 목록 (D30). 게시판처럼 제목·작성일만 최근 순으로 보여 주고, 줄을 누르면 상세 페이지(/notices/{id})로 간다.
 * 쓰기 폼은 canWrite(ADMIN·ROOT)일 때만 보인다(권한은 서버가 다시 검사한다). 고치기·삭제는 상세 페이지에서 한다.
 */
function NoticeList({ viewerId, canWrite }: { viewerId: number; canWrite: boolean }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [writing, setWriting] = useState(false);
  const [size, setSize] = usePageSize("notices", NOTICES_PAGE_SIZE);
  useScrollTopOnChange(page); // 다음·이전 페이지를 누르면 화면을 맨 위로 올린다

  const { data, isPending, isError, error } = useQuery({
    queryKey: noticeKeys.list(viewerId, page, size),
    queryFn: ({ signal }) => fetchNotices(page, size, signal),
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
      <div className="flex items-center justify-end gap-3">
        <PageSizeSelect
          value={size}
          onChange={(next) => {
            setSize(next);
            setPage(0);
          }}
        />
      </div>

      {/* 쓰기 폼은 `공지 쓰기`를 눌렀을 때만 펼친다(2026-10-27): 늘 펼쳐 두면 모바일에서 목록이 한 화면 아래로 밀린다.
          등록에 성공하면 닫고, 실패하면 입력한 내용을 그대로 둔 채 열어 둔다(mutateAsync가 오류를 던지면 닫지 않는다). */}
      {canWrite && writing ? (
        <NoticeForm
          label={t("Notices.writeTitle")}
          submitLabel={t("Notices.submit")}
          pending={create.isPending}
          error={messageOf(create.error, t)}
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            setWriting(false);
          }}
          onCancel={() => {
            create.reset();
            setWriting(false);
          }}
        />
      ) : canWrite ? (
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setWriting(true)}
          className="min-h-11 self-start rounded-lg border border-chip-line px-4 text-sm font-semibold text-fg hover:bg-table-head"
        >
          {t("Notices.writeTitle")}
        </button>
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
