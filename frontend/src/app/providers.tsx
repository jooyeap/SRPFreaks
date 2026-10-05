"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import { QueryCacheCleaner } from "@/components/QueryCacheCleaner";

/**
 * 서버 데이터(TanStack Query) 설정.
 * QueryClient를 useState의 초기값 함수로 만드는 이유: 렌더링마다 새로 만들면 캐시가 매번 사라지고,
 * 모듈 최상단에 하나만 만들면 서버에서 여러 사용자의 캐시가 섞일 수 있다. 컴포넌트마다 한 번만 만들어 둔다.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30초 안에 같은 화면을 다시 열면 다시 요청하지 않는다
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <QueryCacheCleaner />
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
