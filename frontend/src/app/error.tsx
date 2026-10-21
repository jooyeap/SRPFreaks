"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ErrorScreen, HomeLink } from "@/components/ErrorScreen";

/**
 * 화면 안에서 예상 못 한 오류가 났을 때 보이는 화면. 헤더·푸터는 그대로 두고 본문만 바꾼다.
 * 이 Next 버전은 다시 시도 함수 이름이 reset이 아니라 retry다.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("ErrorPage");
  const tc = useTranslations("Common");
  useEffect(() => {
    // 화면에는 내용을 보이지 않고, 브라우저 콘솔에만 남긴다(서버 로그는 digest로 찾는다)
    console.error(error);
  }, [error]);
  return (
    <ErrorScreen title={t("errorTitle")} body={t("errorBody")}>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-md border border-line bg-card px-4 py-2 text-sm text-fg hover:bg-table-head"
      >
        {tc("retry")}
      </button>
      <HomeLink />
    </ErrorScreen>
  );
}
