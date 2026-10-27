"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { createSnapshot, fetchSnapshotStatus, snapshotButtonText, snapshotKeys } from "@/lib/skill-snapshot";
import { useTranslations } from "next-intl";

/**
 * 가져오기 저장이 끝난 화면의 `지금 레이팅 기록하기` (D32). 마이페이지 "지금 상황" 카드의 기록 제안과 같은 규칙이다.
 *  - 기록할 수 있을 때(마지막 기록과 점수가 다를 때)만 보인다. 막히는 이유는 이 화면에서 설명하지 않는다 — 안 보이면 그만이다.
 *  - 오늘 이미 기록했으면 버튼이 `오늘 기록 갱신`이고 누르면 오늘 기록을 덮어쓴다(D32 변경). 가져오기를 하루에 여러 번 해도 마지막 상태로 남길 수 있다.
 *  - 자동으로 저장하지 않는다. 누를 때만 남는다. 변경 없음 검사는 서버가 한다.
 * 가져오기가 레이팅을 한꺼번에 바꾸는 순간이라 스냅샷을 남기기 좋아서 여기에 둔다. 새로 저장하는 값은 기존 스냅샷뿐이다.
 */
export function ImportSnapshotPrompt({ userId }: { userId: number }) {
  const t = useTranslations("Rating");
  const tRoot = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();

  // 저장 직전에 캐시된 값이 아니라 저장 후의 상태를 봐야 하므로 화면이 뜰 때 항상 다시 읽는다
  const status = useQuery({
    queryKey: snapshotKeys.status(userId),
    queryFn: ({ signal }) => fetchSnapshotStatus(signal),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const buttonText = snapshotButtonText(status.data?.replacesToday, tRoot);
  const record = useMutation({
    mutationFn: createSnapshot,
    onSuccess: async () => {
      toast(buttonText.saved);
      await queryClient.invalidateQueries({ queryKey: snapshotKeys.all(userId) });
      await queryClient.invalidateQueries({ queryKey: snapshotKeys.status(userId) });
    },
  });

  if (status.data?.available !== true) {
    return null;
  }
  return (
    <section aria-label={t("snapshotSuggestAria")} className="flex flex-col gap-2 rounded-xl border border-chip-on-bg p-3">
      <p className="text-xs text-fg-sub">{t("snapshotHint")}</p>
      <button
        type="button"
        disabled={record.isPending}
        onClick={() => record.mutate()}
        className="min-h-11 rounded-full bg-chip-on-bg px-5 text-sm font-semibold text-chip-on-fg enabled:hover:opacity-90 disabled:bg-table-head disabled:text-disabled"
      >
        {record.isPending ? t("snapshotSaving") : buttonText.label}
      </button>
      {record.isError ? (
        <p role="alert" className="text-xs text-fg">
          {record.error instanceof ApiError ? record.error.message : t("snapshotFailed")}
        </p>
      ) : null}
    </section>
  );
}
