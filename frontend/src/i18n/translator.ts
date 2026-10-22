import type { createTranslator } from "use-intl/core";
import type { Messages } from "@/i18n/messages";

/**
 * 번역 함수의 타입(루트 기준이라 키를 `Songs.title`처럼 전체 경로로 쓴다).
 * 화면 컴포넌트는 `const t = useTranslations()`로 얻고, 컴포넌트 밖의 일반 함수(문구를 만들어 돌려주는 도우미)는
 * 훅을 부를 수 없으므로 이 타입의 `t`를 매개변수로 받는다.
 */
export type Translator = ReturnType<typeof createTranslator<Messages>>;

/** 번역 키 하나(`Songs.title` 같은 전체 경로). 표나 상수에 "나중에 번역할 문구"를 키로 들고 있을 때 쓴다. */
export type MessageKey = Parameters<Translator>[0];
