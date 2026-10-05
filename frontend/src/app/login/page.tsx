"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";

/** 로그인 화면. 이미 로그인한 상태로 들어오면 홈으로 보낸다. */
export default function LoginPage() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 py-12">
      <h1 className="text-xl font-semibold text-fg">로그인</h1>
      <p className="text-center text-sm text-fg-sub">Google 계정으로 로그인합니다. 비밀번호는 저장하지 않습니다.</p>
      <GoogleLoginButton />
    </section>
  );
}
