"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { setClientTranslator } from "@/i18n/client-messages";
import { queryRetryDelay, shouldRetryQuery } from "@/lib/query-retry";
import { AuthProvider } from "@/components/AuthProvider";
import { QueryCacheCleaner } from "@/components/QueryCacheCleaner";
import { ToastProvider } from "@/components/Toast";
import { useJacketsLoader } from "@/lib/jackets";

/** 재킷 목록(D54)을 앱 전체에서 한 번 받는다. 그리는 것은 없다. */
function JacketsLoader() {
  useJacketsLoader();
  return null;
}

/**
 * 서버 데이터(TanStack Query) 설정.
 * QueryClient를 useState의 초기값 함수로 만드는 이유: 렌더링마다 새로 만들면 캐시가 매번 사라지고,
 * 모듈 최상단에 하나만 만들면 서버에서 여러 사용자의 캐시가 섞일 수 있다. 컴포넌트마다 한 번만 만들어 둔다.
 */
export function Providers({ children }: { children: ReactNode }) {
  // 컴포넌트 밖(api.ts, google.ts)에서 만드는 오류 문구도 현재 언어로 나오게 번역기를 등록한다
  const t = useTranslations();
  useEffect(() => {
    setClientTranslator(t);
    return () => setClientTranslator(null);
  }, [t]);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30초 안에 같은 화면을 다시 열면 다시 요청하지 않는다
            refetchOnWindowFocus: false,
            // 4xx는 바로 실패, 배포 중 끊김(502·503·504)은 약 30초 동안 다시 시도, 그 밖은 두 번 더(lib/query-retry.ts).
            // 쓰기(mutation)는 다시 보내지 않는다(두 번 저장될 수 있다).
            retry: shouldRetryQuery,
            retryDelay: queryRetryDelay,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <QueryCacheCleaner />
        <JacketsLoader />
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
