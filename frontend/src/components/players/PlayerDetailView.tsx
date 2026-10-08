"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { RatingBody } from "@/components/rating/RatingView";
import { ApiError } from "@/lib/api";
import { fetchPlayer, playerKeys } from "@/lib/players";

/**
 * 유저 상세 (D26, 읽기 전용): 그 유저의 레이팅 카드와 단일 / 복합·이중·삼중 목록. 기록 입력·수정 버튼은 없다.
 * 비공개·차단·없는 유저는 서버가 모두 404를 주므로 "유저를 찾을 수 없습니다."로 같게 안내한다(존재 여부를 알려 주지 않는다).
 */
export function PlayerDetailView({ viewerId, playerId }: { viewerId: number; playerId: number }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: playerKeys.detail(viewerId, playerId),
    queryFn: ({ signal }) => fetchPlayer(playerId, signal),
    retry: false, // 404를 여러 번 다시 묻지 않는다
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

  return (
    <div className="flex flex-col gap-5">
      {back}
      <h1 className="text-xl font-semibold text-fg">
        <span className="font-num">{data.nickname}</span>님의 레이팅
      </h1>
      <RatingBody skill={data.skill} emptyHint="레이팅에 들어간 기록이 아직 없습니다." />
    </div>
  );
}
