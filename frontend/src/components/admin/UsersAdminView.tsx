"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { useId, useState } from "react";
import { ApiError } from "@/lib/api";
import type { AdminUserResponse, Role } from "@/lib/api-types";
import { adminKeys, ADMIN_USERS_PAGE_SIZE, ASSIGNABLE_ROLES, changeUserRole, changeUserStatus, fetchAdminUsers, roleLabel } from "@/lib/admin";
import { formatPlayedDate } from "@/lib/format";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { usePageSize } from "@/lib/page-size";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";
import { useTranslations } from "next-intl";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { RoleChangeDialog } from "@/components/admin/RoleChangeDialog";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-fg";

/**
 * 사용자 목록, 역할 변경, 차단/차단 해제 (ROOT 전용). ADMIN을 지정하거나 해제하는 곳이다.
 * 차단은 로그인과 기록 입력을 막고 유저 목록에서 뺀다(기록은 지우지 않는다). 되돌릴 수 있지만 영향이 커서 확인 창을 한 번 거친다.
 * ROOT 계정에는 변경 칸이 없고(변경 불가 표시), ROOT로 바꾸는 선택지도 없다(ROOT는 환경변수로만 만든다). 서버도 같은 규칙을 다시 검사한다.
 * 이메일은 ROOT가 누구인지 알아보는 데 필요해서 보여 주고(예전 화면에도 있던 값이다), 감사 로그에는 사용자 id만 남는다.
 *
 * 화면(D79): 폰은 압축 행(닉네임, 역할 칩)이고 누르면 펼쳐 역할 칩 선택·저장·차단이 나온다(한 번에 하나만).
 * 1024px 이상은 표(닉네임/이메일/역할/가입일/관리)이고 「역할 변경」은 작은 창에서 한다.
 * 같은 내용을 CSS로 두 번 그리지 않고 훅(useMediaQuery)으로 한쪽만 그린다. 기능·API·권한은 그대로다.
 */
export function UsersAdminView({ viewerId }: { viewerId: number }) {
  const t = useTranslations();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [page, setPage] = useState(0);
  const [size, setSize] = usePageSize("adminUsers", ADMIN_USERS_PAGE_SIZE);
  // draft = 입력 칸의 글자, query = 실제로 검색한 글자. 검색 버튼(또는 Enter)을 눌러야 query가 바뀌어 서버에 묻는다(글자마다 요청하지 않는다)
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  // 폰에서 펼친 사용자(한 번에 하나만)
  const [openId, setOpenId] = useState<number | null>(null);
  useScrollTopOnChange(page); // 다음·이전 페이지를 누르면 화면을 맨 위로 올린다
  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.users(viewerId, query, page, size),
    queryFn: ({ signal }) => fetchAdminUsers(page, size, query, signal),
    placeholderData: keepPreviousData,
  });

  function search(next: string) {
    setQuery(next.trim());
    setPage(0); // 검색어가 바뀌면 첫 쪽부터 본다
    setOpenId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <AdminBackLink />
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-fg">{t("Admin.usersTitle")}</h1>
          <PageSizeSelect
            value={size}
            onChange={(next) => {
              setSize(next);
              setPage(0);
              setOpenId(null);
            }}
          />
        </div>
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
            className="h-10 rounded-xl border border-ctl px-4 text-sm text-fg-sub hover:text-fg"
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
          ) : desktop ? (
            <table aria-label={t("Admin.usersListAria")} className="w-full overflow-hidden rounded-2xl border border-line bg-card text-left text-sm">
              <thead className="bg-table-head text-xs text-fg-sub">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    {t("Settings.nicknameLabel")}
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    {t("SettingsPage.email")}
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    {t("SettingsPage.role")}
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    {t("Admin.usersColJoined")}
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    {t("Admin.usersColManage")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((user) => (
                  <UserTableRow key={user.id} user={user} />
                ))}
              </tbody>
            </table>
          ) : (
            <ul aria-label={t("Admin.usersListAria")} className="overflow-hidden rounded-2xl border border-line bg-card">
              {data.content.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  expanded={user.id === openId}
                  onToggle={() => setOpenId(user.id === openId ? null : user.id)}
                />
              ))}
            </ul>
          )}
          <nav aria-label={t("Common.pageNav")} className="flex items-center justify-center gap-3 text-sm text-fg-sub">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => {
                setPage((p) => Math.max(p - 1, 0));
                setOpenId(null);
              }}
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
              onClick={() => {
                setPage((p) => p + 1);
                setOpenId(null);
              }}
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

