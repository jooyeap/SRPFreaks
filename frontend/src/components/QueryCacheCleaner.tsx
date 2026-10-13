"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";

/**
 * 로그아웃(또는 로그인이 풀림)하면 서버 데이터 캐시를 모두 비운다.
 * 캐시에는 내 기록이 들어 있어서, 같은 브라우저에서 다음 사람이 로그인했을 때 이전 사용자의 데이터가
 * 잠깐이라도 보이면 안 된다. (쿼리 키에도 사용자 id를 넣어 두 겹으로 막는다.)
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
    }
  }, [user, queryClient]);

  return null;
}
