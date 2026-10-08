import { getContactEmail } from "@/lib/contact";

/** 푸터와 처리방침이 함께 쓰는 문의처 한 줄. 메일 주소가 설정되지 않았으면 아무것도 그리지 않는다. */
export function ContactLine({ className }: { className?: string }) {
  const email = getContactEmail();
  if (!email) {
    return null;
  }
  return (
    <p className={className}>
      문의·삭제 요청:{" "}
      <a href={`mailto:${email}`} className="break-all underline underline-offset-2 hover:text-fg">
        {email}
      </a>
    </p>
  );
}
