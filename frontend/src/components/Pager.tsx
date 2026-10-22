"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/** 한 페이지에 보여 줄 폴더 수. 폴더가 많은 목록(통계, 곡 목록)에서 공통으로 쓴다. */
export const FOLDERS_PER_PAGE = 10;

/**
 * 목록을 클라이언트에서 잘라 보여 주기 위한 상태. 서버가 한 번에 주는 폴더 목록은 최대 수십 개라 다시 요청하지 않고 자른다.
 * 항목 수가 줄어 현재 페이지가 범위를 넘으면 마지막 페이지로 당겨 온다(필터를 바꿔 목록이 짧아진 경우).
 */
export function usePaged<T>(items: readonly T[], pageSize: number = FOLDERS_PER_PAGE) {
  const [requested, setPage] = useState(0);
  const totalPages = Math.max(Math.ceil(items.length / pageSize), 1);
  const page = Math.min(requested, totalPages - 1);
  return {
    page,
    totalPages,
    pageItems: items.slice(page * pageSize, (page + 1) * pageSize),
    setPage,
  };
}

/** `이전 · 1 / 3 · 다음`. 한 페이지뿐이면 그리지 않는다. 서열표의 페이지 이동과 같은 모양이다. */
export function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  const t = useTranslations("Common");
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={t("pageNav")} className="flex items-center justify-center gap-3 text-sm text-fg-sub">
      <button
        type="button"
        disabled={page <= 0}
        onClick={() => onChange(page - 1)}
        className="rounded-lg border border-chip-line px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
      >
        {t("prev")}
      </button>
      <span className="font-num">
        {page + 1} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page + 1 >= totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-lg border border-chip-line px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
      >
        {t("next")}
      </button>
    </nav>
  );
}
