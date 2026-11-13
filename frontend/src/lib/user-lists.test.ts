import { describe, expect, it } from "vitest";
import { createTranslator } from "use-intl/core";
import ko from "../../messages/ko.json";
import { LIST_NAME_MAX, makeListNameSchema, moveItem } from "@/lib/user-lists";
import type { Translator } from "@/i18n/translator";

const t = createTranslator({ locale: "ko", messages: ko }) as unknown as Translator;

describe("moveItem (위/아래 버튼)", () => {
  it("한 칸 위·아래로 옮긴 새 배열을 돌려주고 원본은 바꾸지 않는다", () => {
    const original = [1, 2, 3];
    expect(moveItem(original, 1, 0)).toEqual([2, 1, 3]);
    expect(moveItem(original, 1, 2)).toEqual([1, 3, 2]);
    expect(original).toEqual([1, 2, 3]);
  });

  it("범위를 벗어나거나 제자리면 그대로다", () => {
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, 3)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 2, 3]);
  });
});

describe("리스트 이름 검사", () => {
  const schema = makeListNameSchema(t);

  it("앞뒤 공백을 떼고 1~20자(코드포인트)를 받는다", () => {
    expect(schema.parse({ name: "  연습 곡 모음  " }).name).toBe("연습 곡 모음");
    expect(schema.safeParse({ name: "가".repeat(LIST_NAME_MAX) }).success).toBe(true);
    // 이모지처럼 UTF-16으로 2칸인 글자도 한 글자로 센다(서버와 같다)
    expect(schema.safeParse({ name: "😀".repeat(LIST_NAME_MAX) }).success).toBe(true);
  });

  it("비었거나 공백뿐이면 `리스트 이름을 입력해 주세요.`, 21자면 길이 안내다", () => {
    const empty = schema.safeParse({ name: "   " });
    expect(empty.success).toBe(false);
    expect(empty.error?.issues[0].message).toBe("리스트 이름을 입력해 주세요.");
    const long = schema.safeParse({ name: "가".repeat(LIST_NAME_MAX + 1) });
    expect(long.success).toBe(false);
    expect(long.error?.issues[0].message).toBe("리스트 이름은 20자 이하여야 합니다.");
  });
});
