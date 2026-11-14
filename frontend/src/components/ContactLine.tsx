import { useTranslations } from "next-intl";
import { getContactEmail } from "@/lib/contact";
import { FOOTER_LINE_LINK } from "@/lib/hit-area";

/** 푸터와 처리방침이 함께 쓰는 문의처 한 줄. 메일 주소가 설정되지 않았으면 아무것도 그리지 않는다. `tall`은 푸터에서만 켠다(링크 높이 40px, 글 속 링크로 쓰는 처리방침 본문은 그대로). */
export function ContactLine({ className, tall = false }: { className?: string; tall?: boolean }) {
  const t = useTranslations("Footer");
  const email = getContactEmail();
  if (!email) {
    return null;
  }
  return (
    <p className={className}>
      {t("contact")}{" "}
      <a href={`mailto:${email}`} className={`break-all underline underline-offset-2 hover:text-fg ${tall ? FOOTER_LINE_LINK : ""}`}>
        {email}
      </a>
    </p>
  );
}
