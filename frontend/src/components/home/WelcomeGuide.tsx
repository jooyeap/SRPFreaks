"use client";

import Link from "next/link";
import { hideWelcomeGuide } from "@/lib/welcome-guide";

const LINK_PRIMARY = "flex min-h-11 items-center justify-center rounded-xl bg-chip-on-bg text-sm font-bold text-chip-on-fg";
const LINK_TEXT = "flex min-h-11 items-center text-[13px] text-fg underline";

/**
 * 기록이 하나도 없는 사용자를 위한 홈의 `시작하기` 안내. 레이팅이 0이고 무엇부터 해야 할지 모르는 첫 화면을 채운다.
 * 세 단계: ① 최근 플레이 가져오기(가장 빠름) ② 서열표에서 곡 하나 직접 입력 ③ 내 레이팅 확인(기록이 생기면 열림).
 * 완료 칸은 `0/3`으로 고정이다: 기록이 하나라도 생기면 이 카드 자체가 사라지므로(HomeDashboard) 중간 상태가 없다.
 * `시작 안내 숨기기`는 이 기기에 저장한다(lib/welcome-guide.ts).
 */
export function WelcomeGuide() {
  return (
    <section aria-label="시작하기" className="flex flex-col gap-3 rounded-2xl border border-chip-on-bg bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-bold text-fg">시작하기</h2>
        <span className="font-num text-xs text-fg-dim">0/3 완료</span>
      </div>
      <p className="text-[13px] leading-relaxed text-fg-sub">
        SRN+ 옵션으로 플레이한 기록을 넣으면 레이팅이 계산됩니다. 가장 빠른 방법부터 해 보세요.
      </p>
      <ol className="flex flex-col gap-2.5">
        <li className="flex gap-3 rounded-xl border border-chip-on-bg bg-table-head p-3">
          <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-chip-on-bg font-num text-sm font-bold text-chip-on-fg">
            1
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-sm font-bold text-fg">
              최근 플레이 가져오기{" "}
              <span className="ml-1 rounded bg-chip-on-bg px-1.5 py-0.5 align-[1px] font-num text-[11px] text-chip-on-fg">가장 빠름</span>
            </p>
            <p className="text-xs leading-normal text-fg-sub">공식 사이트의 최근 플레이 20곡을 북마크 한 번으로 읽어 옵니다. 확인한 뒤 고른 곡만 저장돼요.</p>
            <Link href="/import" className={LINK_PRIMARY}>
              가져오는 방법 보기
            </Link>
          </div>
        </li>
        <li className="flex gap-3 rounded-xl border border-line p-3">
          <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-chip-line font-num text-sm font-bold text-fg-sub">
            2
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <p className="text-sm font-bold text-fg">곡 하나를 직접 입력</p>
            <p className="text-xs leading-normal text-fg-sub">서열표에서 곡을 찾아 달성률을 한 건씩 넣을 수 있어요.</p>
            <Link href="/table" className={LINK_TEXT}>
              서열표로 이동
            </Link>
          </div>
        </li>
        <li className="flex gap-3 rounded-xl border border-line p-3">
          <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-chip-line font-num text-sm font-bold text-fg-dim">
            3
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <p className="text-sm font-bold text-fg-dim">내 레이팅 확인</p>
            <p className="text-xs leading-normal text-fg-dim">기록이 하나라도 있으면 열려요.</p>
          </div>
        </li>
      </ol>
      <button type="button" onClick={hideWelcomeGuide} className="flex min-h-11 items-center self-start text-xs text-fg-dim underline hover:text-fg">
        시작 안내 숨기기
      </button>
    </section>
  );
}
