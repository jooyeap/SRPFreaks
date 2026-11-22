"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChartBadge } from "@/components/table/Badges";
import { StageRatePill } from "@/components/table/StageRatePill";
import { patternLabel } from "@/lib/chart-labels";
import { EMPTY_MARK, formatTier } from "@/lib/format";
import { formatBpm } from "@/lib/songs";
import { fetchChartCandidates, songListDetailHref } from "@/lib/song-list";
import { useTranslations } from "next-intl";

/**
 * 곡 목록 검색창 아래의 바로가기 후보. 검색어에 맞는 채보를 몇 개 보여 주고, 누르면 곡 상세로 바로 간다
 * (폴더를 하나씩 펼쳐서 찾지 않아도 된다). 아래 폴더 목록은 같은 검색어로 그대로 걸러지므로 이 목록은 지름길이다.
 * 검색어가 없거나 맞는 채보가 없으면 아무것도 그리지 않는다(없을 때의 안내는 폴더 목록 쪽이 한다).
 * 줄 모양(D106, 카드 B): 윗줄 곡명 + 오른쪽 `[단계 | 달성률]`, 가운데 `아티스트 · BPM`, 아랫줄 채보 칩 + 서열표 난이도·속성·레이팅상수.
 * 서열표 값이 없는 채보(서열표에 없음·미정)는 그 칸만 빠지고 줄은 그대로다. 비어 있는 값을 하드코딩하지 않고 서버 값만 쓴다.
 * userId: 결과에 내 기록이 섞여 있어서 쿼리 키에 넣는다(계정이 바뀌어도 이전 계정의 기록이 보이지 않게).
 */
export function SongJumpCandidates({ userId, query, className = "" }: { userId: number; query: string; className?: string }) {
  const t = useTranslations();
  const q = query.trim();
  const result = useQuery({
    queryKey: ["song-list", "candidates", userId, q],
    queryFn: ({ signal }) => fetchChartCandidates(q, signal),
    enabled: q !== "",
  });
  const rows = result.data?.content ?? [];
  if (q === "" || rows.length === 0) {
    return null;
  }
  return (
    <ul aria-label={t("Table.searchResults")} className={`flex flex-col gap-2 rounded-2xl border border-line bg-card p-3 ${className}`}>
      {rows.map((row) => {
        const hasBpm = row.bpmMin != null || row.bpmMax != null;
        const bpm = hasBpm ? formatBpm(row.bpmMin ?? null, row.bpmMax ?? null) : t("Table.rowBpmNone");
        return (
          <li key={row.songDifficultyId}>
            <Link
              href={songListDetailHref(row)}
              className="motion-press block rounded-xl border border-line bg-page px-3 py-2.5 hover:border-ctl"
            >
              <span className="flex items-center gap-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{row.title}</span>
                  {row.artist && <span className="mt-px block truncate text-xs text-fg-dim">{row.artist}</span>}
                </span>
                <StageRatePill stage={row.mine?.stage ?? null} rate={row.mine?.rate} />
              </span>
              <span className="mt-1.5 flex min-w-0 items-center gap-2 text-[11.5px] text-fg-sub">
                <ChartBadge part={row.part} difficulty={row.difficulty} level={row.level} />
                {row.addedVersion && (
                  <>
                    <span aria-hidden="true" className="h-2.5 w-px shrink-0 bg-line" />
                    <span className="min-w-0 truncate">{row.addedVersion}</span>
                  </>
                )}
                <span aria-hidden="true" className="h-2.5 w-px shrink-0 bg-line" />
                <span className="shrink-0 whitespace-nowrap">
                  {hasBpm ? (
                    <>
                      BPM <span className="font-num font-semibold text-fg">{bpm}</span>
                    </>
                  ) : (
                    bpm
                  )}
                </span>
              </span>
              <span className="mt-2 grid grid-cols-3 gap-1.5">
                <InfoCell label={t("Table.rowTier")} value={formatTier(row.tier, t)} text={row.tier == null} />
                <InfoCell label={t("Table.rowConstant")} value={row.ratingConstant != null ? row.ratingConstant.toFixed(2) : EMPTY_MARK} />
                <InfoCell label={t("Table.rowPattern")} value={row.patternType ? patternLabel(row.patternType, t) : EMPTY_MARK} text={!!row.patternType} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** 서열표 정보 칸(기준 난이도·레이팅상수·속성). 값이 없어도 칸은 그대로 두고 `미정`/`–`로 채워 세 칸의 폭과 줄 맞춤을 지킨다. text = 글자 값(숫자 폰트 대신 본문 글꼴) */
function InfoCell({ label, value, text = false }: { label: string; value: string; text?: boolean }) {
  return (
    <span className="min-w-0 rounded-lg border border-row-line bg-card px-2 py-1">
      <span className="block text-[10.5px] leading-3.5 text-fg-faint">{label}</span>
      <span className={`block truncate leading-5 text-fg ${text ? "text-[12.5px] font-semibold" : "font-num text-sm font-semibold tabular-nums"}`}>{value}</span>
    </span>
  );
}
