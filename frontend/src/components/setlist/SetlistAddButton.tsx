"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useOptionalUser } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { addToSetlist, fetchSetlist, SETLIST_LIMIT, setlistKeys } from "@/lib/setlist";

/**
 * 서열표·곡 목록 줄의 `담기` 버튼 (D49). 로그인하지 않았으면 아무것도 그리지 않는다(이 줄들은 로그인 없이도 그려진다).
 * 담기만 한다: 빼기와 완료한 곡 비우기는 마이페이지 세트리스트 탭에서 한다(한꺼번에 담는 버튼은 계속 없다).
 *
 * 왜 글자 버튼인가: 예전에 아이콘 토글을 줄에 넣었더니 같은 줄의 기록 입력 `+` 버튼과 헷갈려서 뺐다(D36).
 * 그래서 `담기` 글자와 담긴 뒤의 체크 아이콘 + `담김` 글자로 구분하고, 색으로만 알리지 않는다.
 *
 * 담김 여부는 세트리스트 전체 응답(최대 30줄)에서 이 채보가 있는지로 정한다. 줄마다 이 버튼이 있어도 쿼리 키가 같아 요청은 하나다.
 * 30곡이 차면 담기를 모두 막는다(서버도 409 SETLIST_FULL로 다시 검사한다).
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
  const added = items.some((item) => item.songDifficultyId === songDifficultyId);
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

  return (
    <button
      type="button"
      // 목록을 아직 못 받았을 때(list.isPending)는 담김 여부를 모르므로 누를 수 없게 한다
      disabled={added || full || list.isPending || add.isPending}
      onClick={() => add.mutate()}
      aria-label={added ? t("Setlist.addedAria", { title }) : t("Setlist.addAria", { title })}
      title={full && !added ? t("Setlist.limitFull", { limit: SETLIST_LIMIT }) : undefined}
      // 보이는 높이는 32px 그대로, ::after로 누를 수 있는 영역만 사방 6px 넓힌다(44px). 옆의 기록 입력 버튼과 겹치지 않게 가로는 4px만 넓힌다
      className="relative flex h-8 shrink-0 items-center gap-1 rounded-lg border border-chip-line px-2.5 text-xs text-fg after:absolute after:-inset-x-1 after:-inset-y-1.5 after:content-[''] enabled:hover:bg-table-head disabled:text-disabled"
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
