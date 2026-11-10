"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { addToSetlist, fetchSetlist, SETLIST_LIMIT, setlistKeys } from "@/lib/setlist";
import { useTranslations } from "next-intl";

/**
 * 라이벌 화면의 줄 오른쪽에 두는 `담기`/`담김` 버튼 한 개(D66에서 만든 방식 그대로, D67 대시보드 미리보기도 쓴다).
 * 한 곡씩 담고(한꺼번에 담기는 없다, D36) 담김 여부와 30곡 한도는 세트리스트 전체 응답(최대 30줄)에서 정한다.
 * 쿼리 키가 같아 줄이 여러 개여도 요청은 하나다. 담긴 곡의 `담김`은 눌리지 않는다(빼기는 세트리스트 탭에서).
 * 보이는 높이 26px, ::after로 눌리는 영역만 사방 6px 넓힌다. `담김`은 초록 테두리 + 초록 글자라 글자로도 구분된다.
 */
export function SetlistAddCell({ viewerId, songDifficultyId, title }: { viewerId: number; songDifficultyId: number; title: string }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: setlistKeys.list(viewerId), queryFn: ({ signal }) => fetchSetlist(signal) });
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
    onError: (error) => toast(error instanceof ApiError ? error.message : t("Common.actionFailed"), { kind: "error" }),
  });

  return (
    <button
      type="button"
      disabled={added || full || list.isPending || add.isPending}
      onClick={() => add.mutate()}
      aria-label={added ? t("Setlist.addedAria", { title }) : t("Setlist.addAria", { title })}
      title={full && !added ? t("Setlist.limitFull", { limit: SETLIST_LIMIT }) : undefined}
      className={`relative flex h-[26px] w-full items-center justify-center rounded-md border px-1 text-xs after:absolute after:-inset-1.5 after:content-[''] ${
        added ? "border-done text-done-text" : "border-ctl text-fg enabled:hover:bg-table-head disabled:text-disabled"
      }`}
    >
      {added ? t("Setlist.addedMark") : t("Setlist.addBtn")}
    </button>
  );
}
