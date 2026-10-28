"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { fetchRecognizeStatus, recognizeKeys, showsPhotoEntry } from "@/lib/recognize";
import { useTranslations } from "next-intl";

/**
 * `가져오기로 못 넣은 곡은 사진으로 입력` 링크(D55). 서버 상태가 쓸 수 있음(또는 한도만 다 씀)일 때만 보인다.
 * 꺼져 있거나 권한이 없으면 아무것도 그리지 않는다 — 시험 기간에는 ROOT·ADMIN에게만 보이고, 공개 전환(설정)하면 모두에게 보인다.
 */
export function PhotoEntryLink({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations();
  const { user } = useAuth();
  const status = useQuery({
    queryKey: recognizeKeys.status(user?.id ?? 0),
    queryFn: ({ signal }) => fetchRecognizeStatus(signal),
    enabled: Boolean(user),
    retry: false,
  });
  if (!showsPhotoEntry(status.data)) {
    return null;
  }
  return (
    <Link href="/records/photo" onClick={onNavigate} className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 text-sm font-semibold text-fg hover:bg-table-head">
      <span>{t("Photo.entryLink")}</span>
      <span aria-hidden="true">›</span>
    </Link>
  );
}
