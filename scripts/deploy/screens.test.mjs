// 실행: node --test scripts/deploy/screens.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { findErrorText, isHorizontalOverflow, isRealConsoleError, LOCALE_COOKIE, overflowProblem, pagesFor, VIEWPORTS } from "./screens.mjs";

test("곡 id가 있으면 곡 상세를 넣고, 없으면 공개 화면 5개만", () => {
  assert.equal(pagesFor(null).length, 5);
  assert.ok(pagesFor(12).some((p) => p.path === "/songs/12"));
  assert.equal(pagesFor(-1).length, 5);
  assert.ok(pagesFor(null).every((p) => p.path.startsWith("/")));
});

test("모바일(360)과 데스크톱(1280) 두 폭, 그리고 일본어 360", () => {
  assert.deepEqual(VIEWPORTS.map((v) => v.width), [360, 1280, 360]);
  assert.equal(VIEWPORTS.filter((v) => v.locale === "ja").length, 1);
  assert.equal(VIEWPORTS.find((v) => v.locale === "ja").width, 360);
  assert.equal(LOCALE_COOKIE, "srp.locale");
});

test("가로 폭 초과 판정: 허용 오차 1px", () => {
  assert.equal(isHorizontalOverflow(360, 360), false);
  assert.equal(isHorizontalOverflow(361, 360), false); // 1px까지는 반올림 차이로 본다
  assert.equal(isHorizontalOverflow(362, 360), true);
  assert.equal(isHorizontalOverflow(447, 360), true); // 일본어 홈이 넘쳤던 실제 값
  assert.equal(isHorizontalOverflow(300, 360), false);
  assert.equal(isHorizontalOverflow(362, 360, 2), false);
});

test("넘치면 실패 문구에 두 폭이 들어가고, 아니면 null", () => {
  assert.equal(overflowProblem(360, 360), null);
  assert.equal(overflowProblem(447, 360), "가로 폭 초과 (447px > 360px)");
});

test("공통 오류 문구를 찾는다", () => {
  assert.equal(findErrorText("공지사항을 불러오지 못했습니다. 잠시 후"), "불러오지 못했습니다");
  assert.equal(findErrorText("서열표 5.6 59채보"), null);
});

test("로그인하지 않아 생기는 401 같은 네트워크 응답 줄은 콘솔 오류로 세지 않는다", () => {
  assert.equal(isRealConsoleError("Failed to load resource: the server responded with a status of 401 ()"), false);
  assert.equal(isRealConsoleError("TypeError: Cannot read properties of undefined"), true);
});
