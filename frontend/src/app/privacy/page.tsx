import { useTranslations } from "next-intl";
import { ContactLine } from "@/components/ContactLine";

type Section = { title: string; body: readonly string[] };

/**
 * 처리방침 본문. 실제 코드가 하는 일과 어긋나지 않게 쓴다 (예: 비밀번호를 받지 않음, 탈퇴 시 즉시 삭제, 14일 로그인 유지).
 * 서비스 동작이 바뀌면 이 문서도 같이 고친다. 문구는 messages의 `Privacy.*`에 있고, 시행일(`Privacy.effectiveDate`)도 내용을 바꿀 때 함께 바꾼다.
 * 여기에는 번역 키만 둔다(제목, 항목 순서).
 */
const SECTIONS = [
  {
    title: "Privacy.s1Title",
    body: ["Privacy.s1b1", "Privacy.s1b2", "Privacy.s1b3", "Privacy.s1b4"],
  },
  {
    title: "Privacy.s2Title",
    body: ["Privacy.s2b1", "Privacy.s2b2", "Privacy.s2b3"],
  },
  {
    title: "Privacy.s3Title",
    body: ["Privacy.s3b1", "Privacy.s3b2", "Privacy.s3b3"],
  },
  {
    title: "Privacy.s4Title",
    body: ["Privacy.s4b1", "Privacy.s4b2", "Privacy.s4b3"],
  },
  {
    title: "Privacy.s5Title",
    body: ["Privacy.s5b1", "Privacy.s5b2"],
  },
  {
    title: "Privacy.s6Title",
    body: ["Privacy.s6b1", "Privacy.s6b2"],
  },
  {
    title: "Privacy.s7Title",
    body: ["Privacy.s7b1", "Privacy.s7b2"],
  },
  {
    title: "Privacy.s8Title",
    body: ["Privacy.s8b1", "Privacy.s8b2"],
  },
] as const satisfies readonly Section[];

export default function PrivacyPage() {
  const t = useTranslations();
  return (
    <article className="mx-auto w-full max-w-[720px] space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-fg">{t("Privacy.title")}</h1>
        <p className="text-sm text-fg-sub">{t("Privacy.lead", { date: t("Privacy.effectiveDate") })}</p>
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
        <h2 className="text-base font-semibold text-fg">{t("Privacy.contactHeading")}</h2>
        <ContactLine className="text-sm text-fg-sub" />
      </section>
    </article>
  );
}
