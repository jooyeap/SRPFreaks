"use client";

import { useQuery } from "@tanstack/react-query";
import type { TableEntryResponse } from "@/lib/api-types";
import { fetchMySkill, skillKeys } from "@/lib/rating";
import { ratingEntryThresholds } from "@/lib/rating-threshold";
import { useTranslations } from "next-intl";

const SINGLE_PATTERNS = new Set(["단일"]);
const OTHER_PATTERNS = new Set(["복합", "이중", "삼중"]);

/**
 * 서열표 묶음 화면 위의 한 줄: `이 구간은 단일 85% · 그 외 90% 이상이면 레이팅에 반영돼요.` (2026-10-27)
 * 홈 진행도 카드의 `N% 이상이면 레이팅에 반영돼요`를 누르고 들어왔을 때 이어서 볼 수 있게 한다. 계산은 홈과 같은 함수(lib/rating-threshold.ts)다.
 *  - 로그인한 사용자만(내 레이팅 목록이 있어야 계산된다). 목록을 못 받거나 계산되는 쪽이 없으면 아무것도 그리지 않는다.
 *  - 이 묶음에 그 속성의 채보가 없으면 그쪽은 쓰지 않는다(단일 채보가 없는데 `단일 85%`라고 하지 않게).
 */
export function FolderThresholdNote({ userId, tier, entries }: { userId: number; tier: number; entries: readonly TableEntryResponse[] }) {
  const t = useTranslations("Table");
  const skill = useQuery({
    queryKey: skillKeys.me(userId),
    queryFn: ({ signal }) => fetchMySkill(signal),
  });
  if (!skill.data) {
    return null;
  }
  const hasSingle = entries.some((e) => e.pattern !== null && SINGLE_PATTERNS.has(e.pattern));
  const hasOther = entries.some((e) => e.pattern !== null && OTHER_PATTERNS.has(e.pattern));
  const steps = ratingEntryThresholds(skill.data, Math.round(tier * 10));
  const single = hasSingle ? steps.single : null;
  const other = hasOther ? steps.other : null;
  const b = (chunks: React.ReactNode) => <b className="font-num">{chunks}</b>;

  let text: React.ReactNode;
  if (single !== null && other !== null) {
    text = t.rich("thresholdBoth", { single, other, b });
  } else if (single !== null) {
    text = t.rich("thresholdSingle", { rate: single, b });
  } else if (other !== null) {
    text = t.rich("thresholdOther", { rate: other, b });
  } else {
    return null;
  }
  return <p className="rounded-[10px] border border-line bg-table-head px-3 py-2.5 text-[13px] leading-snug text-fg break-keep">{text}</p>;
}
