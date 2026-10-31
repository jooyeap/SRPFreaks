"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ApiError } from "@/lib/api";
import type { RivalResponse } from "@/lib/api-types";
import { formatScore } from "@/lib/format";
import { fetchRivals, rivalKeys, signed, unregisterRival } from "@/lib/rivals";
import { useTranslations } from "next-intl";

/**
 * 마이페이지 `라이벌` 탭(D56): 내 라이벌 카드(최대 5). 카드를 누르면 비교 화면.
 * 비공개가 된 상대는 흐린 카드에 안내 + `라이벌 해제`만 둔다. `서로 라이벌`은 칩 글자로 보인다.
 */
export function RivalTab({ userId }: { userId: number }) {
  const t = useTranslations("Rival");
  const tc = useTranslations();
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<RivalResponse | null>(null);
  const { data, isPending, isError, error } = useQuery({
    queryKey: rivalKeys.list(userId),
    queryFn: ({ signal }) => fetchRivals(signal),
  });
  const unregister = useMutation({
    mutationFn: (target: RivalResponse) => unregisterRival(target.userId),
    onSuccess: async () => {
      setRemoving(null);
      await queryClient.invalidateQueries({ queryKey: rivalKeys.all });
    },
  });

  if (isPending) {
    return <p className="text-sm text-fg-sub">{tc("Common.loading")}</p>;
  }
  if (isError) {
    return <p role="alert" className="text-sm text-fg">{error instanceof ApiError ? error.message : t("loadFailed")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-bold text-fg">{t("myRivals")}</h2>
        <span className="font-num text-xs text-fg-dim">{data.length}/5</span>
      </div>
      {data.length === 0 ? <p className="text-sm text-fg-sub">{t("emptyList")}</p> : null}
      {data.map((rival) =>
        rival.available && rival.counts && rival.tier ? (
          <Link
            key={rival.userId}
            href={`/players/${rival.userId}/compare`}
            className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4 hover:bg-table-head"
          >
            <span className="flex items-center gap-1.5">
              <b className="min-w-0 flex-1 truncate text-[15px] text-fg">{rival.nickname}</b>
              {rival.mutual ? (
                <span className="shrink-0 rounded-md border border-check-line bg-check-bg px-1.5 text-[11px] text-check-fg">{t("mutualChip")}</span>
              ) : null}
              <span data-tier={rival.tier.key} className="tier-chip shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold">
                {rival.tier.displayName}
              </span>
            </span>
            <span className="text-xs text-fg-dim">
              {t.rich("scoreLine", {
                n: (c) => <span className="font-num text-fg">{c}</span>,
                total: formatScore(rival.totalScore),
                diff: signed(rival.scoreDiff ?? 0),
              })}
            </span>
            <span className="grid grid-cols-4 gap-1.5 text-center">
              {(
                [
                  ["win", rival.counts.win],
                  ["lose", rival.counts.lose],
                  ["tie", rival.counts.tie],
                  ["theirsOnly", rival.counts.theirsOnly],
                ] as const
              ).map(([key, n]) => (
                <span key={key} className="rounded-lg bg-table-head py-1.5 text-[11px] text-fg-sub">
                  <b className="block font-num text-base text-fg">{n}</b>
                  {t(key)}
                </span>
              ))}
            </span>
          </Link>
        ) : (
          <div key={rival.userId} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4 opacity-80">
            <span className="flex items-center gap-1.5">
              <b className="min-w-0 flex-1 truncate text-[15px] text-fg-sub">{rival.nickname ?? t("unknown")}</b>
              <span className="text-xs text-fg-dim">{t("private")}</span>
            </span>
            <p className="text-xs text-fg-dim">{t("privateLine")}</p>
            <button
              type="button"
              onClick={() => setRemoving(rival)}
              className="min-h-10 rounded-xl border border-chip-line text-sm text-fg hover:bg-table-head"
            >
              {t("unregister")}
            </button>
          </div>
        ),
      )}
      {unregister.error ? (
        <p role="alert" className="text-xs text-danger">
          {unregister.error instanceof ApiError ? unregister.error.message : t("failed")}
        </p>
      ) : null}
      <p className="text-xs text-fg-dim">
        {t.rich("listHint", { a: (c) => <Link href="/players" className="underline">{c}</Link> })}
      </p>
      <ConfirmDialog
        open={removing !== null}
        title={t("unregisterTitle")}
        message={t("unregisterMessage", { nickname: removing?.nickname ?? "" })}
        confirmLabel={t("unregister")}
        pending={unregister.isPending}
        onConfirm={() => removing && unregister.mutate(removing)}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
