"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import {
  actionLabel,
  adminKeys,
  AUDIT_ACTIONS,
  AUDIT_LOG_PAGE_SIZE,
  AUDIT_LOG_SIZE_OPTIONS,
  detailReadable,
  detailText,
  EMPTY_AUDIT_FILTERS,
  fetchAuditLogs,
  type AuditLogFilters,
} from "@/lib/admin";
import { formatSeoulDateTime } from "@/lib/format";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { usePageSize } from "@/lib/page-size";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";
import { useTranslations } from "next-intl";

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-fg";

/**
 * 감사 로그 (ROOT 전용, 읽기 전용). 최근 순으로 누가 언제 무엇을 바꿨는지 보여 준다.
 * 작업한 사람이 탈퇴했으면 `(탈퇴한 사용자)`로 보인다. 이메일은 서버가 내려 주지 않는다.
 */
export function AuditLogView({ viewerId }: { viewerId: number }) {
  const t = useTranslations();
  const [page, setPage] = useState(0);
  const [size, setSize] = usePageSize("auditLogs", AUDIT_LOG_PAGE_SIZE, AUDIT_LOG_SIZE_OPTIONS);
  // 검색어는 입력 중(draft)과 실제 적용(filters.q)을 나눈다: 검색 버튼·엔터를 눌러야 요청한다. 작업 종류는 고르면 바로 적용한다.
  const [draft, setDraft] = useState("");
  const [filters, setFilters] = useState<AuditLogFilters>(EMPTY_AUDIT_FILTERS);
  const filtered = filters.action !== "" || filters.q !== "";
  useScrollTopOnChange(page); // 다음·이전 페이지를 누르면 화면을 맨 위로 올린다
  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.auditLogs(viewerId, page, size, filters),
    queryFn: ({ signal }) => fetchAuditLogs(page, size, filters, signal),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/admin" aria-label={t("Admin.backAria")} title={t("Admin.backAria")} className="self-start min-h-11 rounded-lg border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg">
          <span aria-hidden="true">←</span>
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-fg">{t("Admin.auditTitle")}</h1>
          <PageSizeSelect
            value={size}
            options={AUDIT_LOG_SIZE_OPTIONS}
            onChange={(next) => {
              setSize(next);
              setPage(0);
            }}
          />
        </div>
        <p className="text-sm text-fg-sub">{t("Admin.auditLead")}</p>
      </div>

      <form
        role="search"
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters((f) => ({ ...f, q: draft.trim() }));
          setPage(0); // 조건이 바뀌면 첫 페이지부터
        }}
      >
        <select
          aria-label={t("Admin.auditActionAria")}
          value={filters.action}
          onChange={(e) => {
            setFilters((f) => ({ ...f, action: e.target.value }));
            setPage(0);
          }}
          className={FIELD}
        >
          <option value="">{t("Admin.auditActionAll")}</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {actionLabel(a, t)}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={draft}
          maxLength={50}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={t("Admin.auditSearchAria")}
          placeholder={t("Admin.auditSearchPlaceholder")}
          className={`${FIELD} min-w-40 flex-1`}
        />
        <button type="submit" className="min-h-11 rounded-lg border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg">
          {t("Admin.usersSearch")}
        </button>
        {filtered ? (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setFilters(EMPTY_AUDIT_FILTERS);
              setPage(0);
            }}
            className="min-h-11 rounded-lg border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg"
          >
            {t("Admin.usersSearchReset")}
          </button>
        ) : null}
      </form>

      {isPending ? (
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-fg">
          {error instanceof ApiError ? error.message : t("Admin.auditLoadFailed")}
        </p>
      ) : data.content.length === 0 ? (
        <p className="text-sm text-fg-sub">{t(filtered ? "Admin.usersSearchEmpty" : "Admin.auditEmpty")}</p>
      ) : (
        <>
          <ul aria-label={t("Admin.auditTitle")} className="overflow-hidden rounded-2xl border border-line bg-card">
            {data.content.map((log) => (
              <li key={log.id} className="flex flex-col gap-1 border-b border-line px-4 py-3 last:border-b-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-bold text-fg">{actionLabel(log.action, t)}</span>
                  <span className="font-num text-xs text-fg-dim">{formatSeoulDateTime(log.createdAt)}</span>
                </div>
                <p className="text-xs text-fg-sub">
                  {log.actorNickname ?? (log.actorId === null ? t("Admin.withdrawnUser") : t("Admin.actorUser", { id: log.actorId }))}
                  {log.targetType ? <span className="font-num"> · {log.targetType}{log.targetId ? ` #${log.targetId}` : ""}</span> : null}
                </p>
                {/* 개발용 JSON 대신 `KJY → HJY`, `제목: …`처럼 읽기 쉽게(2026-10-27). 마우스를 올리면 원문 JSON이 보인다(title) */}
                {detailReadable(log.detail, t) ? (
                  <p className="break-words text-xs text-fg-sub" title={detailText(log.detail)}>
                    {detailReadable(log.detail, t)}
                  </p>
                ) : null}
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
