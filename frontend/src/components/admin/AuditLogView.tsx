"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { actionLabel, adminKeys, AUDIT_LOG_PAGE_SIZE, detailText, fetchAuditLogs } from "@/lib/admin";
import { formatPlayedDate } from "@/lib/format";

/**
 * 감사 로그 (ROOT 전용, 읽기 전용). 최근 순으로 누가 언제 무엇을 바꿨는지 보여 준다.
 * 작업한 사람이 탈퇴했으면 `(탈퇴한 사용자)`로 보인다. 이메일은 서버가 내려 주지 않는다.
 */
export function AuditLogView({ viewerId }: { viewerId: number }) {
  const [page, setPage] = useState(0);
  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.auditLogs(viewerId, page),
    queryFn: ({ signal }) => fetchAuditLogs(page, AUDIT_LOG_PAGE_SIZE, signal),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/admin" aria-label="관리로" title="관리로" className="self-start rounded-full border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg">
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="text-xl font-semibold text-fg">감사 로그</h1>
        <p className="text-sm text-fg-sub">관리 작업 기록입니다. 최근 순으로 보여 줍니다.</p>
      </div>

      {isPending ? (
        <p className="text-sm text-fg-sub">불러오는 중입니다.</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-fg">
          {error instanceof ApiError ? error.message : "감사 로그를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
        </p>
      ) : data.content.length === 0 ? (
        <p className="text-sm text-fg-sub">아직 기록이 없습니다.</p>
      ) : (
        <>
          <ul aria-label="감사 로그" className="overflow-hidden rounded-[14px] border border-line bg-card">
            {data.content.map((log) => (
              <li key={log.id} className="flex flex-col gap-1 border-b border-line px-4 py-3 last:border-b-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-bold text-fg">{actionLabel(log.action)}</span>
                  <span className="font-num text-xs text-fg-dim">{formatPlayedDate(log.createdAt)}</span>
                </div>
                <p className="text-xs text-fg-sub">
                  {log.actorNickname ?? (log.actorId === null ? "(탈퇴한 사용자)" : `사용자 ${log.actorId}`)}
                  {log.targetType ? <span className="font-num"> · {log.targetType}{log.targetId ? ` #${log.targetId}` : ""}</span> : null}
                </p>
                {detailText(log.detail) ? <p className="break-all font-num text-xs text-fg-dim">{detailText(log.detail)}</p> : null}
              </li>
            ))}
          </ul>
          <nav aria-label="페이지 이동" className="flex items-center justify-center gap-3 text-sm text-fg-sub">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              className="rounded-full border border-chip-line px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
            >
              이전
            </button>
            <span className="font-num">
              {data.page + 1} / {Math.max(data.totalPages, 1)}
            </span>
            <button
              type="button"
              disabled={page + 1 >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-chip-line px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
            >
              다음
            </button>
          </nav>
        </>
      )}
    </div>
  );
}
