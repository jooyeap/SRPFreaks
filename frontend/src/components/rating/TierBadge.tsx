import { TierChip } from "@/components/rating/TierChip";

/**
 * 마이페이지·유저 상세 레이팅 카드의 큰 티어 배지(D95). 24티어 모두 TierChip(큰 크기) 하나로 그린다.
 * 디자인 규칙은 lib/tier-chip.ts, 그리는 곳은 TierChip.tsx이고 여기에는 규칙이 없다.
 */
export function TierBadge({ tier }: { tier: { key: string; displayName: string } }) {
  return <TierChip tier={tier} size="lg" />;
}
