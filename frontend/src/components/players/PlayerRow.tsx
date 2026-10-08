import Link from "next/link";
import { formatScore } from "@/lib/format";
import type { PlayerSummaryResponse } from "@/lib/api-types";

/**
 * 유저 목록의 한 줄: 순위 · 닉네임 · 플레이어 티어 칩 · 총점. 줄 전체가 상세로 가는 링크다.
 * 티어는 칩 안의 글자(`Gold` 등)로도 알 수 있어 색만으로 구분하지 않는다. 이메일 등은 서버가 주지 않아 화면에도 없다.
 */
export function PlayerRow({ player }: { player: PlayerSummaryResponse }) {
  return (
    <li className="border-t border-row-line first:border-t-0">
      <Link href={`/players/${player.userId}`} className="flex items-center gap-3 px-3.5 py-3 hover:bg-table-head">
        <span className="w-7 shrink-0 text-right font-num text-sm font-semibold text-fg-dim">{player.rank}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-fg">{player.nickname}</span>
          <span
            data-tier={player.tier.key}
            aria-label={`플레이어 티어 ${player.tier.displayName}`}
            className="tier-chip mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold"
          >
            {player.tier.displayName}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[11px] text-fg-dim">총점</span>
          <span className="font-num text-base font-semibold text-fg">{formatScore(player.totalScore)}</span>
        </span>
      </Link>
    </li>
  );
}
