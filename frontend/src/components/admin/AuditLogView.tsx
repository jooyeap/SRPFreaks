"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import {
  actionKind,
  actionLabel,
  adminKeys,
  AUDIT_KINDS,
  AUDIT_LOG_PAGE_SIZE,
  AUDIT_LOG_SIZE_OPTIONS,
  detailReadable,
  detailText,
  EMPTY_AUDIT_FILTERS,
  fetchAuditLogs,
  groupAuditLogs,
  type AuditEntry,
  type AuditKind,
  type AuditLogFilters,
} from "@/lib/admin";
import type { AuditLogResponse } from "@/lib/api-types";
import type { Translator } from "@/i18n/translator";
import { formatSeoulDateTime } from "@/lib/format";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { usePageSize } from "@/lib/page-size";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";
import { useTranslations } from "next-intl";
import { AdminBackLink } from "@/components/admin/AdminBackLink";

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-fg";
const CHIP = "min-h-11 rounded-full border px-4 text-sm font-bold";
const CHIP_ON = "border-transparent bg-chip-on-bg text-chip-on-fg";
const CHIP_OFF = "border-ctl text-fg-sub hover:text-fg";

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
  // 종류 칩은 서버 API가 action 하나만 거를 수 있어서 받아 온 한 쪽 안에서 화면이 거른다(기능·API는 그대로).
  const [kind, setKind] = useState<AuditKind | "">("");
  const filtered = kind !== "" || filters.q !== "";
  useScrollTopOnChange(page); // 다음·이전 페이지를 누르면 화면을 맨 위로 올린다
  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.auditLogs(viewerId, page, size, filters),
    queryFn: ({ signal }) => fetchAuditLogs(page, size, filters, signal),
    placeholderData: keepPreviousData,
  });

  // 종류 칩으로 거른 뒤 날짜별로 나누고 같은 사람의 연속 작업을 묶는다(내용은 건드리지 않는다)
  const logs = data ? (kind === "" ? data.content : data.content.filter((log) => actionKind(log.action) === kind)) : [];
  const days = groupAuditLogs(logs);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <AdminBackLink />
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

      <div role="group" aria-label={t("Admin.auditActionAria")} className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={kind === ""} onClick={() => setKind("")} className={`${CHIP} ${kind === "" ? CHIP_ON : CHIP_OFF}`}>
          {t("Admin.auditActionAll")}
        </button>
        {AUDIT_KINDS.map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`${CHIP} ${kind === k ? CHIP_ON : CHIP_OFF}`}>
            {kindLabel(k, t)}
          </button>
        ))}
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
        <input
          type="search"
          value={draft}
          maxLength={50}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={t("Admin.auditSearchAria")}
          placeholder={t("Admin.auditSearchPlaceholder")}
          className={`${FIELD} min-w-40 flex-1`}
        />
        <button type="submit" className="min-h-11 rounded-lg border border-ctl px-3 py-1 text-sm text-fg-sub hover:text-fg">
          {t("Admin.usersSearch")}
        </button>
        {filtered ? (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setFilters(EMPTY_AUDIT_FILTERS);
              setKind("");
              setPage(0);
            }}
            className="min-h-11 rounded-lg border border-ctl px-3 py-1 text-sm text-fg-sub hover:text-fg"
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
      ) : logs.length === 0 ? (
        <p className="text-sm text-fg-sub">{t(filtered ? "Admin.usersSearchEmpty" : "Admin.auditEmpty")}</p>
      ) : (
        <>
          <ul aria-label={t("Admin.auditTitle")} className="overflow-hidden rounded-2xl border border-line bg-card">
            {days.map((day) => [
              <li key={`day-${day.date}`} className="border-b border-line bg-table-head px-4 py-2">
                <h2 className="font-num text-xs font-bold text-fg-sub">{day.date}</h2>
              </li>,
              ...day.entries.map((entry) =>
                entry.type === "single" ? (
                  <AuditLogItem key={entry.log.id} log={entry.log} />
                ) : (
                  <AuditGroupItem key={`group-${entry.key}`} entry={entry} />
                ),
              ),
            ])}
          </ul>
          <nav aria-label={t("Common.pageNav")} className="flex items-center justify-center gap-3 text-sm text-fg-sub">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              className="rounded-lg border border-ctl px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
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
              className="rounded-lg border border-ctl px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
            >
              {t("Common.next")}
            </button>
          </nav>
        </>
      )}
    </div>
  );
}

/** 종류 칩과 묶음 이름에 쓰는 화면 이름. */
function kindLabel(kind: AuditKind | "other", t: Translator): string {
  switch (kind) {
    case "songs":
      return t("Admin.auditKindSongs");
    case "table":
      return t("Admin.auditKindTable");
    case "users":
      return t("Admin.auditKindUsers");
    case "settings":
      return t("Admin.auditKindSettings");
    default:
      return t("Admin.auditKindOther");
  }
}

/** 로그 한 줄. 문구는 그대로이고(작업 이름·사람·대상·세부 내용) 묶음 안에서도 같은 모양을 쓴다. */
function AuditLogItem({ log, nested = false }: { log: AuditLogResponse; nested?: boolean }) {
  const t = useTranslations();
  return (
    <li className={`flex flex-col gap-1 px-4 py-3 ${nested ? "border-t border-line first:border-t-0" : "border-b border-line last:border-b-0"}`}>
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
  );
}

/** 같은 사람의 연속 작업 묶음. 접힌 채로 시작하고, 눌러 펼친다(aria-expanded). 펼친 안은 로그 한 줄과 같은 모양이다. */
function AuditGroupItem({ entry }: { entry: Extract<AuditEntry, { type: "group" }> }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const who = entry.logs[0].actorNickname ?? t("Admin.actorUser", { id: entry.actorId });
  const label = t("Admin.auditGroup", { kinds: entry.kinds.map((k) => kindLabel(k, t)).join("·"), count: entry.logs.length });
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? `audit-group-${entry.key}` : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-bold text-fg">{label}</span>
          <span className="text-xs text-fg-sub">{who}</span>
        </span>
        <span aria-hidden="true" className="font-num text-xs text-fg-dim">
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? (
        <ul id={`audit-group-${entry.key}`} aria-label={label} className="border-t border-line bg-bg">
          {entry.logs.map((log) => (
            <AuditLogItem key={log.id} log={log} nested />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
