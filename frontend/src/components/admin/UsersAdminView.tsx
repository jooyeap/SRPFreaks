"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import type { AdminUserResponse, Role } from "@/lib/api-types";
import { adminKeys, ADMIN_USERS_PAGE_SIZE, ASSIGNABLE_ROLES, changeUserRole, fetchAdminUsers, roleLabel } from "@/lib/admin";
import { formatPlayedDate } from "@/lib/format";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-fg";

/**
 * 사용자 목록과 역할 변경 (ROOT 전용). ADMIN을 지정하거나 해제하는 곳이다.
 * ROOT 계정에는 변경 칸이 없고, ROOT로 바꾸는 선택지도 없다(ROOT는 환경변수로만 만든다). 서버도 같은 규칙을 다시 검사한다.
 * 이메일은 ROOT가 누구인지 알아보는 데 필요해서 보여 주고, 감사 로그에는 사용자 id만 남는다.
 */
export function UsersAdminView({ viewerId }: { viewerId: number }) {
  const [page, setPage] = useState(0);
  useScrollTopOnChange(page); // 다음·이전 페이지를 누르면 화면을 맨 위로 올린다
  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.users(viewerId, page),
    queryFn: ({ signal }) => fetchAdminUsers(page, ADMIN_USERS_PAGE_SIZE, signal),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/admin" aria-label="관리로" title="관리로" className="self-start rounded-full border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg">
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="text-xl font-semibold text-fg">사용자</h1>
        <p className="text-sm text-fg-sub">관리자(ADMIN)는 곡·채보와 서열표를 관리할 수 있습니다. 역할은 바로 적용되고 감사 로그에 남습니다.</p>
      </div>

      {isPending ? (
        <p className="text-sm text-fg-sub">불러오는 중입니다.</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-fg">
          {error instanceof ApiError ? error.message : "사용자 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
        </p>
      ) : (
        <>
          <ul aria-label="사용자 목록" className="overflow-hidden rounded-[14px] border border-line bg-card">
            {data.content.map((user) => (
              <UserRow key={user.id} viewerId={viewerId} page={page} user={user} />
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

function UserRow({ viewerId, page, user }: { viewerId: number; page: number; user: AdminUserResponse }) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<Role>(user.role);
  const name = user.nickname ?? "(닉네임 없음)";

  const mutation = useMutation({
    mutationFn: (next: Role) => changeUserRole(user.id, next),
    onSuccess: async (saved) => {
      setRole(saved.role);
      await queryClient.invalidateQueries({ queryKey: adminKeys.users(viewerId, page) });
      // 역할 변경은 감사 로그에 남으므로 목록도 오래된 것으로 표시한다
      await queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });

  const isRoot = user.role === "ROOT";
  const error =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? "저장하지 못했습니다. 잠시 후 다시 시도해 주세요."
        : null;

  return (
    <li className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-num text-sm font-bold text-fg">{name}</span>
        <span className="text-xs text-fg-sub">{roleLabel(user.role)}</span>
      </div>
      <p className="break-all text-xs text-fg-sub">
        {user.email}
        {user.status === "BLOCKED" ? <span className="text-fg"> · 차단됨</span> : null}
        <span className="font-num text-fg-dim"> · 가입 {formatPlayedDate(user.createdAt)}</span>
      </p>
      {isRoot ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={`${name} 역할`}
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className={FIELD}
          >
            {ASSIGNABLE_ROLES.map((value) => (
              <option key={value} value={value}>
                {roleLabel(value)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => mutation.mutate(role)}
            disabled={role === user.role || mutation.isPending}
            aria-label={`${name} 역할 저장`}
            className="h-10 rounded-xl bg-chip-on-bg px-5 text-sm font-extrabold text-chip-on-fg disabled:opacity-40"
          >
            {mutation.isPending ? "저장 중" : "저장"}
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-fg">
          {error}
        </p>
      ) : null}
    </li>
  );
}
