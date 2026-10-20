"use client";

import Link from "next/link";
import { useEffect } from "react";
import { rememberSongTab } from "@/lib/song-tab";
import { useTranslations } from "next-intl";

/**
 * 곡 화면 맨 위의 `서열표 | 곡 목록` 전환 탭. 두 화면을 한 메뉴(곡)로 합쳤지만 주소와 필터 상태(쿼리)는 각자 그대로 두려고,
 * 탭은 상태가 아니라 두 주소 사이의 링크로 만들었다(뒤로 가기·새로고침·링크 공유가 그대로 동작한다).
 * 현재 탭은 aria-current + 굵은 글자 + 밑줄로 알린다(색만으로 구분하지 않는다).
 */
const TABS = [
  { key: "table", href: "/table", label: "Songs.tabTable" },
  { key: "songs", href: "/songs", label: "Songs.tabSongs" },
] as const;

export function SongTabs({ current }: { current: (typeof TABS)[number]["key"] }) {
  const t = useTranslations();
  // 이 화면을 본 것을 기억해서 다음에 `곡` 메뉴가 같은 탭으로 들어가게 한다
  useEffect(() => {
    rememberSongTab(current);
  }, [current]);
  return (
    <nav aria-label={t("Songs.tabsAria")} className="mb-4 flex gap-1 border-b border-line">
      {TABS.map((tab) => {
        const active = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex min-h-11 items-center border-b-2 px-4 text-sm ${
              active ? "border-fg font-bold text-fg" : "border-transparent text-fg-dim hover:text-fg"
            }`}
          >
            {t(tab.label)}
          </Link>
        );
      })}
    </nav>
  );
}
