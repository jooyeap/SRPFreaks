"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useHistoryClose } from "@/lib/use-history-close";

const PANEL_MAX = 320; // 설명 상자 최대 폭(px)
const GUTTER = 16; // 화면 좌우 여백(px)

/**
 * 라벨 옆의 작은 `?` 설명 버튼(2026-11-09). 누르면 라벨 바로 아래에 제목 + 본문 + `닫기`가 든 설명 상자가 열린다.
 * 호버로는 열지 않는다(모바일에는 호버가 없다). 버튼을 다시 누르거나 상자 바깥을 누르거나 Esc를 누르거나 `닫기`를 누르면 닫히고,
 * Esc·`닫기`는 포커스를 버튼으로 돌려 준다.
 *
 * 크기: 눈에 보이는 원은 지름 20px, 누르는 영역은 44px다. 44px 영역은 음수 마진(-m-3 = 12px)으로 늘려서
 * 줄 높이를 키우지 않는다(레이아웃에서는 20px만 차지한다).
 * 접근성: 눈에 보이는 `?`는 장식(aria-hidden)이라 버튼 이름은 `… 설명 보기`다. aria-expanded로 열림을 알리고
 * aria-controls로 상자와 잇는다. 색은 토큰만 쓴다(TermHelp와 같은 토큰: 윤곽 `ctl`, 상자 `table-head`/`chip-on-bg`).
 *
 * 위치: 상자는 화면 안에 들어오게 좌우로 밀어서 놓고(폭은 최대 320px, 좁은 화면에서는 화면 폭 − 32px),
 * 위쪽 화살표는 항상 `?` 가운데를 가리킨다. 위치는 열릴 때만 잰다(서버 렌더에는 영향이 없다).
 *
 * 문구는 `title`, `body`, `ariaLabel`로 받는다. 같은 문구를 쓰는 곳은 `AverageLevelHelp`처럼 한 번 감싸서 쓰고,
 * 곳마다 문구를 따로 두지 않는다.
 */
export function HelpTip({ title, body, ariaLabel }: { title: string; body: string; ariaLabel: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ left: number; width: number; arrow: number } | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  // 설명 상자가 열려 있을 때 뒤로 가기를 누르면 상자만 닫힌다(lib/history-layers.ts)
  useHistoryClose(open, () => setOpen(false));

  // 열릴 때 `?` 의 화면 위치를 재서 상자의 왼쪽 위치·폭·화살표 위치를 정한다
  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      return;
    }
    const rect = rootRef.current.getBoundingClientRect();
    const width = Math.min(PANEL_MAX, window.innerWidth - GUTTER * 2);
    const center = rect.left + rect.width / 2;
    const left = Math.min(Math.max(center - width / 2, GUTTER), window.innerWidth - GUTTER - width);
    setPlace({ left: left - rect.left, width, arrow: center - left });
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative ml-1 inline-flex align-middle">
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="-m-3 grid h-11 w-11 place-items-center"
      >
        <span
          aria-hidden="true"
          className={`grid h-5 w-5 place-items-center rounded-full border font-num text-xs font-bold ${
            open ? "border-chip-on-bg text-fg" : "border-ctl text-fg-dim"
          }`}
        >
          ?
        </span>
      </button>
      {open ? (
        <span
          id={panelId}
          role="dialog"
          aria-label={title}
          style={place ? { left: place.left, width: place.width } : { left: 0, width: PANEL_MAX, visibility: "hidden" }}
          className="absolute top-full z-30 mt-3 flex max-w-[calc(100vw-2rem)] flex-col gap-2 whitespace-normal rounded-xl border border-chip-on-bg bg-table-head p-3 text-left font-sans font-normal shadow-lg"
        >
          {/* 위쪽 화살표: 상자와 같은 배경·윤곽을 가진 45° 정사각형의 위·왼쪽 변만 보인다 */}
          <span
            aria-hidden="true"
            style={{ left: place ? place.arrow - 6 : 0 }}
            className="absolute -top-[7px] h-3 w-3 rotate-45 border-l border-t border-chip-on-bg bg-table-head"
          />
          <span className="text-[13px] font-bold text-fg">{title}</span>
          <span className="text-xs leading-relaxed text-fg-sub">{body}</span>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              buttonRef.current?.focus();
            }}
            className="flex min-h-11 items-center self-end px-1 text-[13px] text-fg-sub hover:text-fg"
          >
            {t("Common.close")}
          </button>
        </span>
      ) : null}
    </span>
  );
}

/**
 * "내 평균 난이도" 설명(서열표 첫 화면, 홈 진행도 카드의 평균 근처 안내, 세트리스트 추천). 세 곳이 같은 문구를 쓴다.
 * 평균은 내 레이팅 목록(단일 + 그 외, 최대 40채보)의 서열표 기준 난이도 평균이다(백엔드 OwnRatingPlayLevelEstimator).
 */
export function AverageLevelHelp() {
  const t = useTranslations("AverageHelp");
  return <HelpTip title={t("title")} body={t("body")} ariaLabel={t("ariaLabel")} />;
}
