import { describe, expect, it } from "vitest";
import { formatBpm, isWritable, normalizeArtist, parseBpmText } from "@/lib/song-info";

describe("곡 정보 가져오기 값 표시 (D94)", () => {
  it("BPM은 고정이면 한 값, 가변이면 범위, 없으면 줄표", () => {
    expect(formatBpm(172, 172)).toBe("172");
    expect(formatBpm(120, 180)).toBe("120–180");
    expect(formatBpm(null, null)).toBe("–");
    expect(formatBpm(150, null)).toBe("150");
  });

  it("새로 채움·덮어쓰기만 저장할 것이 있다", () => {
    expect(isWritable("FILL")).toBe(true);
    expect(isWritable("OVERWRITE")).toBe(true);
    expect(isWritable("UNCHANGED")).toBe(false);
    expect(isWritable("NONE")).toBe(false);
  });
});

describe("BPM 글자 검증 (D94)", () => {
  it("고정·범위(하이픈·물결표·긴 줄표·전각)를 최소·최대로 읽는다", () => {
    expect(parseBpmText("172")).toEqual({ min: 172, max: 172 });
    expect(parseBpmText(" 120-180 ")).toEqual({ min: 120, max: 180 });
    expect(parseBpmText("120 ~ 180")).toEqual({ min: 120, max: 180 });
    expect(parseBpmText("120–180")).toEqual({ min: 120, max: 180 });
    expect(parseBpmText("１２０〜１８０")).toEqual({ min: 120, max: 180 });
    expect(parseBpmText("1")).toEqual({ min: 1, max: 1 });
    expect(parseBpmText("2000")).toEqual({ min: 2000, max: 2000 });
  });

  it("범위 밖·최소>최대·소수·글자 섞임·빈 값은 null이다", () => {
    for (const bad of ["", "0", "2001", "200-100", "172.5", "BPM 172", "varies", "120-", "1-2-3", "12345"]) {
      expect(parseBpmText(bad), bad).toBeNull();
    }
  });
});

describe("아티스트 글자 정리 (D94, 서버 normalizeArtist와 같은 규칙)", () => {
  it("NFKC 정규화, 줄바꿈·제어문자는 공백, 공백은 하나로 합친다", () => {
    expect(normalizeArtist("  Ｗｉｄｅ\n\r\n Name\t X ")).toBe("Wide Name X");
    expect(normalizeArtist("a\u0001b")).toBe("a b");
  });

  it("비었거나 255자를 넘으면 빈 글자(값 없음)이고, 255자는 그대로 쓴다", () => {
    expect(normalizeArtist("")).toBe("");
    expect(normalizeArtist(" \n ")).toBe("");
    expect(normalizeArtist("a".repeat(255))).toBe("a".repeat(255));
    expect(normalizeArtist("a".repeat(256))).toBe("");
  });
});
