// 실행: node --test scripts/deploy/screens.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { findErrorText, pagesFor, VIEWPORTS } from "./screens.mjs";

test("곡 id가 있으면 곡 상세를 넣고, 없으면 공개 화면 5개만", () => {
  assert.equal(pagesFor(null).length, 5);
  assert.ok(pagesFor(12).some((p) => p.path === "/songs/12"));
  assert.equal(pagesFor(-1).length, 5);
  assert.ok(pagesFor(null).every((p) => p.path.startsWith("/")));
});

test("모바일(360)과 데스크톱(1280) 두 폭", () => {
  assert.deepEqual(VIEWPORTS.map((v) => v.width), [360, 1280]);
});

test("공통 오류 문구를 찾는다", () => {
  assert.equal(findErrorText("공지사항을 불러오지 못했습니다. 잠시 후"), "불러오지 못했습니다");
  assert.equal(findErrorText("서열표 5.6 59채보"), null);
});
