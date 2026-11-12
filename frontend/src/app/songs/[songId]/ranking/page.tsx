"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SongRankingView } from "@/components/song/SongRankingView";
import { parseRankingPage } from "@/lib/song-ranking";
import { parseId } from "@/lib/songs";
import { useTranslations } from "next-intl";

/**
 * 곡별 전체 순위 (D74 구현 PR 3번): /songs/{곡 id}/ranking?chart={채보 id}&page={쪽, 0부터}
 * 로그인이 필요하다(서버도 401). 비로그인에게는 로그인 안내만 보이고 순위 API는 부르지 않는다.
 * 곡 id가 올바른 숫자가 아니면 곡을 찾을 수 없다고 안내하고, chart는 이 곡의 채보인지 SongRankingView가 다시 확인한다.
 * 쪽은 주소(?page=)에 남아 새로고침·뒤로 가기에서도 같은 쪽이다. 쪽을 넘길 때는 replace로 바꿔 기록이 쌓이지 않는다(비교 화면과 같다).
 * useSearchParams는 빌드 때 Suspense 경계가 필요해서 안쪽 컴포넌트로 나눴다.
 */
function RankingContent() {
  const t = useTranslations();
  const params = useParams<{ songId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex min-h-[40svh] flex-col items-start justify-center gap-3">
        <h1 className="text-xl font-semibold text-fg">{t("SongRanking.all")}</h1>
        <p className="text-sm text-fg-sub">{t("SongRanking.loginLead")}</p>
        <Link href="/login" className="min-h-11 rounded-lg border border-ctl px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          {t("Nav.login")}
        </Link>
      </section>
    );
  }
  const songId = parseId(params.songId);
  if (songId === null) {
    return <p role="alert" className="text-sm text-fg">{t("Songs.notFoundSong")}</p>;
  }

  const page = parseRankingPage(searchParams.get("page"));
  /** 주소의 쪽만 바꾼다(chart 등 다른 값은 그대로) */
  function onPageChange(next: number) {
    const query = new URLSearchParams(searchParams.toString());
    if (next > 0) query.set("page", String(next));
    else query.delete("page");
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return <SongRankingView songId={songId} chartId={parseId(searchParams.get("chart"))} userId={user.id} page={page} onPageChange={onPageChange} />;
}

export default function Page() {
  const t = useTranslations();
  return (
    <Suspense fallback={<p className="text-sm text-fg-sub">{t("Common.loading")}</p>}>
      <RankingContent />
    </Suspense>
  );
}
