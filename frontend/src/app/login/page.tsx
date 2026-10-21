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
      <GoogleLoginButton />
      <p className="text-center text-xs text-fg-dim">
        {t("consentBefore")}
        <Link href="/terms" className="underline underline-offset-2 hover:text-fg">
          {t("termsLink")}
        </Link>
        {t("consentAnd")}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-fg">
          {t("privacyLink")}
        </Link>
        {t("consentAfter")}
      </p>
    </section>
  );
}
