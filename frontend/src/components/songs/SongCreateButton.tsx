"use client";

import { useState } from "react";
import { SongCreateDialog } from "@/components/songs/SongCreateDialog";
import { useTranslations } from "next-intl";

/**
 * `곡 등록` 버튼과 등록 창. ROOT·ADMIN에게만 그려야 한다(부모가 role을 보고 정한다. 서버도 권한을 다시 검사한다).
 * tableId를 넘기면 서열표 화면용이라 서열표 값도 같이 받아 서열표에 추가한다.
 */
export function SongCreateButton({ tableId = null }: { tableId?: number | null }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 min-h-11 rounded-lg border border-chip-line px-3 py-1.5 text-sm text-fg-sub hover:text-fg"
      >
        {t("Songs.create")}
      </button>
      <SongCreateDialog open={open} tableId={tableId} onClose={() => setOpen(false)} />
    </>
  );
}
