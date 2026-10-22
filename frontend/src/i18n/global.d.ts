import type { Messages } from "@/i18n/messages";

// next-intl이 t("...") 키를 한국어 파일 기준으로 검사하게 한다(없는 키를 쓰면 타입 오류)
declare module "next-intl" {
  interface AppConfig {
    Messages: Messages;
  }
}
