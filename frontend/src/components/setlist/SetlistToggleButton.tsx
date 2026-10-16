"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptionalUser } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { addToSetlist, fetchSetlist, removeFromSetlist, setlistKeys } from "@/lib/setlist";

/**
 * 세트리스트 담기/빼기 버튼 (D36). 로그인하지 않았으면 아무것도 그리지 않는다(줄을 로그인 없이 그리는 화면이 있다).
 * 담김 여부는 세트리스트 전체 응답에서 이 채보가 있는지로 정한다. 줄마다 이 버튼이 있어도 쿼리 키가 같아 요청은 하나다.
 * 담김은 색이 아니라 아이콘 모양(체크)과 aria-pressed로 구분한다.
 * variant: icon = 줄 안의 작은 아이콘 버튼(서열표·곡 목록), full = 글자가 있는 버튼(곡 상세).
 */
export function SetlistToggleButton({
  songDifficultyId,
  title,
  variant = "icon",
}: {
  songDifficultyId: number;
  title: string;
  variant?: "icon" | "full";
}) {
  const user = useOptionalUser();
  if (!user) {
    return null;
  }
  return <ToggleInner userId={user.id} songDifficultyId={songDifficultyId} title={title} variant={variant} />;
}

function ToggleInner({
  userId,
  songDifficultyId,
  title,
  variant,
}: {
  userId: number;
  songDifficultyId: number;
  title: string;
  variant: "icon" | "full";
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: setlistKeys.list(userId), queryFn: ({ signal }) => fetchSetlist(signal) });
  const item = list.data?.content.find((i) => i.songDifficultyId === songDifficultyId) ?? null;

  const toggle = useMutation({
    mutationFn: async () => {
      if (item) {
        await removeFromSetlist(item.id);
      } else {
        await addToSetlist(songDifficultyId);
      }
    },
    onSuccess: async () => {
      toast(item ? "세트리스트에서 뺐습니다." : "세트리스트에 담았습니다.");
      await queryClient.invalidateQueries({ queryKey: setlistKeys.all });
    },
    // 30곡이 찼거나 이미 담긴 경우 등 서버가 거절한 문구를 그대로 보여 준다
    onError: (error) => toast(error instanceof ApiError ? error.message : "처리하지 못했습니다. 잠시 후 다시 시도해 주세요."),
  });

  const added = item !== null;
  const label = added ? `${title} 세트리스트에서 빼기` : `${title} 세트리스트에 담기`;
  const disabled = toggle.isPending || list.isPending;
  const icon = (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {added ? <path d="M4 6h12M4 12h8M4 18h6M15 17l2 2 4-4" /> : <path d="M4 6h12M4 12h8M4 18h8M18 15v6M15 18h6" />}
    </svg>
  );

  if (variant === "full") {
    return (
      <button
        type="button"
        aria-pressed={added}
        aria-label={label}
        disabled={disabled}
        onClick={() => toggle.mutate()}
        className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-chip-line px-4 text-sm text-fg hover:bg-table-head disabled:opacity-60"
      >
        {icon}
        {added ? "세트리스트에 담김" : "세트리스트에 담기"}
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={added}
      aria-label={label}
      title={added ? "세트리스트에서 빼기" : "세트리스트에 담기"}
      disabled={disabled}
      onClick={() => toggle.mutate()}
      // 보이는 크기는 32px 그대로, ::after로 누를 수 있는 영역만 사방 6px 넓힌다(44px)
      className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-chip-line text-fg-sub after:absolute after:-inset-1.5 after:content-[''] hover:bg-table-head hover:text-fg disabled:opacity-60"
    >
      {icon}
    </button>
  );
}
