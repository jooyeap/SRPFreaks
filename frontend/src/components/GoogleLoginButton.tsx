"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
import { loadGoogleIdentity } from "@/lib/google";

/**
 * 구글 로그인 버튼. 클라이언트 ID는 공개돼도 되는 값이지만 코드에 넣지 않고 환경변수로 받는다.
 * 구글이 버튼 모양을 직접 그리고, 로그인에 성공하면 callback으로 ID 토큰을 준다.
 */
export function GoogleLoginButton({ onSuccess }: { onSuccess?: () => void }) {
  const { loginWithGoogle } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // 콜백은 구글이 오래 들고 있으므로 최신 값을 ref로 가리킨다 (initialize를 다시 부르지 않기 위해)
  const handlersRef = useRef({ loginWithGoogle, onSuccess });
  useEffect(() => {
    handlersRef.current = { loginWithGoogle, onSuccess };
  });

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) {
      return;
    }
    let cancelled = false;
    loadGoogleIdentity()
      .then((id) => {
        const container = containerRef.current;
        if (cancelled || !container) {
          return;
        }
        id.initialize({
          client_id: clientId,
          callback: (response) => {
            setError(null);
            handlersRef.current
              .loginWithGoogle(response.credential)
              .then(() => handlersRef.current.onSuccess?.())
              .catch((e: unknown) => {
                // 서버는 검증 실패 사유를 통일해서 준다. 그대로 보여 주고, 아닌 경우엔 일반 문구를 쓴다.
                setError(e instanceof ApiError ? e.message : "로그인에 실패했습니다. 다시 시도해 주세요.");
              });
          },
        });
        id.renderButton(container, { type: "standard", theme: "outline", size: "large", text: "signin_with", locale: "ko" });
      })
      .catch(() => {
        if (!cancelled) {
          setError("구글 로그인을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) {
    return <p role="alert" className="text-sm text-fg-sub">로그인 설정이 되어 있지 않습니다. (NEXT_PUBLIC_GOOGLE_CLIENT_ID)</p>;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={containerRef} />
      {error ? (
        <p role="alert" className="text-sm text-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
