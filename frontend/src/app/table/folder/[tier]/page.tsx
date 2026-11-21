"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/components/AuthProvider";
import { LoginBanner } from "@/components/LoginBanner";
import { TierFolderView } from "@/components/table/TierFolderView";
import { folderCarryFromParams } from "@/lib/folder-filter-carry";
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

  // 옆 폴더에서 필터를 싣고 넘어왔으면(rec·pat·sort·zero) 그 보기 상태를 이어받는다(D99). 허용 값만 읽는다
  const carry = folderCarryFromParams(new URLSearchParams(searchParams.toString()));

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  // key: 난이도를 옮기면 폴더 화면을 새로 만든다(화면 안의 state는 새로 시작한다. 옆 폴더로 가져가야 하는 필터·정렬은 주소 쿼리로 실려 와서 carry로 넘긴다, D99)
  // 주소의 값은 사용자가 바꿀 수 있으므로 그대로 비교만 한다(숫자로 해석하지 않는다). 없는 값이면 "묶음을 찾을 수 없습니다."
  return (
    <>
      {user ? null : <LoginBanner />}
      <TierFolderView key={params.tier} userId={user?.id ?? ANONYMOUS_VIEWER_ID} param={decodeURIComponent(params.tier)} initialPattern={initialPattern} carry={carry} />
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
