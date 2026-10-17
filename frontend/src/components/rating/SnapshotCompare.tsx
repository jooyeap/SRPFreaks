"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { NewBadge } from "@/components/NewBadge";
import { ApiError } from "@/lib/api";
import { chartTierAttrs } from "@/lib/chart-tier";
import type { SnapshotCompareChange, SnapshotCompareResponse } from "@/lib/api-types";
import { difficultyLabel, formatRate, formatScore, partLabel } from "@/lib/format";
import { compareReasonText, fetchSnapshotCompare, snapshotKeys } from "@/lib/skill-snapshot";

/**
 * 레이팅 기록 한 줄을 바로 이전 기록과 비교한 결과 (D32 확장).
 * 펼쳤을 때만 불러온다(enabled). 새로 들어온 곡에는 NEW를 붙이고, 모든 증감은 부호 글자로 쓴다(색만으로 구분하지 않는다).
 */
export function SnapshotCompare({ userId, snapshotId }: { userId: number; snapshotId: number }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: snapshotKeys.compare(userId, snapshotId),
    queryFn: ({ signal }) => fetchSnapshotCompare(snapshotId, signal),
  });

  if (isPending) {
    return <p className="text-xs text-fg-sub">비교하는 중입니다.</p>;
  }
  if (isError) {
    return (
      <p role="alert" className="text-xs text-fg">
        {error instanceof ApiError ? error.message : "비교하지 못했습니다. 잠시 후 다시 시도해 주세요."}
      </p>
    );
  }
  return <CompareBody result={data} />;
}

/** 비교 결과 본문. 마이페이지 요약(현재와 비교)에서도 같은 화면을 쓴다. */
export function CompareBody({ result }: { result: SnapshotCompareResponse }) {
  if (!result.available) {
    return <p className="text-xs leading-relaxed text-fg-sub">{compareReasonText(result.reason)}</p>;
  }
  const nothing = !result.entered.length && !result.improved.length && !result.declined.length && !result.left.length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-fg-sub">
        {result.fromDate} → {result.toDate ?? "지금"} 레이팅 목록 비교
      </p>
      {nothing ? <p className="text-xs text-fg-sub">곡 목록에는 달라진 점이 없습니다.</p> : null}
      <Group title="새로 들어온 곡" items={result.entered} kind="entered" />
      <Group title="점수가 오른 곡" items={result.improved} kind="improved" />
      <Group title="점수가 내려간 곡" items={result.declined} kind="declined" />
      <Group title="목록에서 밀려난 곡" items={result.left} kind="left" />
    </div>
  );
}

type Kind = "entered" | "improved" | "declined" | "left";

function Group({ title, items, kind }: { title: string; items: SnapshotCompareChange[]; kind: Kind }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section aria-label={title}>
      <h4 className="mb-1 text-xs font-bold text-fg-sub">
        {title} <span className="font-num">{items.length}</span>
      </h4>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.songDifficultyId} className="flex items-center gap-2 border-t border-line py-1.5 text-sm first:border-t-0">
            {kind === "entered" ? <NewBadge /> : null}
            <Link href={`/songs/${item.songId}`} className="min-w-0 flex-1 truncate text-fg hover:underline">
              {item.title}
            </Link>
            <span className="shrink-0 text-xs text-fg-dim">
              {partLabel(item.part)} {difficultyLabel(item.difficulty)}
            </span>
            <ScoreText item={item} kind={kind} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 점수 한 개. 곡 점수가 속한 플레이어 티어 색으로 칠한다(레이팅 카드와 같은 규칙, lib/chart-tier.ts). 숫자가 그대로 보이므로 색만으로 전달하지 않는다. */
function Score({ value }: { value: number | null }) {
  if (value === null) {
    return null;
  }
  return (
    <span {...chartTierAttrs(value)} className="tier-score font-semibold">
      {formatScore(value)}
    </span>
  );
}

/**
 * `30.00 → 35.50 (+5.50) · 95.00%` / 새로 들어옴 `35.50 · 95.00%` / 밀려남 `30.00 → 목록 밖`.
 * 이전·이후 점수는 각각 자기 티어 색이라, 티어가 바뀐 곡은 색 변화로도 보인다. 증감은 부호 글자(+/-)로 쓴다.
 */
function ScoreText({ item, kind }: { item: SnapshotCompareChange; kind: Kind }) {
  const rateAfter = item.rateAfter === null ? "" : ` · ${formatRate(item.rateAfter)}`;
  let body: React.ReactNode;
  if (kind === "entered") {
    body = <Score value={item.scoreAfter} />;
  } else if (kind === "left") {
    body = (
      <>
        <Score value={item.scoreBefore} /> → 목록 밖
      </>
    );
  } else {
    const delta = (item.scoreAfter ?? 0) - (item.scoreBefore ?? 0);
    const sign = delta >= 0 ? "+" : "-";
    body = (
      <>
        <Score value={item.scoreBefore} /> → <Score value={item.scoreAfter} /> ({sign}
        {Math.abs(delta).toFixed(2)})
      </>
    );
  }
  return (
    <span className="shrink-0 text-right font-num text-xs text-fg-sub">
      {body}
      {rateAfter}
    </span>
  );
}
