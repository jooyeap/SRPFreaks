import { useTranslations } from "next-intl";

const SECTIONS = [
  { head: "RivalGuide.regHead", lines: ["RivalGuide.reg1", "RivalGuide.reg2", "RivalGuide.reg3"] },
  { head: "RivalGuide.compareHead", lines: ["RivalGuide.compare1", "RivalGuide.compare2", "RivalGuide.compare3"] },
  { head: "RivalGuide.alertHead", lines: ["RivalGuide.alert1", "RivalGuide.alert2", "RivalGuide.alert3", "RivalGuide.alert4"] },
  { head: "RivalGuide.publicHead", lines: ["RivalGuide.public1", "RivalGuide.public2"] },
  { head: "RivalGuide.offHead", lines: ["RivalGuide.off1"] },
] as const;

/** 설명서 `라이벌` 탭(D56): 등록, 비교 화면, 역전 알림 규칙, 공개 범위, 알림 끄기. 정적 화면이다. */
export function RivalGuide() {
  const t = useTranslations();
  return (
    <article className="space-y-5">
      <header className="space-y-2">
        <p className="font-num text-xs tracking-[0.14em] text-fg-dim">RIVAL</p>
        <h1 className="text-2xl font-bold text-fg">{t("RivalGuide.title")}</h1>
        <p className="text-sm leading-relaxed text-fg-sub">{t("RivalGuide.lead")}</p>
      </header>
      {SECTIONS.map((section) => (
        <section key={section.head} aria-label={t(section.head)} className="space-y-2.5 rounded-2xl border border-line bg-card p-4">
          <h2 className="text-[15px] font-bold text-fg">{t(section.head)}</h2>
          <ul className="list-disc space-y-2 pl-[18px] text-[13px] leading-relaxed text-fg-sub">
            {section.lines.map((line) => (
              <li key={line}>{t(line)}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
