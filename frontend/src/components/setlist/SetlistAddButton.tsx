"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useOptionalUser } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { addToSetlist, fetchSetlist, removeFromSetlist, SETLIST_LIMIT, setlistKeys } from "@/lib/setlist";

/**
 * 곡 상세의 세트리스트 `담기` 버튼 (D49). 로그인하지 않았으면 아무것도 그리지 않는다(이 화면은 로그인 없이도 그려진다).
 * 자리: 곡명 오른쪽의 버튼 줄(관리 버튼 옆). 2026-10-27에 기록 등록 버튼 옆에서 옮겼다.
 *
 * 토글이다(2026-10-27): 담겨 있지 않으면 `담기`, 이미 담겨 있으면 체크 아이콘 + `담김`이고 다시 누르면 세트리스트에서 뺀다.
 * 예전(D36)에 아이콘 토글을 뺀 이유는 목록 줄의 기록 입력 `+` 버튼과 헷갈려서였는데, 지금은 목록 줄이 아니라 곡 상세에 있어 그 문제가 없다.
 * 색으로만 알리지 않는다: 글자(`담기`/`담김`)와 체크 아이콘이 있고, 화면 읽기 프로그램에는 `빼기`/`담기` 동작 이름이 따로 읽힌다.
 *
 * 담김 여부는 세트리스트 전체 응답(최대 30줄)에서 이 채보가 있는지로 정한다(빼기에는 그 줄의 id가 필요하다). 쿼리 키가 같아 요청은 하나다.
 * 30곡이 차면 담기를 막는다(서버도 409 SETLIST_FULL로 다시 검사). 이미 담긴 곡은 30곡이 차 있어도 뺄 수 있다.
 */
export function SetlistAddButton({ songDifficultyId, title }: { songDifficultyId: number; title: string }) {
  const user = useOptionalUser();
  if (!user) {
    return null;
  }
  return <AddInner userId={user.id} songDifficultyId={songDifficultyId} title={title} />;
}

function AddInner({ userId, songDifficultyId, title }: { userId: number; songDifficultyId: number; title: string }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: setlistKeys.list(userId), queryFn: ({ signal }) => fetchSetlist(signal) });
  const items = list.data?.content ?? [];
  const existing = items.find((item) => item.songDifficultyId === songDifficultyId);
  const added = existing !== undefined;
  const full = items.length >= SETLIST_LIMIT;

  const add = useMutation({
    mutationFn: () => addToSetlist(songDifficultyId),
    onSuccess: async () => {
      toast(t("Setlist.added"));
      await queryClient.invalidateQueries({ queryKey: setlistKeys.all });
    },
    // 30곡이 찼거나 이미 담긴 경우 등 서버가 거절한 문구를 그대로 보여 준다
    onError: (error) => toast(error instanceof ApiError ? error.message : t("Common.actionFailed")),
  });

  const remove = useMutation({
    mutationFn: (id: number) => removeFromSetlist(id),
    onSuccess: async () => {
      toast(t("Setlist.removed"));
      await queryClient.invalidateQueries({ queryKey: setlistKeys.all });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : t("Common.actionFailed")),
  });

  return (
    <button
      type="button"
      // 목록을 아직 못 받았을 때(list.isPending)는 담김 여부를 모르므로 누를 수 없게 한다. 30곡이 찼으면 새로 담는 것만 막는다(빼기는 된다)
      disabled={list.isPending || add.isPending || remove.isPending || (!added && full)}
      onClick={() => (existing ? remove.mutate(existing.id) : add.mutate())}
      aria-label={added ? t("Setlist.removeAria", { title }) : t("Setlist.addAria", { title })}
      title={full && !added ? t("Setlist.limitFull", { limit: SETLIST_LIMIT }) : undefined}
      // 보이는 높이는 32px 그대로, ::after로 누를 수 있는 영역만 사방 6px 넓힌다(44px). 옆의 기록 입력 버튼과 겹치지 않게 가로는 4px만 넓힌다
      className="relative flex h-9 shrink-0 items-center gap-1 rounded-lg border border-chip-line px-3 text-sm text-fg after:absolute after:-inset-x-1 after:-inset-y-1 after:content-[''] enabled:hover:bg-table-head disabled:text-disabled"
    >
      {added ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5 9-10" />
        </svg>
      ) : null}
      {added ? t("Setlist.addedMark") : t("Setlist.addBtn")}
    </button>
  );
}
