import { describe, expect, it } from "vitest";
import ja from "../../messages/ja.json";
import ko from "../../messages/ko.json";
import { SERVER_ERRORS } from "@/i18n/server-errors";

type Tree = { [key: string]: string | Tree };

/** 중첩된 문구 객체를 `Nav.home` 같은 한 줄 키로 펴서 { 키: 문구 }로 만든다. */
function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[path] = value;
    } else {
      Object.assign(out, flatten(value, path));
    }
  }
  return out;
}

/** `{language}` 같은 자리표시자 이름 목록 */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
}

describe("번역 문구 파일", () => {
  const koFlat = flatten(ko as Tree);
  const jaFlat = flatten(ja as Tree);

  it("일본어에 한국어와 같은 키가 모두 있고, 남는 키도 없다", () => {
    expect(Object.keys(jaFlat).sort()).toEqual(Object.keys(koFlat).sort());
  });

  it("비어 있는 문구가 없다", () => {
    for (const [key, text] of [...Object.entries(koFlat), ...Object.entries(jaFlat)]) {
      expect(text.trim(), key).not.toBe("");
    }
  });

  it("두 언어의 자리표시자({이름})가 같다 (값이 빠지거나 철자가 다르면 화면에 그대로 보인다)", () => {
    for (const [key, text] of Object.entries(koFlat)) {
      expect(placeholders(jaFlat[key] ?? ""), key).toEqual(placeholders(text));
    }
  });

  it("작은따옴표(')는 ICU에서 이스케이프 문자라 문구 안에서는 두 번('')으로 써야 그대로 보인다", () => {
    for (const [key, text] of [...Object.entries(koFlat), ...Object.entries(jaFlat)]) {
      expect(/(?<!')'(?!')/.test(text), key).toBe(false);
    }
  });
  it("서버 오류 코드 표가 ko.json의 ServerErrors와 같다 (서버 고정 문구 비교용)", () => {
    for (const [code, { message, key }] of Object.entries(SERVER_ERRORS)) {
      expect(key, code).toBe(`ServerErrors.${code}`);
      expect(koFlat[key], code).toBe(message);
    }
  });
});
