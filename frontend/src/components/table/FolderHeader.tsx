"use client";

import Link from "next/link";
import { BACK_BUTTON_CLASS, BackArrow } from "@/components/BackArrow";
import { formatTier } from "@/lib/format";
import { useTranslations } from "next-intl";

/**
 * 서열표 폴더 화면의 머리(2026-11-05, PR 2): `←`(서열표로) + 큰 난이도 숫자 + `기록 n/전체`.
 * 이 난이도가 내 평균 난이도(서열표 타일 화면의 주황 윤곽 타일과 같은 난이도)면 `내 평균 난이도` 글자를 붙인다. 글자가 있어서 색에만 기대지 않는다.
 * 다 채운 난이도(n/n)는 초록 글자 + 화면 읽기용 숨은 글자 `완료`.
 * n/전체는 호출하는 쪽이 타일과 같은 규칙(같은 필터)으로 센 값을 넘긴다.
 * `←`는 replace다: 폴더로 들어올 때 쌓인 기록 하나를 서열표로 갈아 끼워서, 돌아온 뒤 뒤로 가기가 폴더로 되돌아가지 않는다.
 */
export function FolderHeader({
  tier,
  recorded,
  total,
  isAverage,
  backHref,
}: {
  tier: number | null;
  recorded: number;
  total: number;
  isAverage: boolean;
  backHref: string;
}) {
  const t = useTranslations();
  const done = total > 0 && recorded >= total;
  return (
    <div className="flex items-center gap-3">
      <Link href={backHref} replace aria-label={t("Table.toTable")} title={t("Table.toTable")} className={`${BACK_BUTTON_CLASS} self-center`}>
        <BackArrow />
      </Link>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1" data-done={done ? "true" : undefined}>
        <span className={`font-num text-3xl font-bold leading-none ${done ? "text-done-text" : "text-fg"}`}>{formatTier(tier, t)}</span>
        <span className="font-num text-sm text-fg-sub">{t("Chart.recordedOf", { recorded, total })}</span>
        {done ? <span className="sr-only">{t("Table.tilesDone")}</span> : null}
        {isAverage ? <span className="rounded-full border border-weak px-2 py-0.5 text-xs font-semibold text-weak-text">{t("Table.tilesMyAverage")}</span> : null}
      </div>
    </div>
  );
}
