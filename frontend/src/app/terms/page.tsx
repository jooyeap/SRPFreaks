import { useTranslations } from "next-intl";
import { ContactLine } from "@/components/ContactLine";

type Section = { title: string; body: readonly string[] };

/**
 * 약관 본문. 실제 동작과 어긋나지 않게 쓴다(예: 탈퇴 시 즉시 삭제, 운영자의 기록 삭제는 D29). 동작이 바뀌면 이 문서도 같이 고친다.
 * 문구는 messages의 `Terms.*`에 있고, 시행일(`Terms.effectiveDate`)도 내용을 바꿀 때 함께 바꾼다. 법률 검토를 거친 문서가 아니므로 공개 범위가 커지면 검토를 받는다.
 * 여기에는 번역 키만 둔다(제목, 항목 순서).
 */
const SECTIONS = [
  {
    title: "Terms.s1Title",
    body: ["Terms.s1b1", "Terms.s1b2"],
  },
  {
    title: "Terms.s2Title",
    body: ["Terms.s2b1", "Terms.s2b2", "Terms.s2b3"],
  },
  {
    title: "Terms.s3Title",
    body: ["Terms.s3b1", "Terms.s3b2", "Terms.s3b3", "Terms.s3b4"],
  },
  {
    title: "Terms.s4Title",
    body: ["Terms.s4b1", "Terms.s4b2", "Terms.s4b3", "Terms.s4b4"],
  },
  {
    title: "Terms.s5Title",
    body: ["Terms.s5b1"],
  },
  {
    title: "Terms.s6Title",
    body: ["Terms.s6b1"],
  },
  {
    title: "Terms.s7Title",
    body: ["Terms.s7b1", "Terms.s7b2"],
  },
  {
    title: "Terms.s8Title",
    body: ["Terms.s8b1"],
  },
] as const satisfies readonly Section[];

export default function TermsPage() {
  const t = useTranslations();
  return (
    <article className="mx-auto w-full max-w-[720px] space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-fg">{t("Terms.title")}</h1>
        <p className="text-sm text-fg-sub">{t("Terms.lead", { date: t("Terms.effectiveDate") })}</p>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="text-base font-semibold text-fg">{t(section.title)}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-fg-sub">
            {section.body.map((line) => (
              <li key={line}>{t(line)}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-fg">{t("Terms.contactHeading")}</h2>
        <ContactLine className="text-sm text-fg-sub" />
      </section>
    </article>
  );
}
