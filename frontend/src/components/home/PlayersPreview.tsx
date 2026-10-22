"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PlayerRow } from "@/components/players/PlayerRow";
import { fetchPlayers, playerKeys } from "@/lib/players";
import { useTranslations } from "next-intl";

const PREVIEW_SIZE = 5;

/**
 * 홈의 유저 목록 미리보기: 상위 5명과 `전체 보기` 링크. 같은 쿼리를 쓰는 유저 목록 화면과 달리 첫 5명만 받는다.
 * 목록을 못 불러와도 홈 전체를 막지 않도록 오류일 때는 작은 안내만 둔다.
 */
export function PlayersPreview({ viewerId }: { viewerId: number }) {
  const t = useTranslations("Home");
  const tc = useTranslations("Common");
  const { data, isPending, isError } = useQuery({
    queryKey: playerKeys.list(viewerId, 0, PREVIEW_SIZE),
    queryFn: ({ signal }) => fetchPlayers(0, PREVIEW_SIZE, signal),
  });

  return (
    <section aria-label={t("playersAria")} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-num text-[17px] font-bold text-fg">{t("playersTitle")}</h2>
        <Link href="/players" className="text-xs text-fg-sub hover:text-fg">
          {tc("viewAll")}
        </Link>
      </div>
      {isPending ? (
        <p className="text-sm text-fg-sub">{tc("loading")}</p>
      ) : isError ? (
        <p className="text-sm text-fg-sub">{t("playersLoadFailed")}</p>
      ) : data.content.length === 0 ? (
        <p className="text-sm text-fg-sub">
          {t.rich("playersEmpty", {
            link: (chunks) => (
              <Link href="/settings" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-card">
          {data.content.map((player) => (
            <PlayerRow key={player.userId} player={player} viewerId={viewerId} />
          ))}
        </ul>
      )}
    </section>
  );
}
