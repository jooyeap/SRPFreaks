"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { NoticeForm } from "@/components/notices/NoticeForm";
import { ApiError } from "@/lib/api";
import type { NoticeResponse } from "@/lib/api-types";
import { formatPlayedDate } from "@/lib/format";
import { deleteNotice, fetchNotice, noticeKeys, updateNotice, type NoticeValues } from "@/lib/notices";

function messageOf(error: unknown): string | null {
  if (!error) {
    return null;
  }
  return error instanceof ApiError ? error.message : "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

/**
 * 공지 상세 페이지 (/notices/{id}). 제목·작성일·본문을 보여 주고, canWrite(ADMIN·ROOT)이면 고치기·삭제도 한다.
 * 본문은 글자로만 그린다(줄바꿈만 살리고 HTML은 해석하지 않는다). 없는 공지는 서버가 404를 준다.
 */
export function NoticeDetailView({ viewerId, noticeId, canWrite }: { viewerId: number; noticeId: number; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, isPending, isError, error } = useQuery({
    queryKey: noticeKeys.detail(viewerId, noticeId),
    queryFn: ({ signal }) => fetchNotice(noticeId, signal),
    retry: false,
  });

  // 고치기·삭제는 목록·상세와 감사 로그(관리 작업은 거기에 남는다)를 오래된 것으로 표시한다
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: noticeKeys.all });
    await queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
  };
  const update = useMutation({
    mutationFn: (values: NoticeValues) => updateNotice(noticeId, values),
    onSuccess: async () => {
      setEditing(false);
      toast("공지사항을 수정했습니다.");
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteNotice(noticeId),
    onSuccess: async () => {
      toast("공지사항을 삭제했습니다.");
      await refresh();
      router.push("/notices"); // 지운 공지의 상세는 더 볼 수 없으므로 목록으로 돌아간다
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <Link href="/notices" className="inline-flex min-h-11 w-fit items-center rounded-lg border border-chip-line px-3 text-sm text-fg-sub hover:text-fg">
        ← 목록으로
      </Link>
      {isPending ? (
        <p className="text-sm text-fg-sub">불러오는 중입니다.</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-fg">
          {error instanceof ApiError && error.status === 404 ? "공지사항을 찾을 수 없습니다." : "공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
        </p>
      ) : (
        <NoticeItem
          notice={data}
          canWrite={canWrite}
          editing={editing}
          deleting={deleting}
          updatePending={update.isPending}
          updateError={messageOf(update.error)}
          removePending={remove.isPending}
          removeError={messageOf(remove.error)}
          onEdit={() => {
            update.reset();
            setDeleting(false);
            setEditing(true);
          }}
          onCancelEdit={() => setEditing(false)}
          onSave={(values) => update.mutateAsync(values)}
          onAskDelete={() => {
            remove.reset();
            setEditing(false);
            setDeleting(true);
          }}
          onCancelDelete={() => setDeleting(false)}
          onConfirmDelete={() => remove.mutate()}
        />
      )}
    </div>
  );
}

export function NoticeItem({
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
      <div>
        <NoticeForm
          label="공지 고치기"
          initial={{ title: notice.title, content: notice.content }}
          submitLabel="저장"
          pending={updatePending}
          error={updateError}
          onSubmit={onSave}
          onCancel={onCancelEdit}
        />
      </div>
    );
  }
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-col gap-1 border-b border-line pb-3">
        <h1 className="text-lg font-bold text-fg">{notice.title}</h1>
        <time dateTime={notice.createdAt} className="font-num text-xs text-fg-dim">
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
                className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head disabled:opacity-60"
              >
                {removePending ? "삭제 중" : "삭제"}
              </button>
              <button
                type="button"
                disabled={removePending}
                onClick={onCancelDelete}
                className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg-sub hover:text-fg"
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
              className="rounded-lg border border-chip-line px-3 py-1 text-xs text-fg-sub hover:text-fg"
            >
              고치기
            </button>
            <button
              type="button"
              onClick={onAskDelete}
              aria-label={`${notice.title} 삭제`}
              className="rounded-lg border border-chip-line px-3 py-1 text-xs text-fg-sub hover:text-fg"
            >
              삭제
            </button>
          </div>
        )
      ) : null}
    </article>
  );
}
