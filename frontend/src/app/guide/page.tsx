import { useTranslations } from "next-intl";
import { ConstantTable } from "@/components/guide/ConstantTable";
import { DEFAULT_COEFFICIENTS, pointsPerPercentAboveCap } from "@/lib/rating-guide";

// 항목은 번역 키로 들고 있다가 화면에서 `t(...)`로 푼다. SRN+는 어느 언어에서나 같은 이름이라 키가 없다.
const SUMMARY = [
  { head: null, text: "Guide.sumSrnText" },
  { head: "Guide.sum40Head", text: "Guide.sum40Text" },
  { head: "Guide.sumTierHead", text: "Guide.sumTierText" },
] as const;

const INCLUDED = ["Guide.inc1", "Guide.inc2", "Guide.inc3"] as const;

const SELECTION = ["Guide.sel1", "Guide.sel2", "Guide.sel3"] as const;

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
  const t = useTranslations();
  const b = { b: (c: React.ReactNode) => <b className="text-fg">{c}</b> };
  const n = { n: (c: React.ReactNode) => <b className="font-num text-fg">{c}</b> };
  return (
    <article className="mx-auto w-full max-w-[720px] space-y-7">
      <header className="space-y-2">
        <p className="font-num text-xs tracking-[0.14em] text-fg-dim">GUIDE</p>
        <h1 className="text-2xl font-bold text-fg">{t("Guide.title")}</h1>
        <p className="text-sm leading-relaxed text-fg-sub">{t("Guide.lead")}</p>
      </header>

      <section aria-label={t("Guide.summaryAria")} className="grid gap-2.5 sm:grid-cols-3">
        {SUMMARY.map((item) => (
          <div key={item.text} className="flex items-center gap-3.5 rounded-2xl border border-line bg-card px-4 py-3.5 sm:flex-col sm:items-start sm:gap-2">
            <span className="font-num w-[76px] shrink-0 text-xl font-bold text-fg sm:w-auto">{item.head ? t(item.head) : "SRN+"}</span>
            <span className="text-[13px] leading-relaxed text-fg-sub">{t(item.text)}</span>
          </div>
        ))}
      </section>

      {/* 상세 설명은 처음에 접어 둔다: 대부분은 한눈에 보기만 읽으면 되기 때문이다. 브라우저 기본 <details>라 JS 없이 열고 닫히고,
          열림 상태는 기본으로 보조 기술에 전달된다. 접힌 줄에도 ▸/▾ 글자 표시를 둬서 색이나 위치에만 기대지 않는다. */}
      <section aria-label={t("Guide.envHeading")} className="space-y-1.5 rounded-2xl border border-line bg-card p-4">
        <h2 className="text-[15px] font-bold text-fg">{t("Guide.envHeading")}</h2>
        <p className="text-[13px] leading-relaxed text-fg-sub">{t("Guide.envText")}</p>
      </section>

      <details className="group space-y-3" aria-label={t("Guide.criteriaAria")}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-2xl border border-line bg-card px-4 text-lg font-bold text-fg [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="font-num text-sm text-fg-dim group-open:hidden">▸</span>
          <span aria-hidden="true" className="font-num hidden text-sm text-fg-dim group-open:inline">▾</span>
          <h2 className="text-lg font-bold text-fg">{t("Guide.criteriaHeading")}</h2>
          <span className="ml-auto text-xs font-normal text-fg-dim">{t("Guide.detail")}</span>
        </summary>
        <div className="space-y-3 pt-3">
        <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
          <h3 className="text-[15px] font-bold text-done-text">{t("Guide.includedHeading")}</h3>
          <ul className="space-y-2.5 text-[13px] leading-relaxed text-fg-sub">
            {INCLUDED.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <CheckIcon />
                <span>{t(line)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
          <h3 className="text-[15px] font-bold text-fg-sub">{t("Guide.excludedHeading")}</h3>
          <ul className="space-y-2.5 text-[13px] leading-relaxed text-fg-sub">
            <li className="flex items-start gap-2">
              <CrossIcon />
              <span>{t.rich("Guide.exc1", b)}</span>
            </li>
            <li className="flex items-start gap-2">
              <CrossIcon />
              <span>{t.rich("Guide.exc2", b)}</span>
            </li>
            <li className="flex items-start gap-2">
              <CrossIcon />
              <span>{t("Guide.exc3")}</span>
            </li>
          </ul>
          <p className="text-xs leading-relaxed text-fg-dim">{t("Guide.excNote")}</p>
        </div>

        <div className="space-y-2.5 rounded-2xl border border-line bg-card p-4">
          <h3 className="text-[15px] font-bold text-fg">{t("Guide.selectHeading")}</h3>
          <ul className="list-disc space-y-2 pl-[18px] text-[13px] leading-relaxed text-fg-sub">
            {SELECTION.map((line) => (
              <li key={line}>{t(line)}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-2.5 rounded-2xl border border-line bg-card p-4">
          <h3 className="text-[15px] font-bold text-fg">{t("Guide.manageHeading")}</h3>
          <p className="text-[13px] leading-relaxed text-fg-sub">{t("Guide.manageText")}</p>
        </div>
        </div>
      </details>

      <section aria-label={t("Guide.constAria")} className="space-y-3">
        <h2 className="text-lg font-bold text-fg">{t("Guide.constHeading")}</h2>
        <p className="text-[13px] leading-relaxed text-fg-sub">{t("Guide.constP1")}</p>
        <p className="text-[13px] leading-relaxed text-fg-sub">{t.rich("Guide.constP2", b)}</p>
        <p className="text-[13px] leading-relaxed text-fg-sub">{t.rich("Guide.constP3", n)}</p>
        <ConstantTable />
        {/* 참고: 달성률 1%가 점수로 얼마인지. 값은 계수(DEFAULT_COEFFICIENTS)에서 계산한다 */}
        <div className="space-y-2.5 rounded-2xl border border-line bg-card p-4">
          <h3 className="text-[15px] font-bold text-fg">{t("Guide.refHeading")}</h3>
          <ul className="list-disc space-y-2 pl-[18px] text-[13px] leading-relaxed text-fg-sub">
            <li>
              {t.rich("Guide.ref1", {
                ...n,
                cap: DEFAULT_COEFFICIENTS.capRate,
                max: DEFAULT_COEFFICIENTS.maxRate,
                points: pointsPerPercentAboveCap().toFixed(2),
              })}
            </li>
            <li>{t("Guide.ref2")}</li>
            <li>{t("Guide.ref3", { cap: DEFAULT_COEFFICIENTS.capRate })}</li>
          </ul>
        </div>
        <p className="text-xs leading-relaxed text-fg-dim">{t("Guide.footnote")}</p>
      </section>
    </article>
  );
}
