import { useTranslations } from "next-intl";
import { ErrorScreen, HomeLink } from "@/components/ErrorScreen";

/** 없는 주소로 들어왔을 때(그리고 화면이 notFound()를 던졌을 때) 보이는 화면. */
export default function NotFound() {
  const t = useTranslations("ErrorPage");
  return (
    <ErrorScreen title={t("notFoundTitle")} body={t("notFoundBody")}>
      <HomeLink />
    </ErrorScreen>
  );
}
