"use client";

import { useState } from "react";
import { markTipSeen, wasTipSeen } from "@/lib/table-tiles";
import { useTranslations } from "next-intl";

/**
 * 서열표 첫 화면의 첫 방문 안내 말풍선. ×로 닫으면 이 기기에서 다시 뜨지 않는다(localStorage는 per-viewer 편의로만 쓰고,
 * 읽기·쓰기가 실패해도 화면은 정상이다: 못 읽으면 안내가 보이고, 못 쓰면 이번 화면에서만 닫힌다).
 * 색은 카드/윤곽/글자 토큰만 쓰고, 나타날 때는 토스트와 같은 motion-reveal(움직임 줄이기에서는 멈춤)이다.
 */
export function TableTip() {
  const t = useTranslations();
  const [open, setOpen] = useState(() => !wasTipSeen());
  if (!open) return null;
  return (
    <div role="note" className="motion-reveal flex items-start gap-2 rounded-xl border border-check-line bg-check-bg py-1 pl-3 pr-1 text-sm text-fg">
      <p className="flex-1 py-1.5">{t("Table.tilesTip")}</p>
      <button
        type="button"
        aria-label={t("Common.close")}
        onClick={() => {
          markTipSeen();
          setOpen(false);
        }}
        className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg text-lg text-fg-sub hover:text-fg"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
