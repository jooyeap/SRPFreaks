"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorRetry } from "@/components/ErrorRetry";
import { ListNameForm } from "@/components/mylists/ListNameForm";
import { ListSongSearch } from "@/components/mylists/ListSongSearch";
import { ChartLine } from "@/components/table/ChartLine";
import { StageRatePill } from "@/components/table/StageRatePill";
import { useToast } from "@/components/Toast";
import type { Translator } from "@/i18n/translator";
import { ApiError } from "@/lib/api";
import type { UserListItemResponse } from "@/lib/api-types";
import { useJackets } from "@/lib/jackets";
import {
  createList,
  deleteList,
  fetchListDetail,
  fetchLists,
  listKeys,
  moveItem,
  removeFromList,
  renameList,
  reorderList,
} from "@/lib/user-lists";

function errorText(error: unknown, t: Translator): string {
  return error instanceof ApiError ? error.message : t("Common.actionFailed");
}

/**
 * 마이페이지 → 리스트 탭 → 「내 리스트」(D76, `?tab=list&view=mine`). 연습할 곡을 이름 붙여 모아 두는 개인 목록이다.
 * 세트리스트(오늘 칠 곡, 30곡, 완료 자동 계산)와 별개이고, **본인에게만 보인다**(공유 링크·공개 경로 없음).
 * 화면은 두 단계다: 리스트 목록(색인) → 한 리스트(곡 줄 + 편집). 어느 리스트를 열었는지는 화면 안 상태로만 들고 있다.
 */
export function MyListsTab({ userId }: { userId: number }) {
  const [openId, setOpenId] = useState<number | null>(null);
  return openId === null ? (
    <ListIndex userId={userId} onOpen={setOpenId} />
  ) : (
    <ListDetail userId={userId} listId={openId} onBack={() => setOpenId(null)} />
  );
}

