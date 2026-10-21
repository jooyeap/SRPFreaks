import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/**
 * 화면의 탭 제목을 "<화면 이름> | SRPFreaks"로 만든다. 이름은 요청한 사람의 언어로 번역한다.
 * titleKey는 messages의 전체 경로(예: "Nav.songs")이고, 키 오타를 막으려고 쓸 수 있는 키를 TitleKey로 제한한다. 이미 제목 키가 따로 있는 화면(가이드·처리방침·약관)은 쓰지 않는다.
 */
type TitleKey = "Nav.songs" | "Nav.players" | "Nav.notices" | "Nav.suggestions" | "Nav.settings" | "Nav.myPage" | "Nav.login" | "Meta.table";

export async function pageMetadata(titleKey: TitleKey): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t(titleKey)} | SRPFreaks` };
}
