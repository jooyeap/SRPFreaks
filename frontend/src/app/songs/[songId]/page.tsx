"use client";

import { parseTierArrival } from "@/lib/tier-arrival";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SongDetailView } from "@/components/song/SongDetailView";
import { parseId, parseOrigin } from "@/lib/songs";
import { ANONYMOUS_VIEWER_ID } from "@/lib/viewer";
import { useTranslations } from "next-intl";

/**
 * 곡 상세 화면: /songs/{곡 id}?from=table|songs&chart={채보 id}
 * 주소의 값은 사용자가 바꿀 수 있으므로 검사해서 쓴다: 곡 id가 올바른 숫자가 아니면 안내만 보여 주고,
 * from은 table만 인정하며(나머지는 곡 목록), chart는 이 곡의 채보인지 SongDetailView가 다시 확인한다.
 * useSearchParams는 빌드 때 Suspense 경계가 필요해서 안쪽 컴포넌트로 나눴다.
 */
function SongDetailPage() {
  const t = useTranslations();
  const params = useParams<{ songId: string }>();
  const search = useSearchParams();
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  const songId = parseId(params.songId);
  const tierArrival = parseTierArrival(search);
  if (songId === null) {
    return <p role="alert" className="text-sm text-fg">{t("Songs.notFoundSong")}</p>;
  }
  return (
    <SongDetailView
      songId={songId}
      chartId={parseId(search.get("chart"))}
      // 서열표 변경 알림(D61)에서 왔으면 서열표 정보가 보이는 구성(table)으로 연다
      origin={tierArrival ? "table" : parseOrigin(search.get("from"))}
      tierArrival={tierArrival}
      userId={user?.id ?? ANONYMOUS_VIEWER_ID}
      canEditTable={user !== null && user.role !== "USER"}
      canEditJacket={user !== null && user.role === "ROOT"}
    />
  );
}

export default function Page() {
  const t = useTranslations();
  return (
    <Suspense fallback={<p className="text-sm text-fg-sub">{t("Common.loading")}</p>}>
      <SongDetailPage />
    </Suspense>
  );
}
