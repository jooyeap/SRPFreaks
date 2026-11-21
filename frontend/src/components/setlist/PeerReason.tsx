import type { RecommendationItem } from "@/lib/api-types";
import { useTranslations } from "next-intl";

/**
 * 추천 줄의 근거 표시(D89): 사유 칩 + (같은 티어대 근거가 있으면) `비슷한 실력대 N명이 레이팅에 반영` 한 줄.
 * 칩은 글자라서 색에 기대지 않는다(DESIGN-UI 2장). 인원 수만 보이고 누가 반영했는지는 보이지 않는다.
 * reason이 없으면(신규 STARTER, 옛 응답) 아무것도 그리지 않는다.
 */
export function PeerReason({ item }: { item: Pick<RecommendationItem, "reason" | "peerUsers"> }) {
  const t = useTranslations("Setlist");
  if (!item.reason) return null;
  const peer = item.reason === "PEER_TIER" && typeof item.peerUsers === "number";
  return (
    <span className="mt-1 flex flex-col items-start gap-0.5">
      <span
        data-reason={item.reason}
        className={`rounded border px-1.5 text-[10px] font-bold leading-[16px] ${peer ? "border-transparent bg-chip-on-bg text-chip-on-fg" : "border-line text-fg-sub"}`}
      >
        {peer ? t("reasonPeer") : t("reasonNear")}
      </span>
      {peer ? (
        <span className="break-keep text-[11px] leading-snug text-fg-sub">
          {t.rich("peerCount", { count: item.peerUsers ?? 0, n: (c) => <b className="font-num text-fg">{c}</b> })}
        </span>
      ) : null}
    </span>
  );
}