function ListIndex({ userId, onOpen }: { userId: number; onOpen: (listId: number) => void }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const lists = useQuery({ queryKey: listKeys.index(userId, null), queryFn: ({ signal }) => fetchLists(null, signal) });

  const create = useMutation({
    mutationFn: (name: string) => createList(name),
    onSuccess: async (created) => {
      toast(t("MyList.created"));
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: listKeys.all });
      onOpen(created.id);
    },
    // 같은 이름·개수 한도 등 서버가 거절한 문구를 그대로 보인다(폼은 열어 둔다)
    onError: (error) => toast(errorText(error, t), { kind: "error" }),
  });

  if (lists.isPending) {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (lists.isError) {
    return (
      <ErrorRetry onRetry={() => void lists.refetch()} retrying={lists.isFetching}>
        {lists.error instanceof ApiError ? lists.error.message : t("MyList.loadFailed")}
      </ErrorRetry>
    );
  }
  const items = lists.data.content;

  return (
    <div className="flex flex-col gap-3">
      {creating ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <ListNameForm
            submitLabel={t("MyList.nameCreate")}
            pendingLabel={t("MyList.creating")}
            pending={create.isPending}
            onSubmit={(name) => create.mutate(name)}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-ctl px-3 text-sm text-fg hover:bg-table-head"
        >
          <span aria-hidden="true">+</span>
          {t("MyList.create")}
        </button>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-fg-sub">{t("MyList.empty")}</p>
      ) : (
        <ul aria-label={t("MyList.indexAria")} className="flex flex-col gap-2">
          {items.map((list) => (
            <li key={list.id}>
              <button
                type="button"
                onClick={() => onOpen(list.id)}
                aria-label={t("MyList.openAria", { name: list.name })}
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 text-left hover:bg-table-head"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{list.name}</span>
                <span className="shrink-0 font-num text-xs text-fg-sub">{t("MyList.itemCount", { count: list.itemCount })}</span>
                <span aria-hidden="true" className="shrink-0 text-fg-dim">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListDetail({ userId, listId, onBack }: { userId: number; listId: number; onBack: () => void }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adding, setAdding] = useState(false);

  const detail = useQuery({ queryKey: listKeys.detail(userId, listId, 0), queryFn: ({ signal }) => fetchListDetail(listId, 0, signal) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: listKeys.all });

  const rename = useMutation({
    mutationFn: (name: string) => renameList(listId, name),
    onSuccess: async () => {
      toast(t("MyList.renamed"));
      setRenaming(false);
      await refresh();
    },
    onError: (error) => toast(errorText(error, t), { kind: "error" }),
  });
  const remove = useMutation({
    mutationFn: () => deleteList(listId),
    onSuccess: async () => {
      toast(t("MyList.deleted"));
      setConfirmDelete(false);
      onBack();
      await refresh();
    },
    onError: (error) => {
      setConfirmDelete(false);
      toast(errorText(error, t), { kind: "error" });
    },
  });
  const removeItem = useMutation({
    mutationFn: (songDifficultyId: number) => removeFromList(listId, songDifficultyId),
    onSuccess: async () => {
      toast(t("MyList.removed"));
      await refresh();
    },
    onError: (error) => toast(errorText(error, t), { kind: "error" }),
  });
  const reorder = useMutation({
    mutationFn: (ids: number[]) => reorderList(listId, ids),
    onSuccess: refresh,
    onError: (error) => toast(errorText(error, t), { kind: "error" }),
  });

  const backButton = (
    <button type="button" onClick={onBack} className="flex min-h-9 w-fit items-center gap-1 text-sm text-fg-sub hover:text-fg">
      <span aria-hidden="true">‹</span>
      {t("MyList.back")}
    </button>
  );

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {backButton}
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      </div>
    );
  }
  if (detail.isError) {
    // 다른 사람 리스트·없는 리스트는 404라 이 화면으로 온다(존재 여부를 알리지 않는 서버 문구를 그대로 보인다)
    return (
      <div className="flex flex-col gap-3">
        {backButton}
        <ErrorRetry onRetry={() => void detail.refetch()} retrying={detail.isFetching}>
          {detail.error instanceof ApiError ? detail.error.message : t("MyList.loadFailed")}
        </ErrorRetry>
      </div>
    );
  }

  const { name, itemCount, items } = detail.data;
  const rows = items.content;
  const ids = rows.map((row) => row.songDifficultyId);
  const addedIds = new Set(ids);
  const busy = reorder.isPending || removeItem.isPending;

  return (
    <div className="flex flex-col gap-3">
      {backButton}

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-fg">{name}</h2>
          <p className="font-num text-xs text-fg-sub">{t("MyList.itemCount", { count: itemCount })}</p>
        </div>
        <button
          type="button"
          aria-pressed={editing}
          onClick={() => {
            setEditing((value) => !value);
            setRenaming(false);
          }}
          className="min-h-9 shrink-0 rounded-lg border border-ctl px-3 text-sm text-fg-sub hover:text-fg"
        >
          {editing ? t("MyList.editDone") : t("MyList.edit")}
        </button>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
          {renaming ? (
            <ListNameForm
              initialName={name}
              submitLabel={t("Common.save")}
              pendingLabel={t("Common.saving")}
              pending={rename.isPending}
              onSubmit={(next) => rename.mutate(next)}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => setRenaming(true)} className="min-h-9 rounded-lg border border-ctl px-3 text-sm text-fg hover:bg-table-head">
                {t("MyList.rename")}
              </button>
              <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-9 rounded-lg border border-ctl px-3 text-sm text-danger hover:bg-table-head">
                {t("MyList.deleteList")}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-fg-sub">{t("MyList.emptyItems")}</p>
      ) : (
        <ul aria-label={t("MyList.itemsAria", { name })} className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <ListItemRow
              key={row.id}
              item={row}
              editing={editing}
              busy={busy}
              first={index === 0}
              last={index === rows.length - 1}
              onUp={() => reorder.mutate(moveItem(ids, index, index - 1))}
              onDown={() => reorder.mutate(moveItem(ids, index, index + 1))}
              onRemove={() => removeItem.mutate(row.songDifficultyId)}
            />
          ))}
        </ul>
      )}

      {adding ? (
        <ListSongSearch userId={userId} listId={listId} addedIds={addedIds} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-ctl px-3 text-sm text-fg hover:bg-table-head"
        >
          <span aria-hidden="true">+</span>
          {t("MyList.addSong")}
        </button>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={t("MyList.deleteTitle")}
        message={t("MyList.deleteMessage", { name })}
        confirmLabel={t("Common.delete")}
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

/**
 * 리스트 안의 곡 한 줄. 세트리스트 줄과 같은 공통 줄(ChartLine)이고 오른쪽에 내 달성률·단계 알약이 있다(내 기록이 없으면 알약이 비어 있다).
 * 편집 모드에서는 알약 아래에 `[↑][↓][빼기]`가 나온다. 순서는 드래그가 아니라 위/아래 버튼으로 바꾼다(휴대폰에서 스크롤과 겹치지 않게).
 */
function ListItemRow({
  item,
  editing,
  busy,
  first,
  last,
  onUp,
  onDown,
  onRemove,
}: {
  item: UserListItemResponse;
  editing: boolean;
  busy: boolean;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations();
  const jackets = useJackets();
  const stage = item.mine?.stage ?? null;
  const buttonBase =
    "relative flex h-[26px] items-center justify-center whitespace-nowrap rounded-md border border-ctl px-1 text-xs after:absolute after:-inset-1.5 after:content-[''] enabled:hover:bg-table-head disabled:text-disabled";
  return (
    <ChartLine
      className="rounded-2xl border border-line bg-card"
      stage={stage}
      jacket={jackets.visible ? { url: jackets.urlOf(item.songId) } : null}
      pattern={item.pattern}
      tier={item.tier}
      title={item.title}
      href={`/songs/${item.songId}?chart=${item.songDifficultyId}`}
      part={item.part}
      difficulty={item.difficulty}
      level={item.level}
      aside={
        <div className={`flex shrink-0 flex-col items-end gap-1.5 ${editing ? "w-[124px]" : "w-[88px]"}`}>
          <StageRatePill stage={stage} rate={item.mine?.rate} />
          {editing ? (
            <div className="flex w-full gap-2">
              <button type="button" disabled={busy || first} onClick={onUp} aria-label={t("MyList.moveUp", { title: item.title })} className={`${buttonBase} w-8 shrink-0`}>
                ↑
              </button>
              <button type="button" disabled={busy || last} onClick={onDown} aria-label={t("MyList.moveDown", { title: item.title })} className={`${buttonBase} w-8 shrink-0`}>
                ↓
              </button>
              <button type="button" disabled={busy} onClick={onRemove} aria-label={t("MyList.removeAria", { title: item.title })} className={`${buttonBase} min-w-0 flex-1 text-fg-sub`}>
                {t("MyList.removeBtn")}
              </button>
            </div>
          ) : null}
        </div>
      }
    />
  );
}
