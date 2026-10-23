import { createTranslator } from "use-intl/core";
import ja from "../../messages/ja.json";
import type { Translator } from "@/i18n/translator";

/**
 * 테스트·파일 생성 전용: 일본어 원본으로 만든 번역 함수(ko-translator.ts와 짝).
 * 가져오기 로더 파일(public/import-loader)을 언어별로 만들 때 쓴다.
 */
export const jaT: Translator = createTranslator({ locale: "ja", messages: ja } as never) as Translator;
