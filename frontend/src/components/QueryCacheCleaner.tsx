"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { clearDetailNav } from "@/lib/detail-nav";

/**
 * 로그아웃(또는 로그인이 풀림)하면 서버 데이터 캐시를 모두 비운다.
 * 캐시에는 내 기록이 들어 있어서, 같은 브라우저에서 다음 사람이 로그인했을 때 이전 사용자의 데이터가
 * 잠깐이라도 보이면 안 된다. (쿼리 키에도 사용자 id를 넣어 두 겹으로 막는다.)
 * 곡 상세의 이전/다음 이동이 쓰는 목록 조건 기억(sessionStorage)도 같이 지운다.
 * 화면에는 아무것도 그리지 않는다.
 */
export function QueryCacheCleaner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hadUser = useRef(false);

  useEffect(() => {
    if (user) {
      hadUser.current = true;
    } else if (hadUser.current) {
      hadUser.current = false;
      queryClient.clear();
      clearDetailNav(); // 곡 상세 이전/다음이 쓰는 "들어온 목록" 기억도 함께 비운다
    }
  }, [user, queryClient]);

  return null;
}
