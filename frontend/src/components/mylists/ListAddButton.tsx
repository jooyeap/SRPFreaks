"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useOptionalUser } from "@/components/AuthProvider";
import { ListNameForm } from "@/components/mylists/ListNameForm";
import { useToast } from "@/components/Toast";
import type { Translator } from "@/i18n/translator";
import { ApiError } from "@/lib/api";
import { addToSetlist, fetchSetlist, removeFromSetlist, SETLIST_LIMIT, setlistKeys } from "@/lib/setlist";
import { useHistoryClose } from "@/lib/use-history-close";
import { addToList, createList, fetchLists, listKeys, removeFromList } from "@/lib/user-lists";

function errorText(error: unknown, t: Translator): string {
  return error instanceof ApiError ? error.message : t("Common.actionFailed");
}

/** 곡 상세에서 「내 리스트」 탭을 여는 주소(리스트가 하나도 없을 때 토스트 링크가 간다) */
export const MY_LISTS_HREF = "/me?tab=list&view=mine";

/**
 * 곡 상세의 「리스트에 추가」 버튼 (D76). 예전 세트리스트 `담기/담김` 토글(D49)을 대신한다. 로그인하지 않았으면 아무것도 그리지 않는다.
 *
 * - 내 리스트가 **0개**: 시트 없이 세트리스트에 바로 담고(이미 담겨 있으면 뺀다 — 예전 토글과 같다), 토스트에 `리스트 만들기` 링크를 붙인다.
 * - 내 리스트가 **1개 이상**: 아래에서 올라오는 시트를 연다(ListAddSheet). 세트리스트와 내 리스트가 한 줄씩 있고 각 줄이 담기/담김 토글이다.
 * 세트리스트 로직(30곡 한도·완료 계산)은 그대로고, 여기서는 기존 API(addToSetlist/removeFromSetlist)를 같은 쿼리 키로 부르기만 한다.
 * 담김 표시: 세트리스트나 내 리스트 어디든 이 채보가 들어 있으면 버튼에 체크 아이콘이 붙는다(색만으로 알리지 않는다).
 */
export function ListAddButton({ songDifficultyId, title }: { songDifficultyId: number; title: string }) {
  const user = useOptionalUser();
  if (!user) {
    return null;
  }
  return <ButtonInner userId={user.id} songDifficultyId={songDifficultyId} title={title} />;
}