/**
 * 한 사용자에 대한 동작(역할 변경, 차단/해제)과 그 상태. 폰의 펼친 카드와 데스크톱 표 줄이 같은 요청·같은 확인 창을 쓰도록 한 곳에 모았다.
 * 요청 주소·본문·성공 뒤 새로고침·오류 문구는 예전 UserRow와 같다.
 */
function useUserActions(user: AdminUserResponse) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const name = user.nickname ?? t("Admin.noNickname");
  const [role, setRole] = useState<Role>(user.role);

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

  const failure = mutation.error ?? statusMutation.error;
  const error = failure instanceof ApiError ? failure.message : failure ? t("Admin.saveFailed") : null;
  return { name, role, setRole, mutation, blocked, statusMutation, confirmingStatus, setConfirmingStatus, error };
}

type UserActions = ReturnType<typeof useUserActions>;

/** 차단/차단 해제 확인 창. 폰·데스크톱 모두 같은 창이다. */
function BlockConfirm({ actions }: { actions: UserActions }) {
  const t = useTranslations();
  const { name, blocked, statusMutation, confirmingStatus, setConfirmingStatus } = actions;
  return (
    <ConfirmDialog
      open={confirmingStatus}
      title={t(blocked ? "Admin.unblockTitle" : "Admin.blockTitle")}
      message={t(blocked ? "Admin.unblockMessage" : "Admin.blockMessage", { name })}
      confirmLabel={t(blocked ? "Admin.unblock" : "Admin.block")}
      pending={statusMutation.isPending}
      onConfirm={() => statusMutation.mutate()}
      onCancel={() => setConfirmingStatus(false)}
    />
  );
}

/** 차단 버튼(ROOT 줄에는 두지 않는다). 누르면 확인 창이 먼저 뜬다. */
function BlockButton({ actions }: { actions: UserActions }) {
  const t = useTranslations();
  const { name, blocked, statusMutation, setConfirmingStatus } = actions;
  return (
    <button
      type="button"
      onClick={() => {
        statusMutation.reset();
        setConfirmingStatus(true);
      }}
      aria-label={t(blocked ? "Admin.unblockAria" : "Admin.blockAria", { name })}
      className="h-10 rounded-xl border border-ctl px-4 text-sm text-fg-sub hover:text-fg"
    >
      {t(blocked ? "Admin.unblock" : "Admin.block")}
    </button>
  );
}

/**
 * 폰의 압축 행. 머리(닉네임, 역할 칩, 차단 표시) 전체가 하나의 버튼이고 누르면 펼친다(aria-expanded, 누르는 칸 44px 이상).
 * 펼치면 이메일·가입일, 역할 칩 선택, 「역할 저장」, 「차단」이 나온다. ROOT 줄은 펼치지 않고 「변경 불가」로 보인다.
 * 펼침 움직임은 기존 모션 토큰의 motion-reveal만 쓴다(새 keyframes 없음).
 */
