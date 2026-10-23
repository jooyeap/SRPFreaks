"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import type { AdminUserResponse, Role } from "@/lib/api-types";
import { adminKeys, ADMIN_USERS_PAGE_SIZE, ASSIGNABLE_ROLES, changeUserRole, changeUserStatus, fetchAdminUsers, roleLabel } from "@/lib/admin";
import { formatPlayedDate } from "@/lib/format";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";
import { useTranslations } from "next-intl";

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-fg";

/**
 * 사용자 목록, 역할 변경, 차단/차단 해제 (ROOT 전용). ADMIN을 지정하거나 해제하는 곳이다.
 * 차단은 로그인과 기록 입력을 막고 유저 목록에서 뺀다(기록은 지우지 않는다). 되돌릴 수 있지만 영향이 커서 확인 창을 한 번 거친다.
 * ROOT 계정에는 변경 칸이 없고, ROOT로 바꾸는 선택지도 없다(ROOT는 환경변수로만 만든다). 서버도 같은 규칙을 다시 검사한다.
 * 이메일은 ROOT가 누구인지 알아보는 데 필요해서 보여 주고, 감사 로그에는 사용자 id만 남는다.
 */
export function UsersAdminView({ viewerId }: { viewerId: number }) {
  const t = useTranslations();
  const [page, setPage] = useState(0);
  // draft = 입력 칸의 글자, query = 실제로 검색한 글자. 검색 버튼(또는 Enter)을 눌러야 query가 바뀌어 서버에 묻는다(글자마다 요청하지 않는다)
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  useScrollTopOnChange(page); // 다음·이전 페이지를 누르면 화면을 맨 위로 올린다
  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.users(viewerId, query, page),
    queryFn: ({ signal }) => fetchAdminUsers(page, ADMIN_USERS_PAGE_SIZE, query, signal),
    placeholderData: keepPreviousData,
  });

  function search(next: string) {
    setQuery(next.trim());
    setPage(0); // 검색어가 바뀌면 첫 쪽부터 본다
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/admin" aria-label={t("Admin.backAria")} title={t("Admin.backAria")} className="self-start min-h-11 rounded-lg border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg">
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="text-xl font-semibold text-fg">{t("Admin.usersTitle")}</h1>
        <p className="text-sm text-fg-sub">{t("Admin.usersLead")}</p>
      </div>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          search(draft);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={50}
          aria-label={t("Admin.usersSearchAria")}
          placeholder={t("Admin.usersSearchPlaceholder")}
          className={`${FIELD} min-w-0 flex-1`}
        />
        <button type="submit" className="h-10 rounded-xl bg-chip-on-bg px-5 text-sm font-extrabold text-chip-on-fg">
          {t("Admin.usersSearch")}
        </button>
        {query ? (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              search("");
            }}
            className="h-10 rounded-xl border border-chip-line px-4 text-sm text-fg-sub hover:text-fg"
          >
            {t("Admin.usersSearchReset")}
          </button>
        ) : null}
      </form>

      {isPending ? (
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-fg">
          {error instanceof ApiError ? error.message : t("Admin.usersLoadFailed")}
        </p>
      ) : (
        <>
          {data.content.length === 0 ? (
            <p className="text-sm text-fg-sub">{t(query ? "Admin.usersSearchEmpty" : "Admin.usersEmpty")}</p>
          ) : (
            <ul aria-label={t("Admin.usersListAria")} className="overflow-hidden rounded-2xl border border-line bg-card">
              {data.content.map((user) => (
                <UserRow key={user.id} user={user} />
              ))}
            </ul>
          )}
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

function UserRow({ user }: { user: AdminUserResponse }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<Role>(user.role);
  const name = user.nickname ?? t("Admin.noNickname");

  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (next: Role) => changeUserRole(user.id, next),
    onSuccess: async (saved) => {
      setRole(saved.role);
      toast(t("Admin.roleChanged"));
      await queryClient.invalidateQueries({ queryKey: adminKeys.usersAll });
      // 역할 변경은 감사 로그에 남으므로 목록도 오래된 것으로 표시한다
      await queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });

  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const blocked = user.status === "BLOCKED";
  const statusMutation = useMutation({
    mutationFn: () => changeUserStatus(user.id, blocked ? "ACTIVE" : "BLOCKED"),
    onSuccess: async (saved) => {
      setConfirmingStatus(false);
      toast(t(saved.status === "BLOCKED" ? "Admin.blockDone" : "Admin.unblockDone"));
      await queryClient.invalidateQueries({ queryKey: adminKeys.usersAll });
      await queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
    onError: () => setConfirmingStatus(false), // 오류는 줄 아래에 보인다
  });

  const isRoot = user.role === "ROOT";
  const failure = mutation.error ?? statusMutation.error;
  const error = failure instanceof ApiError ? failure.message : failure ? t("Admin.saveFailed") : null;

  return (
    <li className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-num text-sm font-bold text-fg">{name}</span>
        <span className="text-xs text-fg-sub">{roleLabel(user.role, t)}</span>
      </div>
      <p className="break-all text-xs text-fg-sub">
        {user.email}
        {user.status === "BLOCKED" ? <span className="text-fg"> {t("Admin.blocked")}</span> : null}
        <span className="font-num text-fg-dim"> · {t("Admin.joined", { date: formatPlayedDate(user.createdAt) })}</span>
      </p>
      {isRoot ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={t("Admin.roleAria", { name })}
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className={FIELD}
          >
            {ASSIGNABLE_ROLES.map((value) => (
              <option key={value} value={value}>
                {roleLabel(value, t)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => mutation.mutate(role)}
            disabled={role === user.role || mutation.isPending}
            aria-label={t("Admin.roleSaveAria", { name })}
            className="h-10 rounded-xl bg-chip-on-bg px-5 text-sm font-extrabold text-chip-on-fg disabled:opacity-40"
          >
            {mutation.isPending ? t("Common.saving") : t("Common.save")}
          </button>
          <button
            type="button"
            onClick={() => {
              statusMutation.reset();
              setConfirmingStatus(true);
            }}
            aria-label={t(blocked ? "Admin.unblockAria" : "Admin.blockAria", { name })}
            className="h-10 rounded-xl border border-chip-line px-4 text-sm text-fg-sub hover:text-fg"
          >
            {t(blocked ? "Admin.unblock" : "Admin.block")}
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirmingStatus}
        title={t(blocked ? "Admin.unblockTitle" : "Admin.blockTitle")}
        message={t(blocked ? "Admin.unblockMessage" : "Admin.blockMessage", { name })}
        confirmLabel={t(blocked ? "Admin.unblock" : "Admin.block")}
        pending={statusMutation.isPending}
        onConfirm={() => statusMutation.mutate()}
        onCancel={() => setConfirmingStatus(false)}
      />
      {error ? (
        <p role="alert" className="text-sm text-fg">
          {error}
        </p>
      ) : null}
    </li>
  );
}