function ButtonInner({ userId, songDifficultyId, title }: { userId: number; songDifficultyId: number; title: string }) {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const setlist = useQuery({ queryKey: setlistKeys.list(userId), queryFn: ({ signal }) => fetchSetlist(signal) });
  // 이 채보가 어느 리스트에 담겼는지(contains)까지 한 번에 받는다 — 줄마다 따로 묻지 않는다(N+1 없음)
  const lists = useQuery({ queryKey: listKeys.index(userId, songDifficultyId), queryFn: ({ signal }) => fetchLists(songDifficultyId, signal) });

  const inSetlist = setlist.data?.content.find((item) => item.songDifficultyId === songDifficultyId);
  const inAnyList = lists.data?.content.some((list) => list.contains) ?? false;
  const marked = inSetlist !== undefined || inAnyList;
  const noLists = lists.isSuccess && lists.data.totalElements === 0;

  // 리스트가 없을 때의 바로 담기(토글)
  const quick = useMutation({
    mutationFn: async () => {
      if (inSetlist) {
        await removeFromSetlist(inSetlist.id);
        return "removed" as const;
      }
      await addToSetlist(songDifficultyId);
      return "added" as const;
    },
    onSuccess: async (result) => {
      if (result === "removed") {
        toast(t("Setlist.removed"));
      } else {
        // 이 토스트 문구와 링크 글자(`리스트 만들기`)는 임시다
        toast(t("Setlist.added"), { action: { label: t("MyList.makeList"), onAction: () => router.push(MY_LISTS_HREF) } });
      }
      await queryClient.invalidateQueries({ queryKey: setlistKeys.all });
    },
    onError: (error) => toast(errorText(error, t), { kind: "error" }),
  });

  return (
    <>
      <button
        type="button"
        // 담김 여부를 모르는 동안(목록 로딩 중)은 누를 수 없게 한다
        disabled={setlist.isPending || lists.isPending || quick.isPending}
        onClick={() => (noLists || lists.isError ? quick.mutate() : setOpen(true))}
        aria-haspopup={noLists || lists.isError ? undefined : "dialog"}
        aria-label={t("MyList.addAria", { title })}
        // 보이는 높이는 32px 그대로, ::after로 누를 수 있는 영역만 넓힌다(옆 버튼과 겹치지 않게 가로는 4px만)
        className="relative flex h-9 shrink-0 items-center gap-1 rounded-lg border border-ctl px-3 text-sm text-fg after:absolute after:-inset-x-1 after:-inset-y-1 after:content-[''] enabled:hover:bg-table-head disabled:text-disabled"
      >
        {marked ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5 9-10" />
          </svg>
        ) : null}
        {t("MyList.addToList")}
      </button>
      <ListAddSheet
        open={open}
        songDifficultyId={songDifficultyId}
        title={title}
        inSetlistId={inSetlist?.id ?? null}
        setlistCount={setlist.data?.content.length ?? 0}
        lists={lists.data?.content ?? []}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * 「리스트에 추가」 시트. 맨 위 줄은 세트리스트, 그 아래는 내 리스트들이고 줄마다 담기/담김 토글이다(여러 곳에 동시에 담을 수 있다).
 * 담김을 다시 누르면 뺀다. 맨 아래 `+ 새 리스트에 담기`는 이름을 입력해 리스트를 만들고 이 곡을 바로 담는다.
 * 뒤로 가기는 시트만 닫는다(useHistoryClose). 브라우저 기본 <dialog>(showModal)라 포커스 가두기·Esc 닫기가 기본으로 된다.
 */
function ListAddSheet({
  open,
  songDifficultyId,
  title,
  inSetlistId,
  setlistCount,
  lists,
  onClose,
}: {
  open: boolean;
  songDifficultyId: number;
  title: string;
  inSetlistId: number | null;
  setlistCount: number;
  lists: readonly { id: number; name: string; contains: boolean }[];
  onClose: () => void;
}) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const ref = useRef<HTMLDialogElement>(null);
  const [creating, setCreating] = useState(false);
  useHistoryClose(open, onClose);

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) {
      return;
    }
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }, [open]);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: setlistKeys.all }),
      queryClient.invalidateQueries({ queryKey: listKeys.all }),
    ]);
  };

  // 한 줄을 누르면 담김 여부에 따라 담거나 뺀다. target: 세트리스트(null) 또는 리스트 id
  const toggle = useMutation({
    mutationFn: async (target: { kind: "setlist" } | { kind: "list"; id: number; contains: boolean }) => {
      if (target.kind === "setlist") {
        if (inSetlistId !== null) {
          await removeFromSetlist(inSetlistId);
          return "removed" as const;
        }
        await addToSetlist(songDifficultyId);
        return "added" as const;
      }
      if (target.contains) {
        await removeFromList(target.id, songDifficultyId);
        return "removed" as const;
      }
      await addToList(target.id, songDifficultyId);
      return "added" as const;
    },
    onSuccess: async (result, target) => {
      const key = target.kind === "setlist" ? (result === "added" ? "Setlist.added" : "Setlist.removed") : result === "added" ? "MyList.added" : "MyList.removed";
      toast(t(key));
      await refreshAll();
    },
    // 30곡이 찼거나 리스트 곡 수 한도에 닿은 경우 등 서버가 거절한 문구를 그대로 보여 준다
    onError: (error) => toast(errorText(error, t), { kind: "error" }),
  });

  const createAndAdd = useMutation({
    mutationFn: async (name: string) => {
      const created = await createList(name);
      await addToList(created.id, songDifficultyId);
      return created;
    },
    onSuccess: async (created) => {
      toast(t("MyList.createdAndAdded", { name: created.name }));
      setCreating(false);
      await refreshAll();
    },
    onError: async (error) => {
      toast(errorText(error, t), { kind: "error" });
      // 리스트는 만들어졌는데 담기만 실패했을 수 있으니 목록을 다시 받는다
      await refreshAll();
    },
  });

  if (!open) {
    return null;
  }

  const setlistFull = inSetlistId === null && setlistCount >= SETLIST_LIMIT;
  const pendingTarget = toggle.isPending ? toggle.variables : null;
  const rowClass =
    "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-line px-4 text-left text-sm text-fg enabled:hover:bg-table-head disabled:text-disabled";
  const mark = (on: boolean) =>
    on ? (
      <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-done-text">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5 9-10" />
        </svg>
        {t("Setlist.addedMark")}
      </span>
    ) : (
      <span className="shrink-0 text-xs text-fg-sub">{t("Setlist.addBtn")}</span>
    );

  return (
    <dialog
      ref={ref}
      aria-labelledby="list-add-sheet-title"
      onClose={onClose}
      onClick={(event) => {
        // 창 바깥(::backdrop)을 누르면 dialog 자신이 target이 된다
        if (event.target === ref.current) onClose();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[85vh] w-full max-w-md overflow-y-auto rounded-b-none rounded-t-2xl border border-line bg-card p-5 text-fg backdrop:bg-black/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="list-add-sheet-title" className="text-lg font-extrabold">
            {t("MyList.sheetTitle")}
          </h2>
          <p className="mt-0.5 truncate text-xs text-fg-sub">{title}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t("Common.close")} className="min-h-9 shrink-0 rounded-lg px-2 text-sm text-fg-sub hover:text-fg">
          {t("Common.close")}
        </button>
      </div>
      <p className="mt-2 text-xs text-fg-sub">{t("MyList.sheetHint")}</p>

      <ul className="mt-3 flex flex-col gap-2">
        <li>
          <button
            type="button"
            disabled={toggle.isPending || setlistFull}
            aria-pressed={inSetlistId !== null}
            aria-label={t(inSetlistId !== null ? "Setlist.removeAria" : "Setlist.addAria", { title })}
            title={setlistFull ? t("Setlist.limitFull", { limit: SETLIST_LIMIT }) : undefined}
            onClick={() => toggle.mutate({ kind: "setlist" })}
            className={rowClass}
          >
            <span className="min-w-0 flex-1 truncate font-semibold">{t("Setlist.title")}</span>
            {pendingTarget?.kind === "setlist" ? null : mark(inSetlistId !== null)}
          </button>
        </li>
        {lists.map((list) => (
          <li key={list.id}>
            <button
              type="button"
              disabled={toggle.isPending}
              aria-pressed={list.contains}
              aria-label={t(list.contains ? "MyList.rowRemoveAria" : "MyList.rowAddAria", { title, name: list.name })}
              onClick={() => toggle.mutate({ kind: "list", id: list.id, contains: list.contains })}
              className={rowClass}
            >
              <span className="min-w-0 flex-1 truncate">{list.name}</span>
              {pendingTarget?.kind === "list" && pendingTarget.id === list.id ? null : mark(list.contains)}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3">
        {creating ? (
          <ListNameForm
            submitLabel={t("MyList.newAddBtn")}
            pendingLabel={t("MyList.creating")}
            pending={createAndAdd.isPending}
            onSubmit={(name) => createAndAdd.mutate(name)}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-ctl px-3 text-sm text-fg hover:bg-table-head"
          >
            <span aria-hidden="true">+</span>
            {t("MyList.newListAdd")}
          </button>
        )}
      </div>
    </dialog>
  );
}
