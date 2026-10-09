"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { RatingBody } from "@/components/rating/RatingView";
import { ApiError } from "@/lib/api";
import type { SkillEntryResponse } from "@/lib/api-types";
import { AFFECTED_QUERY_KEYS } from "@/lib/records";
import { deletePlayerChartRecords, fetchPlayer, playerKeys } from "@/lib/players";

/**
 * 유저 상세 (D26): 그 유저의 레이팅 카드와 단일 / 복합·이중·삼중 목록. 기록 입력·수정 버튼은 없다.
 * 비공개·차단·없는 유저는 서버가 모두 404를 주므로 "유저를 찾을 수 없습니다."로 같게 안내한다(존재 여부를 알려 주지 않는다).
 *
 * canDeleteRecords (D29): ADMIN·ROOT에게만 true를 넘긴다. 카드마다 `삭제` 버튼이 생기고, 누르면 확인 상자를 거쳐
 * 그 유저의 그 채보 기록을 모두 지운다. 버튼을 보일지는 화면이 정하지만 실제 권한은 서버(403)가 검사한다.
 */
export function PlayerDetailView({
  viewerId,
  playerId,
  canDeleteRecords = false,
}: {
  viewerId: number;
  playerId: number;
  canDeleteRecords?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error } = useQuery({
    queryKey: playerKeys.detail(viewerId, playerId),
    queryFn: ({ signal }) => fetchPlayer(playerId, signal),
    retry: false, // 404를 여러 번 다시 묻지 않는다
  });
  // 확인 상자에 올려 둔(삭제하려는) 카드. null이면 상자를 닫는다.
  const [target, setTarget] = useState<SkillEntryResponse | null>(null);

  const deletion = useMutation({
    mutationFn: (entry: SkillEntryResponse) => deletePlayerChartRecords(playerId, entry.songDifficultyId),
    onSuccess: async () => {
      setTarget(null);
      // 유저 상세·유저 목록(총점 순위)이 모두 달라지므로 "players" 전체를 새로 받는다
      await queryClient.invalidateQueries({ queryKey: playerKeys.all });
      // 지운 유저가 나 자신일 수도 있어 내 기록과 관련된 화면(레이팅·서열표·곡 목록)도 오래된 것으로 표시한다
      for (const queryKey of AFFECTED_QUERY_KEYS) {
        await queryClient.invalidateQueries({ queryKey });
      }
      // 관리 작업은 감사 로그에 남으므로 그 목록도 오래된 것으로 표시한다
      await queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });

  const back = (
    <Link
      href="/players"
      aria-label="유저 목록으로"
      title="유저 목록으로"
      className="self-start rounded-full border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg"
    >
      <span aria-hidden="true">←</span>
    </Link>
  );

  if (isPending) {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p role="alert" className="text-sm text-fg">
          {notFound
            ? "유저를 찾을 수 없습니다."
            : error instanceof ApiError
              ? error.message
              : "유저 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
        </p>
      </div>
    );
  }

  const deleteError =
    deletion.error instanceof ApiError
      ? deletion.error.message
      : deletion.error
        ? "삭제하지 못했습니다. 잠시 후 다시 시도해 주세요."
        : null;

  return (
    <div className="flex flex-col gap-5">
      {back}
      <h1 className="text-xl font-semibold text-fg">
        <span className="font-num">{data.nickname}</span>님의 레이팅
      </h1>
      {target ? (
        <div role="alertdialog" aria-label="기록 삭제 확인" className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
          <p className="text-sm text-fg">
            <span className="font-num">{data.nickname}</span>님의 &lsquo;{target.title}&rsquo; 기록을 모두 삭제할까요? 삭제한 기록은 되돌릴 수 없고, 관리
            기록에 남습니다.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={deletion.isPending}
              onClick={() => deletion.mutate(target)}
              className="rounded-full border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head disabled:opacity-60"
            >
              {deletion.isPending ? "삭제 중" : "삭제"}
            </button>
            <button
              type="button"
              disabled={deletion.isPending}
              onClick={() => {
                deletion.reset();
                setTarget(null);
              }}
              className="rounded-full border border-chip-line px-4 py-1.5 text-sm text-fg-sub hover:text-fg"
            >
              취소
            </button>
          </div>
          {deleteError ? (
            <p role="alert" className="text-sm text-fg">
              {deleteError}
            </p>
          ) : null}
        </div>
      ) : null}
      <RatingBody
        skill={data.skill}
        emptyHint="레이팅에 들어간 기록이 아직 없습니다."
        onDeleteEntry={canDeleteRecords ? (entry) => { deletion.reset(); setTarget(entry); } : undefined}
      />
    </div>
  );
}
