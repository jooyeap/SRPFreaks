"use client";

import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { LoginBanner } from "@/components/LoginBanner";
import { TierFolderView } from "@/components/table/TierFolderView";
import { ANONYMOUS_VIEWER_ID } from "@/lib/viewer";
import { useTranslations } from "next-intl";

/** 서열표 묶음 화면: /table/folder/{기준 난이도 | undecided}. 로그인 없이도 볼 수 있고(D43), 로그인하면 내 기록을 함께 보여 준다. */
export default function TierFolderPage() {
  const t = useTranslations();
  const params = useParams<{ tier: string }>();
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  // 주소의 값은 사용자가 바꿀 수 있으므로 그대로 비교만 한다(숫자로 해석하지 않는다). 없는 값이면 "묶음을 찾을 수 없습니다."
  return (
    <>
      {user ? null : <LoginBanner />}
      <TierFolderView userId={user?.id ?? ANONYMOUS_VIEWER_ID} param={decodeURIComponent(params.tier)} />
    </>
  );
}
