"use client";

import type { ReactNode } from "react";

/**
 * 조회가 실패했을 때 안내 문구와 "다시 시도" 버튼을 함께 보여 준다.
 * 오락실 같은 불안정한 망에서는 한 번 실패한 요청을 사용자가 새로고침 없이 바로 다시 보낼 수 있어야 해서 만들었다.
 * 문구는 role="alert"로 읽어 주고, 다시 시도 중(retrying)에는 버튼을 잠가 같은 요청이 겹쳐 나가지 않게 한다.
 * 문구는 서버가 준 것(ApiError.message)이나 화면별 기본 문구를 호출하는 쪽에서 정해 넘긴다.
 */
export function ErrorRetry({
  children,
  onRetry,
  retrying = false,
  className = "",
}: {
  children: ReactNode;
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div role="alert" className={`flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-fg ${className}`}>
      <span>{children}</span>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="min-h-10 rounded-lg border border-line px-3 text-sm font-medium text-fg hover:bg-table-head disabled:opacity-60"
      >
        {retrying ? "불러오는 중…" : "다시 시도"}
      </button>
    </div>
  );
}
