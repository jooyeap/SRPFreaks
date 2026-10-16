"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SuggestionsView } from "@/components/suggestions/SuggestionsView";
import { parseCategory } from "@/lib/suggestions";

/**
 * 건의하기 화면: /suggestions. 로그인한 사용자만 쓴다.
 * 주소 쿼리 `?category=SONG_REQUEST&title=…`로 종류와 제목을 미리 채울 수 있다(곡 검색 결과가 없을 때의 "곡 추가 건의하기" 링크).
 * useSearchParams는 Suspense 안에서 써야 해서(Next.js 정적 빌드 규칙) 본문을 따로 나눴다.
 */
function SuggestionsContent() {
  const { status, user } = useAuth();
  const params = useSearchParams();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">건의하기</h1>
        <p className="text-sm text-fg-sub">건의를 보내려면 로그인해 주세요.</p>
        <Link href="/login" className="rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          로그인
        </Link>
      </section>
    );
  }
  return (
    <SuggestionsView
      viewerId={user.id}
      initialCategory={parseCategory(params.get("category"))}
      initialTitle={(params.get("title") ?? "").slice(0, 100)}
    />
  );
}

export default function SuggestionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-fg-sub">불러오는 중입니다.</p>}>
      <SuggestionsContent />
    </Suspense>
  );
}
