import { createTranslator } from "use-intl/core";
import ko from "../../messages/ko.json";
import type { Translator } from "@/i18n/translator";

/**
 * 테스트 전용: 한국어 원본으로 만든 번역 함수.
 * 문구를 만들어 돌려주는 일반 함수(lib/*)는 `t`를 매개변수로 받으므로, 테스트에서 이걸 넘겨 한국어 문구를 확인한다.
 */
export const koT: Translator = createTranslator({ locale: "ko", messages: ko } as never) as Translator;
