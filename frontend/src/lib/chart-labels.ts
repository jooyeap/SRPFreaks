import type { Translator } from "@/i18n/translator";

/**
 * 서버·URL·API가 쓰는 값(속성 `단일`, 추천도 `상` 등)은 그대로 두고, 화면에 보여 주는 글자만 현재 언어로 바꾼다.
 * 모르는 값은 그대로 돌려줘서(예: 서버가 새 속성을 추가해도) 화면이 비지 않는다.
 */
export function patternLabel(value: string, t: Translator): string {
  switch (value) {
    case "단일":
      return t("Chart.patternSingle");
    case "복합":
      return t("Chart.patternCompound");
    case "이중":
      return t("Chart.patternDouble");
    case "삼중":
      return t("Chart.patternTriple");
    case "레이팅 제외":
      return t("Chart.patternExcluded");
    default:
      return value;
  }
}

export function recommendLabel(value: string, t: Translator): string {
  switch (value) {
    case "상":
      return t("Chart.recommendHigh");
    case "중":
      return t("Chart.recommendMid");
    case "하":
      return t("Chart.recommendLow");
    default:
      return value;
  }
}
