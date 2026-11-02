import Link from "next/link";
import { formatScore } from "@/lib/format";
import type { PlayerSummaryResponse } from "@/lib/api-types";
import { useTranslations } from "next-intl";

/**
 * 유저 목록의 한 줄: 순위 · 닉네임 · 플레이어 티어 칩 · 총점. 줄 전체가 상세로 가는 링크다.
 * 보는 사람 본인의 줄(viewerId와 같은 userId)은 읽기 전용 상세가 아니라 마이페이지(`/me`)로 보낸다 — 본인은 거기서 기록을 고칠 수 있다.
 * 티어는 칩 안의 글자(`Gold` 등)로도 알 수 있어 색만으로 구분하지 않는다. 이메일 등은 서버가 주지 않아 화면에도 없다.
 * 2026-10-27: 내 줄은 옅은 배경 + 닉네임 옆 `나` 글자로 표시한다(색만으로 구분하지 않는다). 모바일은 줄 높이를 줄이려고
 * 위아래 여백을 줄이고 점수 위 `총점` 글자를 숨긴다(화면 읽기에는 남긴다).
 */
export function PlayerRow({ player, viewerId }: { player: PlayerSummaryResponse; viewerId?: number }) {
  const t = useTranslations();
  const isMe = player.userId === viewerId;
  const href = isMe ? "/me" : `/players/${player.userId}`;
  return (
    <li className={`border-t border-row-line first:border-t-0 ${isMe ? "bg-table-head" : ""}`}>
      <Link href={href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-table-head sm:gap-5 sm:py-3.5">
        <span className="w-8 shrink-0 text-center font-num text-base font-semibold text-fg-dim">{player.rank}</span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-bold text-fg">{player.nickname}</span>
            {isMe ? (
              <span className="shrink-0 rounded-full border border-ctl px-1.5 text-[11px] font-semibold text-fg-sub">{t("Players.me")}</span>
            ) : null}
          </span>
          <span
            data-tier={player.tier.key}
            aria-label={t("Rating.tierAria", { name: player.tier.displayName })}
            className="tier-chip mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold"
          >
            {player.tier.displayName}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="sr-only text-[11px] text-fg-dim sm:not-sr-only sm:block">{t("Players.totalScore")}</span>
          {/* 총점은 티어 색 글자(+ 높은 티어는 빛과 반짝임). 글자 자체가 숫자라 색만으로 전달하지 않는다 */}
          <span data-tier={player.tier.key} className="tier-score font-num text-lg font-bold">
            {formatScore(player.totalScore)}
          </span>
        </span>
      </Link>
    </li>
  );
}
