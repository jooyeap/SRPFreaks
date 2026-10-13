import { z } from "zod";

/**
 * 닉네임 검사 (Zod). 서버(User.normalizeNickname)와 같은 규칙이고, docs/DESIGN.md "닉네임 규칙"에 기록돼 있다.
 * 화면에서 먼저 막아 오류를 바로 알려 주기 위한 것이며 서버 검사를 대신하지는 않는다.
 *
 * - 2~12자. 글자 수는 코드 포인트로 센다(히라가나·가타카나·한자·영문 모두 1자). JS의 .length는 UTF-16 단위라
 *   𠮷 같은 드문 한자를 2로 세므로 쓰지 않는다.
 * - 영문, 숫자, 히라가나, 가타카나, 한자와 ー ・ 々 〆 〇 _ - 만 허용한다. 한글과 공백은 허용하지 않는다.
 * - 저장 전에 NFKC로 정규화한다(반각 가타카나 -> 전각, 전각 영문·숫자 -> 반각).
 */
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 12;

// ー ・ 々 〆 〇는 문자 종류가 "공통"이라 \p{Script=...}에 안 걸려서 따로 적는다.
const NICKNAME_PATTERN = /^[A-Za-z0-9_\-ー・々〆〇\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+$/u;

/** 서버와 같은 정규화: NFKC 후 앞뒤 공백 제거. */
export function normalizeNickname(value: string): string {
  return value.normalize("NFKC").trim();
}

/** 사용자가 보는 글자 수(코드 포인트 수). */
export function countNicknameChars(value: string): number {
  return Array.from(value).length;
}

/**
 * 닉네임 입력 스키마. 결과는 정규화된 값이다. 빈 값은 "닉네임 없음"을 뜻하므로 오류가 아니라 null로 돌려준다
 * (서버도 빈 값은 NULL로 저장한다).
 */
export const nicknameSchema = z
  .string()
  .transform((value) => normalizeNickname(value))
  .superRefine((value, ctx) => {
    if (value.length === 0) {
      return;
    }
    const length = countNicknameChars(value);
    if (length < NICKNAME_MIN_LENGTH || length > NICKNAME_MAX_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: `닉네임은 ${NICKNAME_MIN_LENGTH}자 이상 ${NICKNAME_MAX_LENGTH}자 이하여야 합니다.`,
      });
      return;
    }
    if (!NICKNAME_PATTERN.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: "닉네임은 영문, 숫자, 일본어(히라가나·가타카나·한자)와 ー ・ _ - 만 사용할 수 있습니다.",
      });
    }
  })
  .transform((value) => (value.length === 0 ? null : value));
