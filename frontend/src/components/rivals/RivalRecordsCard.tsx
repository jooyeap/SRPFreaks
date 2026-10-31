"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatRate } from "@/lib/format";
import { fetchRivalRecords, rivalKeys, signed } from "@/lib/rivals";
import { useTranslations } from "next-intl";

/**
 * 곡 상세의 `라이벌 기록` (D56): 이 채보의 내 라이벌 기록과 내 기록과의 차이. 로그인했을 때만 부모가 그리고,
 * 라이벌이 없으면(빈 목록) 아무것도 그리지 않는다. `이김/짐/같음`은 글자로도 보인다(색만 쓰지 않는다).
 */
export function RivalRecordsCard({ viewerId, songDifficultyId }: { viewerId: number; songDifficultyId: number }) {
  const t = useTranslations("Rival");
  const { data } = useQuery({
    queryKey: rivalKeys.records(viewerId, songDifficultyId),
    queryFn: ({ signal }) => fetchRivalRecords(songDifficultyId, signal),
    retry: false,
  });
  // 응답 모양이 예상과 다르면(다른 화면 테스트의 가짜 응답 등) 조용히 그리지 않는다
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }
  return (
    <section aria-label={t("recordsTitle")} className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-4">
      <h2 className="text-sm font-bold text-fg">{t("recordsTitle")}</h2>
      <ul>
        {data.map((r) => {
          const state = r.diff === null ? null : r.diff > 0 ? "win" : r.diff < 0 ? "lose" : "tie";
          const tone = state === "win" ? "text-done-text" : state === "lose" ? "text-danger" : "text-fg-dim";
          return (
            <li key={r.userId} className="flex items-center gap-2 border-t border-row-line py-2 text-[13px] first:border-t-0">
              <Link href={`/players/${r.userId}/compare`} className="min-w-0 flex-1 truncate text-fg hover:underline">
                {r.nickname}
              </Link>
              {r.rate === null ? (
                <span className="text-xs text-fg-dim">{t("noRecord")}</span>
              ) : (
                <>
                  <span className="font-num text-fg-sub">{formatRate(r.rate)}</span>
                  <span className={`w-14 text-right font-num ${tone}`}>{r.diff === null ? "" : signed(r.diff)}</span>
                  <span className={`w-8 text-[11px] ${tone}`}>{state ? t(state) : ""}</span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
