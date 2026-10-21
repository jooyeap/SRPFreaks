"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { useTranslations } from "next-intl";

/** 로그인 화면. 이미 로그인한 상태로 들어오면 홈으로 보낸다. */
export default function LoginPage() {
  const t = useTranslations("Login");
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 py-12">
      <h1 className="text-xl font-semibold text-fg">{t("title")}</h1>
      <p className="text-center text-sm text-fg-sub">{t("lead")}</p>
      {/* 구글이 그리는 버튼은 색·모서리를 바꿀 수 없어 화면에서 떠 보이므로, 우리 카드(테두리·배경·16px 모서리) 안에 넣어 사이트 톤에 붙인다 */}
      <div
        data-testid="login-card"
        className="flex w-full flex-col items-center gap-5 rounded-2xl border border-line bg-card px-4 py-6"
      >
        <GoogleLoginButton />
        <p className="border-t border-line pt-4 text-center text-xs text-fg-dim">
          {t("consentBefore")}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-fg">
            {t("privacyLink")}
          </Link>
          {t("consentAfter")}
        </p>
      </div>
    </section>
  );
}
