"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { NoticeForm } from "@/components/notices/NoticeForm";
import { ApiError } from "@/lib/api";
import type { NoticeResponse } from "@/lib/api-types";
import { formatPlayedDate } from "@/lib/format";
import {
  createNotice,
  deleteNotice,
  fetchNotices,
  noticeKeys,
  NOTICES_PAGE_SIZE,
  updateNotice,
  type NoticeValues,
} from "@/lib/notices";

function messageOf(error: unknown): string | null {
  if (!error) {
    return null;
  }
  return error instanceof ApiError ? error.message : "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

/**
 * 공지사항 (D30). 로그인한 사용자는 최근 순으로 읽고, canWrite(ADMIN·ROOT)이면 쓰기·고치기·삭제도 할 수 있다.
 * 본문은 글자로만 그린다(줄바꿈만 살리고 HTML은 해석하지 않는다). 쓰기 권한은 서버가 다시 검사한다(403).
 */
export function NoticesView({ viewerId, canWrite }: { viewerId: number; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  // 고치는 중인 공지와 삭제 확인 중인 공지의 id (한 번에 하나씩)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data, isPending, isError, error } = useQuery({
    queryKey: noticeKeys.list(viewerId, page, NOTICES_PAGE_SIZE),
    queryFn: ({ signal }) => fetchNotices(page, NOTICES_PAGE_SIZE, signal),
    placeholderData: keepPreviousData,
  });

  // 쓰기·고치기·삭제는 목록과 감사 로그(관리 작업은 거기에 남는다)를 오래된 것으로 표시한다
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: noticeKeys.all });
    await queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
  };
  const create = useMutation({ mutationFn: (values: NoticeValues) => createNotice(values), onSuccess: refresh });
  const update = useMutation({
    mutationFn: ({ id, values }: { id: number; values: NoticeValues }) => updateNotice(id, values),
    onSuccess: async () => {
      setEditingId(null);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteNotice(id),
    onSuccess: async () => {
      setDeletingId(null);
      await refresh();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-fg">공지사항</h1>

      {canWrite ? (
        <NoticeForm
          label="공지 쓰기"
          submitLabel="공지 등록"
          pending={create.isPending}
          error={messageOf(create.error)}
          resetOnSuccess
          onSubmit={(values) => create.mutateAsync(values)}
        />
      ) : null}

      {isPending ? (
        <p className="text-sm text-fg-sub">불러오는 중입니다.</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-fg">
          {error instanceof ApiError ? error.message : "공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
        </p>
      ) : data.content.length === 0 ? (
        <p className="text-sm text-fg-sub">등록된 공지사항이 없습니다.</p>
      ) : (
        <>
          <ul aria-label="공지사항 목록" className="flex flex-col gap-3">
            {data.content.map((notice) => (
              <NoticeItem
                key={notice.id}
                notice={notice}
                canWrite={canWrite}
                editing={editingId === notice.id}
                deleting={deletingId === notice.id}
                updatePending={update.isPending}
                updateError={editingId === notice.id ? messageOf(update.error) : null}
                removePending={remove.isPending}
                removeError={deletingId === notice.id ? messageOf(remove.error) : null}
                onEdit={() => {
                  update.reset();
                  setDeletingId(null);
                  setEditingId(notice.id);
                }}
                onCancelEdit={() => setEditingId(null)}
                onSave={(values) => update.mutateAsync({ id: notice.id, values })}
                onAskDelete={() => {
                  remove.reset();
                  setEditingId(null);
                  setDeletingId(notice.id);
                }}
                onCancelDelete={() => setDeletingId(null)}
                onConfirmDelete={() => remove.mutate(notice.id)}
              />
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

function NoticeItem({
  notice,
  canWrite,
  editing,
  deleting,
  updatePending,
  updateError,
  removePending,
  removeError,
  onEdit,
  onCancelEdit,
  onSave,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  notice: NoticeResponse;
  canWrite: boolean;
  editing: boolean;
  deleting: boolean;
  updatePending: boolean;
  updateError: string | null;
  removePending: boolean;
  removeError: string | null;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (values: NoticeValues) => Promise<unknown>;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  if (editing) {
    return (
      <li>
        <NoticeForm
          label="공지 고치기"
          initial={{ title: notice.title, content: notice.content }}
          submitLabel="저장"
          pending={updatePending}
          error={updateError}
          onSubmit={onSave}
          onCancel={onCancelEdit}
        />
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-bold text-fg">{notice.title}</h2>
        <time dateTime={notice.createdAt} className="shrink-0 font-num text-xs text-fg-dim">
          {formatPlayedDate(notice.createdAt)}
        </time>
      </div>
      {/* 글자로만 그린다: 줄바꿈은 살리고(whitespace-pre-wrap) HTML은 해석하지 않는다 */}
      <p className="whitespace-pre-wrap break-words text-sm text-fg">{notice.content}</p>
      {canWrite ? (
        deleting ? (
          <div role="alertdialog" aria-label="공지 삭제 확인" className="flex flex-col gap-2">
            <p className="text-sm text-fg">이 공지를 삭제할까요? 삭제한 공지는 되돌릴 수 없습니다.</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={removePending}
                onClick={onConfirmDelete}
                className="rounded-full border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head disabled:opacity-60"
              >
                {removePending ? "삭제 중" : "삭제"}
              </button>
              <button
                type="button"
                disabled={removePending}
                onClick={onCancelDelete}
                className="rounded-full border border-chip-line px-4 py-1.5 text-sm text-fg-sub hover:text-fg"
              >
                취소
              </button>
            </div>
            {removeError ? (
              <p role="alert" className="text-sm text-fg">
                {removeError}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`${notice.title} 고치기`}
              className="rounded-full border border-chip-line px-3 py-1 text-xs text-fg-sub hover:text-fg"
            >
              고치기
            </button>
            <button
              type="button"
              onClick={onAskDelete}
              aria-label={`${notice.title} 삭제`}
              className="rounded-full border border-chip-line px-3 py-1 text-xs text-fg-sub hover:text-fg"
            >
              삭제
            </button>
          </div>
        )
      ) : null}
    </li>
  );
}
