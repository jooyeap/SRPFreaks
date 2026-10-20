"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SuggestionsView } from "@/components/suggestions/SuggestionsView";
import { parseCategory, parseChartRequest } from "@/lib/suggestions";
import { useTranslations } from "next-intl";

/**
 * 건의하기 화면: /suggestions. 로그인한 사용자만 쓴다.
 * 주소 쿼리 `?category=SONG_REQUEST&title=…`로 종류와 제목을 미리 채울 수 있다(곡 검색 결과가 없을 때의 "곡 추가 건의하기" 링크).
 * useSearchParams는 Suspense 안에서 써야 해서(Next.js 정적 빌드 규칙) 본문을 따로 나눴다.
 */
function SuggestionsContent() {
  const t = useTranslations();
  const { status, user } = useAuth();
  const params = useSearchParams();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">{t("Suggestions.heading")}</h1>
        <p className="text-sm text-fg-sub">{t("Pages.suggestionsLead")}</p>
        <Link href="/login" className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          {t("Nav.login")}
        </Link>
      </section>
    );
  }
  const chart = parseChartRequest(params.get("part"), params.get("difficulty"));
  return (
    <SuggestionsView
      viewerId={user.id}
      initialChart={chart}
      initialCategory={parseCategory(params.get("category"))}
      initialTitle={(params.get("title") ?? "").slice(0, 100)}
    />
  );
}

export default function SuggestionsPage() {
  const t = useTranslations();
  return (
    <Suspense fallback={<p className="text-sm text-fg-sub">{t("Common.loading")}</p>}>
      <SuggestionsContent />
    </Suspense>
  );
}
