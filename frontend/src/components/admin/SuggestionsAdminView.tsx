"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pager } from "@/components/Pager";
import { useToast } from "@/components/Toast";
import { StatusLabel } from "@/components/suggestions/StatusLabel";
import { ApiError } from "@/lib/api";
import type { AdminSuggestionResponse, SuggestionCategory, SuggestionStatus } from "@/lib/api-types";
import { formatPlayedDate } from "@/lib/format";
import {
  CATEGORY_LABELS,
  fetchAdminSuggestions,
  fetchReceivedCount,
  reviewSuggestion,
  STATUS_LABELS,
  SUGGESTION_CATEGORIES,
  SUGGESTION_NOTE_MAX,
  SUGGESTION_STATUSES,
  suggestionKeys,
  SUGGESTIONS_PAGE_SIZE,
} from "@/lib/suggestions";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-sm text-fg";

function messageOf(error: unknown): string | null {
  if (!error) {
    return null;
  }
  return error instanceof ApiError ? error.message : "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

/**
 * 건의 관리 (D35, ADMIN·ROOT). 종류·상태로 걸러 보고, 건마다 처리 상태와 답변을 남긴다.
 * 처리는 감사 로그에 기록된다(서버). 보낸 사람은 닉네임만 보인다. 권한은 서버가 다시 검사한다(403).
 */
export function SuggestionsAdminView({ viewerId }: { viewerId: number }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [category, setCategory] = useState<SuggestionCategory | "">("");
  const [status, setStatus] = useState<SuggestionStatus | "">("");
  const [page, setPage] = useState(0);
  useScrollTopOnChange(page);

  const list = useQuery({
    queryKey: suggestionKeys.admin(viewerId, category, status, page),
    queryFn: ({ signal }) => fetchAdminSuggestions({ category, status }, page, SUGGESTIONS_PAGE_SIZE, signal),
    placeholderData: keepPreviousData,
  });
  const count = useQuery({
    queryKey: suggestionKeys.receivedCount(viewerId),
    queryFn: ({ signal }) => fetchReceivedCount(signal),
  });

  const review = useMutation({
    mutationFn: ({ id, status: next, adminNote }: { id: number; status: SuggestionStatus; adminNote: string }) =>
      reviewSuggestion(id, { status: next, adminNote }),
    onSuccess: async () => {
      toast("처리 내용을 저장했습니다.");
      await queryClient.invalidateQueries({ queryKey: suggestionKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-fg">건의 관리</h1>
        {count.data ? (
          <p className="mt-1 text-sm text-fg-sub">
            접수 대기 <span className="font-num">{count.data.received}</span>건
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-2 text-sm text-fg-sub">
          종류
          <select
            className={FIELD}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as SuggestionCategory | "");
              setPage(0);
            }}
          >
            <option value="">전체</option>
            {SUGGESTION_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-fg-sub">
          상태
          <select
            className={FIELD}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as SuggestionStatus | "");
              setPage(0);
            }}
          >
            <option value="">전체</option>
            {SUGGESTION_STATUSES.map((item) => (
              <option key={item} value={item}>
                {STATUS_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {list.isPending ? (
        <p className="text-sm text-fg-sub">불러오는 중입니다.</p>
      ) : list.isError ? (
        <p role="alert" className="text-sm text-fg">
          {list.error instanceof ApiError ? list.error.message : "건의 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
        </p>
      ) : list.data.content.length === 0 ? (
        <p className="text-sm text-fg-sub">조건에 맞는 건의가 없습니다.</p>
      ) : (
        <>
          <ul aria-label="건의 목록" className="flex flex-col gap-3">
            {list.data.content.map((item) => (
              <ReviewItem
                key={`${item.id}-${item.updatedAt}`}
                item={item}
                pending={review.isPending && review.variables?.id === item.id}
                error={review.variables?.id === item.id ? messageOf(review.error) : null}
                onSave={(next, adminNote) => review.mutate({ id: item.id, status: next, adminNote })}
              />
            ))}
          </ul>
          <Pager page={list.data.page} totalPages={list.data.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

/** key에 updatedAt을 넣어, 저장이 끝나 서버 값이 바뀌면 입력 상태를 서버 값으로 다시 맞춘다. */
function ReviewItem({
  item,
  pending,
  error,
  onSave,
}: {
  item: AdminSuggestionResponse;
  pending: boolean;
  error: string | null;
  onSave: (status: SuggestionStatus, adminNote: string) => void;
}) {
  const [status, setStatus] = useState<SuggestionStatus>(item.status);
  const [note, setNote] = useState(item.adminNote ?? "");
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-bold text-fg">{item.title}</h2>
        <time dateTime={item.createdAt} className="shrink-0 font-num text-xs text-fg-dim">
          {formatPlayedDate(item.createdAt)}
        </time>
      </div>
      <div className="flex items-center gap-2 text-xs text-fg-sub">
        <span>{CATEGORY_LABELS[item.category]}</span>
        <StatusLabel status={item.status} />
        <span>보낸 사람 {item.authorNickname}</span>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm text-fg">{item.content}</p>
      <div className="flex flex-col gap-2 border-t border-line pt-2">
        <label className="flex items-center gap-2 text-sm text-fg-sub">
          상태
          <select
            aria-label={`${item.title} 상태`}
            className={FIELD}
            value={status}
            onChange={(event) => setStatus(event.target.value as SuggestionStatus)}
          >
            {SUGGESTION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-fg-sub">
          답변 (선택)
          <textarea
            aria-label={`${item.title} 답변`}
            rows={2}
            maxLength={SUGGESTION_NOTE_MAX}
            className={FIELD}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-fg">
            {error}
          </p>
        ) : null}
        <div>
          <button
            type="button"
            disabled={pending}
            onClick={() => onSave(status, note)}
            aria-label={`${item.title} 처리 저장`}
            className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head disabled:opacity-60"
          >
            {pending ? "저장 중" : "저장"}
          </button>
        </div>
      </div>
    </li>
  );
}
