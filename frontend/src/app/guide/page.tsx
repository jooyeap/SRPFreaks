import type { Metadata } from "next";
import { ConstantTable } from "@/components/guide/ConstantTable";

export const metadata: Metadata = { title: "레이팅 설명서 | SRPFreaks" };

const SUMMARY = [
  { head: "SRN+", text: "SRN+ 옵션으로 저장한 기록만 계산합니다." },
  { head: "40채보", text: "단일 속성 상위 15개와 그 외 속성 상위 25개를 더합니다." },
  { head: "티어", text: "점수 합계의 정수부로 플레이어 티어가 정해집니다." },
] as const;

const INCLUDED = [
  "서열표에 레이팅 상수 난이도가 있는 채보",
  "속성이 단일, 복합, 이중, 삼중 중 하나인 채보",
  "내가 SRN+로 저장한 기록이 있는 채보",
] as const;

const SELECTION = [
  "단일 속성 상위 15곡, 그 외 속성 상위 25곡으로 산정합니다.",
  "같은 곡의 다른 채보도 각각 하나로 셉니다.",
  "Guitar와 Bass는 구분하지 않고 한 목록으로 합쳐 순위를 매깁니다.",
] as const;

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-done-text">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-fg-dim">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * 레이팅 설명서. 로그인 없이 볼 수 있는 정적 화면이다(기록을 쓰지 않는다).
 * 문구는 시안(모바일)의 것을 그대로 옮겼다. 포함/제외 아이콘(✓/✕)은 항목 글자 옆의 보조 표시이고 의미는 제목("포함되는/포함되지 않는")이 전달한다.
 */
export default function GuidePage() {
  return (
    <article className="mx-auto w-full max-w-[720px] space-y-7">
      <header className="space-y-2">
        <p className="font-num text-xs tracking-[0.14em] text-fg-dim">GUIDE</p>
        <h1 className="text-2xl font-bold text-fg">레이팅 설명서</h1>
        <p className="text-sm leading-relaxed text-fg-sub">SRN+ 기록 중 어떤 채보가 레이팅에 포함되는지 기준을 정리했습니다.</p>
      </header>

      <section aria-label="한눈에 보기" className="grid gap-2.5 sm:grid-cols-3">
        {SUMMARY.map((item) => (
          <div key={item.head} className="flex items-center gap-3.5 rounded-xl border border-line bg-card px-4 py-3.5 sm:flex-col sm:items-start sm:gap-2">
            <span className="font-num w-[76px] shrink-0 text-xl font-bold text-fg sm:w-auto">{item.head}</span>
            <span className="text-[13px] leading-relaxed text-fg-sub">{item.text}</span>
          </div>
        ))}
      </section>

      <section aria-label="포함 기준" className="space-y-3">
        <h2 className="text-lg font-bold text-fg">포함 기준</h2>

        <div className="space-y-3 rounded-xl border border-line bg-card p-4">
          <h3 className="text-[15px] font-bold text-done-text">포함되는 채보</h3>
          <ul className="space-y-2.5 text-[13px] leading-relaxed text-fg-sub">
            {INCLUDED.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <CheckIcon />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 rounded-xl border border-line bg-card p-4">
          <h3 className="text-[15px] font-bold text-fg-sub">포함되지 않는 채보</h3>
          <ul className="space-y-2.5 text-[13px] leading-relaxed text-fg-sub">
            <li className="flex items-start gap-2">
              <CrossIcon />
              <span>
                레이팅 상수 난이도가 <b className="text-fg">미정</b>인 채보
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CrossIcon />
              <span>
                속성이 <b className="text-fg">레이팅 제외</b>이거나 비어 있는 채보
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CrossIcon />
              <span>서열표에 없는 채보, 기록이 없는 채보</span>
            </li>
          </ul>
          <p className="text-xs leading-relaxed text-fg-dim">제외된 채보도 기록은 그대로 남습니다.</p>
        </div>

        <div className="space-y-2.5 rounded-xl border border-line bg-card p-4">
          <h3 className="text-[15px] font-bold text-fg">고르는 방식</h3>
          <ul className="list-disc space-y-2 pl-[18px] text-[13px] leading-relaxed text-fg-sub">
            {SELECTION.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-2.5 rounded-xl border border-line bg-card p-4">
          <h3 className="text-[15px] font-bold text-fg">기록 관리</h3>
          <p className="text-[13px] leading-relaxed text-fg-sub">부정한 방법으로 입력한 기록은 운영자가 삭제할 수 있습니다.</p>
        </div>
      </section>

      <section aria-label="레이팅 상수표" className="space-y-3">
        <h2 className="text-lg font-bold text-fg">레이팅 상수표</h2>
        <p className="text-[13px] leading-relaxed text-fg-sub">
          슈랜플 난이도(서열표의 레이팅 상수 난이도)와 달성률별 채보 점수입니다. 정수로 반올림해 보여 주며, 칸 색은 점수가 높을수록 노랑에서 분홍, 검정 쪽으로 이어집니다.
        </p>
        <p className="text-[13px] leading-relaxed text-fg-sub">
          곡별 레이팅의 최고 수치는 달성률 <b className="text-fg">100%가 아니라 95%</b>입니다. 95%를 넘어도 점수는 더 오르지 않습니다.
        </p>
        <ConstantTable />
        <p className="text-xs leading-relaxed text-fg-dim">내부 상수는 서열표의 레이팅 상수 난이도로 정해집니다. 이 표는 현재 계수를 기준으로 계산한 값입니다.</p>
      </section>
    </article>
  );
}