function UserCard({ user, expanded, onToggle }: { user: AdminUserResponse; expanded: boolean; onToggle: () => void }) {
  const t = useTranslations();
  const bodyId = useId();
  const actions = useUserActions(user);
  const { name, role, setRole, mutation, blocked, error } = actions;
  const isRoot = user.role === "ROOT";

  const head = (
    <>
      <span className="font-num text-sm font-bold text-fg">{name}</span>
      <span className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-full border border-ctl px-2 py-0.5 text-fg-sub">{roleLabel(user.role, t)}</span>
        {blocked ? <span className="text-fg">{t("Admin.blocked")}</span> : null}
        {isRoot ? <span className="text-fg-sub">{t("Admin.userRootLocked")}</span> : null}
      </span>
    </>
  );

  return (
    <li className="border-b border-line last:border-b-0">
      {isRoot ? (
        // ROOT 줄은 바꿀 것이 없어 펼치지 않는다. 누가 ROOT인지 알아볼 수 있게 이메일·가입일은 그대로 보여 준다.
        <div className="flex flex-col gap-1 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">{head}</div>
          <UserMeta user={user} />
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={bodyId}
            className="flex min-h-11 w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3 text-left"
          >
            {head}
          </button>
          {expanded ? (
            <div id={bodyId} className="motion-reveal flex flex-col gap-2 px-4 pb-3">
              <UserMeta user={user} />
              <div role="radiogroup" aria-label={t("Admin.roleAria", { name })} className="flex flex-wrap gap-2">
                {ASSIGNABLE_ROLES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={role === value}
                    onClick={() => setRole(value)}
                    className={`min-h-11 rounded-full border px-4 text-sm font-bold ${
                      role === value ? "border-transparent bg-chip-on-bg text-chip-on-fg" : "border-ctl text-fg-sub hover:text-fg"
                    }`}
                  >
                    {roleLabel(value, t)}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => mutation.mutate(role)}
                  disabled={role === user.role || mutation.isPending}
                  aria-label={t("Admin.roleSaveAria", { name })}
                  className="h-10 rounded-xl bg-chip-on-bg px-5 text-sm font-extrabold text-chip-on-fg disabled:opacity-40"
                >
                  {mutation.isPending ? t("Common.saving") : t("Common.save")}
                </button>
                <BlockButton actions={actions} />
              </div>
            </div>
          ) : null}
        </>
      )}
      <BlockConfirm actions={actions} />
      {error ? (
        <p role="alert" className="px-4 pb-3 text-sm text-fg">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/** 이메일과 가입일(예전 줄과 같은 값). */
function UserMeta({ user }: { user: AdminUserResponse }) {
  const t = useTranslations();
  return (
    <p className="break-all text-xs text-fg-sub">
      {user.email}
      <span className="font-num text-fg-dim"> · {t("Admin.joined", { date: formatPlayedDate(user.createdAt) })}</span>
    </p>
  );
}

/**
 * 데스크톱 표의 한 줄: 닉네임 / 이메일 / 역할 / 가입일 / 관리. 관리 칸에는 「역할 변경」(작은 창)과 「차단」이 있고,
 * ROOT 줄에는 「변경 불가」만 있다. 오류는 줄 바로 아래 칸에 보인다.
 */
function UserTableRow({ user }: { user: AdminUserResponse }) {
  const t = useTranslations();
  const actions = useUserActions(user);
  const { name, mutation, blocked, error } = actions;
  const [roleOpen, setRoleOpen] = useState(false);
  const isRoot = user.role === "ROOT";
  return (
    <>
      <tr className="border-t border-line align-middle">
        <td className="px-4 py-2 font-num font-bold text-fg">{name}</td>
        <td className="break-all px-4 py-2 text-fg-sub">
          {user.email}
          {blocked ? <span className="text-fg"> {t("Admin.blocked")}</span> : null}
        </td>
        <td className="px-4 py-2 text-fg-sub">{roleLabel(user.role, t)}</td>
        <td className="px-4 py-2 font-num text-fg-dim">{formatPlayedDate(user.createdAt)}</td>
        <td className="px-4 py-2">
          {isRoot ? (
            <span className="text-xs text-fg-sub">{t("Admin.userRootLocked")}</span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  mutation.reset();
                  setRoleOpen(true);
                }}
                aria-label={`${t("Admin.actionUserRoleChange")}: ${name}`}
                className="h-10 rounded-xl border border-ctl px-4 text-sm text-fg-sub hover:text-fg"
              >
                {t("Admin.actionUserRoleChange")}
              </button>
              <BlockButton actions={actions} />
            </div>
          )}
          {/* <dialog>는 <tbody> 바로 아래에 둘 수 없어서 관리 칸 안에 둔다(열리면 화면 맨 위 층에 뜬다) */}
          {roleOpen ? (
            <RoleChangeDialog
              open
              name={name}
              current={user.role}
              pending={mutation.isPending}
              error={error}
              onSave={(next) => mutation.mutate(next, { onSuccess: () => setRoleOpen(false) })}
              onCancel={() => setRoleOpen(false)}
            />
          ) : null}
          <BlockConfirm actions={actions} />
        </td>
      </tr>
      {error && !roleOpen ? (
        <tr>
          <td colSpan={5} role="alert" className="px-4 pb-2 text-sm text-fg">
            {error}
          </td>
        </tr>
      ) : null}
    </>
  );
}
