"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/components/AuthProvider";
import { LoginBanner } from "@/components/LoginBanner";
import { TierFolderView } from "@/components/table/TierFolderView";
import { parseGridPattern } from "@/lib/pattern-grid";
import { ANONYMOUS_VIEWER_ID } from "@/lib/viewer";
import { useTranslations } from "next-intl";

/** 서열표 묶음 화면: /table/folder/{기준 난이도 | undecided}. 로그인 없이도 볼 수 있고(D43), 로그인하면 내 기록을 함께 보여 준다. */
function TierFolderContent() {
  const t = useTranslations();
  const params = useParams<{ tier: string }>();
  const searchParams = useSearchParams();
  const { status, user } = useAuth();
  // 속성별 화면의 칸에서 온 속성 필터(`?pattern=복합`). 허용 값(단일·복합·이중·삼중)이 아니면 무시한다
  const initialPattern = parseGridPattern(searchParams.get("pattern"));

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  // key: 난이도를 옮기면 폴더 화면을 새로 만든다(이웃 이동 뒤 필터·정렬이 이전 난이도 것을 끌고 가지 않게. 필터는 "그 폴더에만" 적용)
  // 주소의 값은 사용자가 바꿀 수 있으므로 그대로 비교만 한다(숫자로 해석하지 않는다). 없는 값이면 "묶음을 찾을 수 없습니다."
  return (
    <>
      {user ? null : <LoginBanner />}
      <TierFolderView key={params.tier} userId={user?.id ?? ANONYMOUS_VIEWER_ID} param={decodeURIComponent(params.tier)} initialPattern={initialPattern} />
    </>
  );
}

/** useSearchParams는 Suspense 안에서 써야 한다(Next.js 정적 빌드 규칙). */
export default function TierFolderPage() {
  const t = useTranslations();
  return (
    <Suspense fallback={<p className="text-sm text-fg-sub">{t("Common.loading")}</p>}>
      <TierFolderContent />
    </Suspense>
  );
}
