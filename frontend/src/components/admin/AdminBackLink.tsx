import Link from "next/link";
import { useTranslations } from "next-intl";
import { BackArrow } from "@/components/BackArrow";

/**
 * 관리 하위 화면 맨 위의 `‹ 관리` 돌아가기(D78). 여섯 관리 화면(건의 관리 · 사용자 · 설정 · 감사 로그 · 서열표 분석 · 공식 곡 목록 갱신)이 같은 모양을 쓴다.
 * 글자는 기존 `Admin.title`(관리)을 그대로 쓰고, 화면 읽기 프로그램에는 기존 `Admin.backAria`(관리로)로 읽힌다(보이는 글자 `관리`가 이름 안에 들어 있다).
 * 높이는 뒤로 버튼(BACK_BUTTON_CLASS)과 같은 기준이다: 모바일 44px, 마우스 환경(compact) 36px.
 */
export function AdminBackLink() {
  const t = useTranslations();
  return (
    <Link
      href="/admin"
      aria-label={t("Admin.backAria")}
      title={t("Admin.backAria")}
      className="inline-flex min-h-11 shrink-0 items-center gap-1 self-start rounded-lg border border-ctl pl-2.5 pr-3 text-sm text-fg-sub hover:text-fg compact:min-h-9"
    >
      <BackArrow />
      <span>{t("Admin.title")}</span>
    </Link>
  );
}
