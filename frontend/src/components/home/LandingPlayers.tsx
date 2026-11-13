"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PlayerRow } from "@/components/players/PlayerRow";
import { HIT_HEAD } from "@/lib/hit-area";
import { ANONYMOUS_VIEWER_ID, LANDING_PLAYERS_SIZE } from "@/lib/landing-home";
import { fetchPlayers, playerKeys } from "@/lib/players";
import { useTranslations } from "next-intl";

/**
 * 로그인 전 홈의 유저 상위 5명(E2). 로그인 홈의 PlayersPreview와 같은 목록 API(공개 읽기 GET /players)를 쓰지만,
 * 그쪽은 건드리지 않고 따로 둔다. 차이: 불러오는 중·오류·비어 있음일 때 **카드를 통째로 숨긴다**(빈 카드나 오류 문구를 첫 화면에 두지 않는다).
 * 줄은 PlayerRow 그대로다. 보는 사람이 없어 viewerId를 넘기지 않으므로 `나` 표시와 마이페이지 이동이 생기지 않는다.
 */
export function LandingPlayers() {
  const t = useTranslations("Home");
  const tc = useTranslations("Common");
  const { data } = useQuery({
    queryKey: playerKeys.list(ANONYMOUS_VIEWER_ID, 0, LANDING_PLAYERS_SIZE),
    queryFn: ({ signal }) => fetchPlayers(0, LANDING_PLAYERS_SIZE, signal),
  });

  if (!data || data.content.length === 0) return null;

  return (
    <section aria-label={t("playersAria")} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-num text-[17px] font-bold text-fg">{t("playersTitle")}</h2>
        <Link href="/players" className={`text-xs text-fg-sub hover:text-fg ${HIT_HEAD}`}>
          {tc("viewAll")}
        </Link>
      </div>
      <ul className="overflow-hidden rounded-2xl border border-line bg-card">
        {data.content.slice(0, LANDING_PLAYERS_SIZE).map((player) => (
          <PlayerRow key={player.userId} player={player} />
        ))}
      </ul>
    </section>
  );
}
