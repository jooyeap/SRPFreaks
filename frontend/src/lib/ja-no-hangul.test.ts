import { describe, expect, it } from "vitest";
import ja from "../../messages/ja.json";

// ja.json에 한글이 섞이면(번역 누락) 일본어 화면에 한글이 그대로 보인다. 아래 키만 의도적으로 한글이다.
const ALLOWED = new Set([
  "Locale.ko", // 언어 선택 목록의 한국어 이름
  // 관리자 화면의 사진 입력 설정 8개(관리자는 한국어 화면 기준)
  "Admin.settingRecognizeEnabled", "Admin.settingRecognizeEnabledDesc",
  "Admin.settingRecognizeMinRole", "Admin.settingRecognizeMinRoleDesc",
  "Admin.settingRecognizeWeekly", "Admin.settingRecognizeWeeklyDesc",
  "Admin.settingRecognizeDaily", "Admin.settingRecognizeDailyDesc",
]);

function hangulKeys(node: unknown, path: string, out: string[]) {
  if (typeof node === "string") {
    if (/[가-힣]/.test(node)) out.push(path);
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) hangulKeys(v, path ? `${path}.${k}` : k, out);
  }
}

describe("ja.json", () => {
  it("허용 목록 밖에는 한글이 없다", () => {
    const found: string[] = [];
    hangulKeys(ja, "", found);
    expect(found.filter((k) => !ALLOWED.has(k))).toEqual([]);
  });
});
